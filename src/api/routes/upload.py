"""
Upload routes - for PDF upload and extraction
"""
import re
import unicodedata
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, File, Query, UploadFile
from loguru import logger
from sqlalchemy import select

from src.core.config import get_settings
from src.core.database import get_db, AsyncSessionLocal
from src.extraction.pci_parser import parse_pci_pdf
from src.extraction.pdf_detector import detect_pdf_format
from src.extraction.llm_parser import extract_questions_with_llm, extract_questions_chunked
from src.llm.llm_orchestrator import LLMOrchestrator
from src.models.edital import Edital
from src.models.projeto import Projeto
from src.models.prova import Prova
from src.models.questao import Questao

settings = get_settings()
router = APIRouter()


# Mapeamento de variações comuns de nomes de disciplinas (SEM ACENTOS - normalizado)
DISCIPLINA_ALIASES = {
    # Português
    "portugues": ["lingua portuguesa", "portugues", "redacao", "interpretacao de texto"],
    "lingua portuguesa": ["portugues", "lingua portuguesa", "redacao"],
    # Matemática e Raciocínio
    "matematica": ["matematica", "raciocinio logico", "raciocinio logico-matematico", "rlm", "matematica e raciocinio logico"],
    "raciocinio logico": ["matematica", "raciocinio logico", "raciocinio logico-matematico", "rlm", "matematica e raciocinio logico"],
    "raciocinio logico-matematico": ["matematica", "raciocinio logico", "rlm"],
    "matematica e raciocinio logico": ["matematica", "raciocinio logico", "rlm"],
    # Informática
    "informatica": ["informatica", "nocoes de informatica", "tecnologia da informacao", "ti", "tecnologia"],
    "nocoes de informatica": ["informatica", "nocoes de informatica"],
    "tecnologia": ["informatica", "tecnologia"],
    # Direitos
    "direito constitucional": ["direito constitucional", "constitucional"],
    "direito administrativo": ["direito administrativo", "administrativo"],
    "direito penal": ["direito penal", "penal"],
    "direito civil": ["direito civil", "civil"],
    "direito tributario": ["direito tributario", "tributario"],
    "direito processual": ["direito processual", "processual"],
    # Administração
    "administracao": ["administracao", "administracao publica", "adm"],
    "administracao publica": ["administracao", "administracao publica"],
    # Contabilidade
    "contabilidade": ["contabilidade", "contabilidade geral", "contabilidade publica"],
    "contabilidade geral": ["contabilidade", "contabilidade geral"],
    # Economia
    "economia": ["economia", "economia brasileira", "macroeconomia", "microeconomia"],
    # AFO
    "afo": ["afo", "administracao financeira e orcamentaria", "orcamento publico"],
    "administracao financeira e orcamentaria": ["afo", "administracao financeira e orcamentaria"],
    # Legislação
    "legislacao": ["legislacao", "legislacao basica", "nocoes de legislacao"],
    "legislacao basica": ["legislacao", "legislacao basica"],
    # Outros
    "atualidades": ["atualidades", "conhecimentos gerais", "realidade brasileira"],
    "conhecimentos gerais": ["atualidades", "conhecimentos gerais"],
    # Redação
    "redacao": ["redacao", "portugues", "lingua portuguesa"],
}


def remove_accents(text: str) -> str:
    """Remove accents from text for comparison"""
    nfkd = unicodedata.normalize('NFKD', text)
    return ''.join(c for c in nfkd if not unicodedata.combining(c))


def normalize_disciplina(nome: str) -> str:
    """Normaliza nome de disciplina para comparação (lowercase, sem acentos)"""
    if not nome:
        return ""
    return remove_accents(nome.lower().strip())


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
    files: List[UploadFile] = File(...),
    edital_id: Optional[uuid.UUID] = Query(None),
    projeto_id: Optional[uuid.UUID] = Query(None),
    filter_by_edital: bool = Query(True, description="Filter questions by edital disciplines"),
):
    """
    Upload and extract questions from multiple PDFs.

    Creates Prova and Questao records in the database when linked to a projeto.

    Args:
        files: PDF files
        edital_id: Optional UUID of edital to link questions to
        projeto_id: Optional UUID of projeto to link provas to
        filter_by_edital: Whether to filter questions by edital disciplines (default: True)

    Returns:
        dict with extraction results for all files
    """
    try:
        # Use session as context manager to keep it open throughout
        async with AsyncSessionLocal() as db_session:
            # Get edital taxonomy and projeto info
            edital_taxonomia = None
            edital_info = None
            projeto = None

            # If projeto_id provided, get projeto and its edital
            if projeto_id:
                from sqlalchemy.orm import selectinload
                stmt = select(Projeto).options(selectinload(Projeto.edital)).where(Projeto.id == projeto_id)
                result = await db_session.execute(stmt)
                projeto = result.scalar_one_or_none()

                if projeto and projeto.edital:
                    edital_taxonomia = projeto.edital.taxonomia
                    edital_info = {
                        "id": str(projeto.edital.id),
                        "nome": projeto.edital.nome,
                        "banca": projeto.edital.banca,
                        "cargo": projeto.edital.cargo,
                        "ano": projeto.edital.ano,
                    }
                    logger.info(f"Linking upload to projeto: {projeto.nome}")
                elif projeto:
                    logger.info(f"Projeto {projeto_id} found but has no edital linked")
                else:
                    logger.warning(f"Projeto {projeto_id} not found")

            # If edital_id provided (and no projeto), get edital and its projeto
            elif edital_id:
                stmt = select(Edital).where(Edital.id == edital_id)
                result = await db_session.execute(stmt)
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
                    # Get projeto from edital
                    if edital.projeto_id:
                        stmt = select(Projeto).where(Projeto.id == edital.projeto_id)
                        result = await db_session.execute(stmt)
                        projeto = result.scalar_one_or_none()
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

                    # Extract using LLM (more robust than regex)
                    # Falls back to regex parser if LLM fails
                    if format_type in ["PCI", "GABARITO", "PROVA_GENERICA"]:
                        try:
                            # Use LLM for intelligent extraction (chunked for large PDFs)
                            llm = LLMOrchestrator()
                            extraction_result = extract_questions_chunked(file_path, llm, pages_per_chunk=4)
                            questoes_extraidas = extraction_result["questoes"]
                            logger.info(f"LLM extracted {len(questoes_extraidas)} questions from {file.filename}")
                        except Exception as llm_error:
                            # Fallback to regex parser
                            logger.warning(f"LLM extraction failed, falling back to regex: {llm_error}")
                            extraction_result = parse_pci_pdf(file_path)
                            questoes_extraidas = extraction_result["questoes"]

                        # Filtrar questões por disciplinas do edital (se vinculado e flag ativa)
                        if edital_taxonomia and filter_by_edital:
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
                            if edital_taxonomia and not filter_by_edital:
                                logger.info("Filter by edital disabled - keeping all questions")

                        # Create Prova and Questao records if projeto available
                        prova_id = None
                        if projeto:
                            try:
                                # Calculate confidence score
                                total_confianca = sum(
                                    q.get("confianca_score", 50) for q in questoes_finais
                                ) if questoes_finais else 0
                                media_confianca = total_confianca / len(questoes_finais) if questoes_finais else 0
                                total_anuladas = sum(1 for q in questoes_finais if q.get("anulada", False))

                                # Create Prova record
                                prova = Prova(
                                    nome=file.filename,
                                    banca=extraction_result["metadados"].get("banca") or projeto.banca,
                                    cargo=extraction_result["metadados"].get("cargo") or projeto.cargo,
                                    ano=extraction_result["metadados"].get("ano") or projeto.ano,
                                    fonte=format_type,
                                    arquivo_original=str(file_path),
                                    projeto_id=projeto.id,
                                    total_questoes=len(questoes_finais),
                                    total_anuladas=total_anuladas,
                                    status="extraido",
                                    queue_status="completed",
                                    queue_checkpoint="questions_extracted",
                                    confianca_media=media_confianca,
                                    metadados=extraction_result["metadados"],
                                )
                                db_session.add(prova)
                                await db_session.flush()  # Get the prova.id
                                prova_id = prova.id
                                logger.info(f"Created Prova record: {prova.id}")

                                # Create Questao records
                                for q in questoes_finais:
                                    questao = Questao(
                                        prova_id=prova.id,
                                        numero=q.get("numero", 0),
                                        disciplina=q.get("disciplina"),
                                        enunciado=q.get("enunciado", ""),
                                        alternativas=q.get("alternativas", {}),
                                        gabarito=q.get("gabarito"),
                                        anulada=q.get("anulada", False),
                                        motivo_anulacao=q.get("motivo_anulacao"),
                                        assunto_pci=q.get("assunto_pci") or q.get("assunto"),
                                        confianca_score=q.get("confianca_score"),
                                        status_extracao=q.get("status_extracao", "ok"),
                                        metadados=q.get("metadados", {}),
                                    )
                                    db_session.add(questao)

                                await db_session.commit()
                                logger.info(f"Created {len(questoes_finais)} Questao records for prova {prova.id}")

                            except Exception as db_error:
                                logger.error(f"Failed to persist to database: {db_error}")
                                await db_session.rollback()
                                # Continue with response even if DB fails

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

                        # Add prova_id if persisted
                        if prova_id:
                            file_result["prova_id"] = str(prova_id)

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

            # Update projeto counters if we have a projeto and saved data
            if projeto:
                try:
                    # Calculate totals from successful results that were persisted
                    provas_criadas = sum(1 for r in results if r.get("success") and r.get("prova_id"))
                    questoes_criadas = sum(r.get("total_questoes", 0) for r in results if r.get("success") and r.get("prova_id"))
                    anuladas_criadas = sum(
                        sum(1 for q in r.get("questoes", []) if q.get("anulada", False))
                        for r in results if r.get("success") and r.get("prova_id")
                    )

                    # Refresh projeto from DB to get current counts
                    await db_session.refresh(projeto)

                    # Update counters
                    projeto.total_provas = (projeto.total_provas or 0) + provas_criadas
                    projeto.total_questoes = (projeto.total_questoes or 0) + questoes_criadas
                    projeto.total_questoes_validas = (projeto.total_questoes_validas or 0) + (questoes_criadas - anuladas_criadas)
                    projeto.total_anuladas = (projeto.total_anuladas or 0) + anuladas_criadas

                    await db_session.commit()
                    logger.info(f"Updated projeto counters: {projeto.total_provas} provas, {projeto.total_questoes} questoes")

                except Exception as counter_error:
                    logger.error(f"Failed to update projeto counters: {counter_error}")
                    # Don't fail the whole request for counter update failure

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
