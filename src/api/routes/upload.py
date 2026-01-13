"""
Upload routes - for PDF upload and extraction
"""
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, File, Query, UploadFile
from loguru import logger
from sqlalchemy import select

from src.core.config import get_settings
from src.core.database import get_db
from src.extraction.pci_parser import parse_pci_pdf
from src.extraction.pdf_detector import detect_pdf_format
from src.models.edital import Edital

settings = get_settings()
router = APIRouter()


# Mapeamento de variações comuns de nomes de disciplinas
DISCIPLINA_ALIASES = {
    # Português
    "português": ["língua portuguesa", "português", "redação", "interpretação de texto"],
    "língua portuguesa": ["português", "língua portuguesa", "redação"],
    # Matemática e Raciocínio
    "matemática": ["matemática", "raciocínio lógico", "raciocínio lógico-matemático", "rlm"],
    "raciocínio lógico": ["matemática", "raciocínio lógico", "raciocínio lógico-matemático", "rlm"],
    "raciocínio lógico-matemático": ["matemática", "raciocínio lógico", "rlm"],
    # Informática
    "informática": ["informática", "noções de informática", "tecnologia da informação", "ti"],
    "noções de informática": ["informática", "noções de informática"],
    # Direitos
    "direito constitucional": ["direito constitucional", "constitucional"],
    "direito administrativo": ["direito administrativo", "administrativo"],
    "direito penal": ["direito penal", "penal"],
    "direito civil": ["direito civil", "civil"],
    "direito tributário": ["direito tributário", "tributário"],
    "direito processual": ["direito processual", "processual"],
    # Administração
    "administração": ["administração", "administração pública", "adm"],
    "administração pública": ["administração", "administração pública"],
    # Contabilidade
    "contabilidade": ["contabilidade", "contabilidade geral", "contabilidade pública"],
    "contabilidade geral": ["contabilidade", "contabilidade geral"],
    # Economia
    "economia": ["economia", "economia brasileira", "macroeconomia", "microeconomia"],
    # AFO
    "afo": ["afo", "administração financeira e orçamentária", "orçamento público"],
    "administração financeira e orçamentária": ["afo", "administração financeira e orçamentária"],
    # Outros
    "atualidades": ["atualidades", "conhecimentos gerais", "realidade brasileira"],
    "conhecimentos gerais": ["atualidades", "conhecimentos gerais"],
}


def normalize_disciplina(nome: str) -> str:
    """Normaliza nome de disciplina para comparação"""
    if not nome:
        return ""
    return nome.lower().strip()


def get_edital_disciplinas(taxonomia: dict) -> list[str]:
    """Extrai lista de nomes de disciplinas do edital (normalizados)"""
    if not taxonomia:
        return []

    disciplinas = []
    for disc in taxonomia.get("disciplinas", []):
        nome = disc.get("nome", "")
        if nome:
            disciplinas.append(normalize_disciplina(nome))

    return disciplinas


def disciplina_matches_edital(questao_disciplina: str, edital_disciplinas: list[str]) -> bool:
    """
    Verifica se a disciplina da questão corresponde a alguma disciplina do edital.

    Usa matching flexível com aliases para lidar com variações de nomenclatura.
    """
    if not questao_disciplina or not edital_disciplinas:
        return False

    questao_norm = normalize_disciplina(questao_disciplina)

    # 1. Match exato
    if questao_norm in edital_disciplinas:
        return True

    # 2. Match por substring (ex: "Português" contido em "Língua Portuguesa")
    for edital_disc in edital_disciplinas:
        if questao_norm in edital_disc or edital_disc in questao_norm:
            return True

    # 3. Match por aliases
    aliases = DISCIPLINA_ALIASES.get(questao_norm, [])
    for alias in aliases:
        if alias in edital_disciplinas:
            return True

    # 4. Verificar aliases reversos (edital pode ter um alias)
    for edital_disc in edital_disciplinas:
        edital_aliases = DISCIPLINA_ALIASES.get(edital_disc, [])
        if questao_norm in edital_aliases:
            return True

    return False


def filter_questoes_by_edital(questoes: list[dict], taxonomia: dict) -> dict:
    """
    Filtra questões mantendo apenas as que correspondem às disciplinas do edital.

    Returns:
        dict com:
            - questoes_filtradas: lista de questões que correspondem ao edital
            - questoes_removidas: lista de questões removidas (para feedback)
            - stats: estatísticas do filtro
    """
    edital_disciplinas = get_edital_disciplinas(taxonomia)

    if not edital_disciplinas:
        # Sem disciplinas no edital, retorna todas
        return {
            "questoes_filtradas": questoes,
            "questoes_removidas": [],
            "stats": {
                "total_original": len(questoes),
                "total_filtrado": len(questoes),
                "total_removido": 0,
                "disciplinas_edital": [],
                "disciplinas_removidas": {},
            }
        }

    questoes_filtradas = []
    questoes_removidas = []
    disciplinas_removidas = {}

    for questao in questoes:
        questao_disc = questao.get("disciplina", "")

        if disciplina_matches_edital(questao_disc, edital_disciplinas):
            questoes_filtradas.append(questao)
        else:
            questoes_removidas.append(questao)
            # Contabilizar disciplinas removidas
            disc_key = questao_disc or "Sem disciplina"
            disciplinas_removidas[disc_key] = disciplinas_removidas.get(disc_key, 0) + 1

    return {
        "questoes_filtradas": questoes_filtradas,
        "questoes_removidas": questoes_removidas,
        "stats": {
            "total_original": len(questoes),
            "total_filtrado": len(questoes_filtradas),
            "total_removido": len(questoes_removidas),
            "disciplinas_edital": edital_disciplinas,
            "disciplinas_removidas": disciplinas_removidas,
        }
    }


@router.post("/pdf")
async def upload_pdf(
    files: List[UploadFile] = File(...), edital_id: Optional[uuid.UUID] = Query(None)
):
    """
    Upload and extract questions from multiple PDFs

    Args:
        files: PDF files
        edital_id: Optional UUID of edital to link questions to

    Returns:
        dict with extraction results for all files
    """
    try:
        # Get edital taxonomy if provided
        edital_taxonomia = None
        edital_info = None

        if edital_id:
            async for db in get_db():
                stmt = select(Edital).where(Edital.id == edital_id)
                result = await db.execute(stmt)
                edital = result.scalar_one_or_none()

                if edital:
                    edital_taxonomia = edital.taxonomia
                    edital_info = {
                        "id": str(edital.id),
                        "nome": edital.nome,
                        "banca": edital.banca,
                        "cargo": edital.cargo,
                        "ano": edital.ano,
                    }
                    logger.info(f"Linking upload to edital: {edital.nome}")
                else:
                    logger.warning(f"Edital {edital_id} not found, proceeding without taxonomy")

        # Process all files
        upload_dir = settings.raw_data_dir / "provas"
        upload_dir.mkdir(parents=True, exist_ok=True)

        results = []
        for file in files:
            try:
                # Save uploaded file
                file_path = upload_dir / file.filename
                with open(file_path, "wb") as f:
                    content = await file.read()
                    f.write(content)

                logger.info(f"File uploaded: {file_path}")

                # Detect format
                format_type = detect_pdf_format(file_path)

                # Extract based on format (PCI and GABARITO use same parser)
                if format_type in ["PCI", "GABARITO"]:
                    extraction_result = parse_pci_pdf(file_path)
                    questoes_extraidas = extraction_result["questoes"]

                    # Filtrar questões por disciplinas do edital (se vinculado)
                    if edital_taxonomia:
                        filter_result = filter_questoes_by_edital(questoes_extraidas, edital_taxonomia)
                        questoes_finais = filter_result["questoes_filtradas"]
                        filter_stats = filter_result["stats"]

                        logger.info(
                            f"Filtered questions: {filter_stats['total_filtrado']}/{filter_stats['total_original']} "
                            f"({filter_stats['total_removido']} removed)"
                        )
                        if filter_stats["disciplinas_removidas"]:
                            logger.info(f"Disciplinas removidas: {filter_stats['disciplinas_removidas']}")
                    else:
                        questoes_finais = questoes_extraidas
                        filter_stats = None

                    file_result = {
                        "success": True,
                        "filename": file.filename,
                        "format": format_type,
                        "arquivo": str(file_path),
                        "total_questoes": len(questoes_finais),
                        "total_questoes_extraidas": len(questoes_extraidas),
                        "metadados": extraction_result["metadados"],
                        "questoes": questoes_finais,
                    }

                    # Adicionar stats do filtro se aplicado
                    if filter_stats:
                        file_result["filtro_aplicado"] = True
                        file_result["filtro_stats"] = filter_stats
                    else:
                        file_result["filtro_aplicado"] = False
                else:
                    file_result = {
                        "success": False,
                        "filename": file.filename,
                        "error": f"Format {format_type} not supported yet. Only PCI/GABARITO formats are supported.",
                        "format": format_type,
                    }

                results.append(file_result)

            except Exception as file_error:
                logger.error(f"Failed to process {file.filename}: {file_error}")
                results.append({
                    "success": False,
                    "filename": file.filename,
                    "error": str(file_error),
                })

        # Build response
        total_questoes = sum(r.get("total_questoes", 0) for r in results if r["success"])
        total_questoes_extraidas = sum(r.get("total_questoes_extraidas", r.get("total_questoes", 0)) for r in results if r["success"])
        successful_files = sum(1 for r in results if r["success"])

        response = {
            "success": successful_files > 0,
            "total_files": len(files),
            "successful_files": successful_files,
            "failed_files": len(files) - successful_files,
            "total_questoes": total_questoes,
            "results": results,
        }

        # Add edital info if linked
        if edital_info:
            response["edital"] = edital_info
            response["vinculado_edital"] = True

            # Adicionar resumo do filtro no nível da resposta
            total_removidas = total_questoes_extraidas - total_questoes
            if total_removidas > 0:
                # Agregar disciplinas removidas de todos os arquivos
                disciplinas_removidas_total = {}
                for r in results:
                    if r.get("success") and r.get("filtro_stats"):
                        for disc, count in r["filtro_stats"].get("disciplinas_removidas", {}).items():
                            disciplinas_removidas_total[disc] = disciplinas_removidas_total.get(disc, 0) + count

                response["filtro_resumo"] = {
                    "total_extraidas": total_questoes_extraidas,
                    "total_validas": total_questoes,
                    "total_removidas": total_removidas,
                    "disciplinas_removidas": disciplinas_removidas_total,
                    "mensagem": f"{total_removidas} questões removidas por não corresponderem às disciplinas do edital"
                }
        else:
            response["vinculado_edital"] = False

        return response

    except Exception as e:
        logger.error(f"Upload failed: {e}")
        return {"success": False, "error": str(e)}
