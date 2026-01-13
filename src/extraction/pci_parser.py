"""
PCI Concursos PDF parser
"""
import re
from pathlib import Path
from typing import Optional

import fitz  # PyMuPDF
from loguru import logger

from src.core.exceptions import ExtractionError
from src.extraction.image_extractor import extract_images_from_page
from src.extraction.pdf_detector import inferir_banca_cargo_ano


def parse_pci_pdf(pdf_path: str | Path) -> dict:
    """
    Parse PCI Concursos PDF format

    Supports two formats:
    1. Legacy PCI: "15. [Português - Sintaxe]" with "Resposta: C"
    2. IDCAP/PCI: "Questão 03" with "(Correta: C)" next to it

    Args:
        pdf_path: Path to PCI PDF

    Returns:
        dict with:
            - metadados: {banca, cargo, ano}
            - questoes: list of questão dicts

    Raises:
        ExtractionError: If parsing fails
    """
    try:
        doc = fitz.open(pdf_path)
        logger.info(f"Parsing PCI PDF: {pdf_path} ({len(doc)} pages)")

        # Extract all text
        full_text = ""
        for page in doc:
            full_text += page.get_text()

        # Infer metadata
        metadados = inferir_banca_cargo_ano(pdf_path, full_text[:1000])

        # Try both patterns
        questoes = []

        # Pattern 1: Legacy PCI format "15. [Português - Sintaxe]"
        legacy_pattern = r"(\d+)\.\s*\[([^\]]+)\]"
        legacy_matches = list(re.finditer(legacy_pattern, full_text))

        # Pattern 2: IDCAP/PCI format "Questão 03" or "Questão 03\n(Correta: C)"
        idcap_pattern = r"Quest[aã]o\s*(\d+)\s*(?:\n|\s)*(?:\(Correta:\s*([A-E])\))?"
        idcap_matches = list(re.finditer(idcap_pattern, full_text, re.IGNORECASE))

        # Use whichever pattern found more questions
        if len(legacy_matches) >= len(idcap_matches) and len(legacy_matches) > 0:
            logger.info(f"Using legacy PCI format ({len(legacy_matches)} questions found)")
            matches = legacy_matches
            use_legacy = True
        elif len(idcap_matches) > 0:
            logger.info(f"Using IDCAP/PCI format ({len(idcap_matches)} questions found)")
            matches = idcap_matches
            use_legacy = False
        else:
            logger.warning("No questions found with any pattern")
            doc.close()
            return {"metadados": metadados, "questoes": []}

        # Detect current discipline from section headers
        discipline_pattern = r"(?:^|\n)\s*((?:Língua\s+Portuguesa|Matemática|Raciocínio\s+Lógico|Informática|Legislação|Conhecimentos\s+Específicos|Noções\s+de)[^\n]*)"
        discipline_matches = list(re.finditer(discipline_pattern, full_text, re.IGNORECASE))

        def get_discipline_for_position(pos: int) -> str | None:
            """Find the discipline that applies to a given text position"""
            current_disc = None
            for dm in discipline_matches:
                if dm.start() < pos:
                    current_disc = dm.group(1).strip()
                else:
                    break
            return current_disc

        for i, match in enumerate(matches):
            numero = int(match.group(1))

            if use_legacy:
                categorias = match.group(2).strip()
                categorias_parts = [p.strip() for p in categorias.split("-")]
                disciplina = categorias_parts[0] if len(categorias_parts) > 0 else None
                assunto_pci = categorias_parts[1] if len(categorias_parts) > 1 else None
                gabarito_from_header = None
            else:
                # IDCAP format - discipline from section header
                disciplina = get_discipline_for_position(match.start())
                assunto_pci = None
                # Gabarito may be in the match group
                gabarito_from_header = match.group(2) if match.lastindex and match.lastindex >= 2 else None

            # Extract question block (until next question or end)
            start_pos = match.end()
            if i + 1 < len(matches):
                end_pos = matches[i + 1].start()
            else:
                end_pos = len(full_text)

            question_block = full_text[start_pos:end_pos].strip()

            # Parse question block
            try:
                questao = parse_pci_question_block(
                    numero=numero,
                    disciplina=disciplina,
                    assunto_pci=assunto_pci,
                    block_text=question_block,
                    pdf_path=pdf_path,
                    page_num=match.start() // 2000,
                    gabarito_override=gabarito_from_header,
                )
                questoes.append(questao)
            except Exception as e:
                logger.error(f"Failed to parse question {numero}: {e}")
                questoes.append(
                    {
                        "numero": numero,
                        "disciplina": disciplina,
                        "assunto_pci": assunto_pci,
                        "enunciado": question_block[:200],
                        "alternativas": {},
                        "gabarito": gabarito_from_header,
                        "anulada": False,
                        "status_extracao": "revisar_manual",
                        "alertas": [f"Erro ao parsear: {str(e)}"],
                    }
                )

        doc.close()

        logger.info(f"Extracted {len(questoes)} questions from PCI PDF")

        return {"metadados": metadados, "questoes": questoes}

    except Exception as e:
        logger.error(f"Failed to parse PCI PDF: {e}")
        raise ExtractionError(f"Failed to parse PCI PDF: {e}")


def parse_pci_question_block(
    numero: int,
    disciplina: Optional[str],
    assunto_pci: Optional[str],
    block_text: str,
    pdf_path: Path,
    page_num: int,
    gabarito_override: Optional[str] = None,
) -> dict:
    """
    Parse a single PCI question block

    Args:
        numero: Question number
        disciplina: Disciplina extracted from [...]
        assunto_pci: Assunto from PCI categorization
        block_text: Text block of the question
        pdf_path: PDF path for image extraction
        page_num: Page number (rough)

    Returns:
        dict with question data
    """
    # Check if anulada
    anulada = "ANULADA" in block_text.upper()

    # Extract gabarito - use override if provided, otherwise look for patterns
    gabarito = None
    if gabarito_override and not anulada:
        gabarito = gabarito_override
    else:
        # Try "Resposta: C" pattern
        gabarito_match = re.search(r"Resposta:\s*([A-E])", block_text)
        if gabarito_match and not anulada:
            gabarito = gabarito_match.group(1)
        else:
            # Try "(Correta: C)" pattern
            correta_match = re.search(r"\(Correta:\s*([A-E])\)", block_text)
            if correta_match and not anulada:
                gabarito = correta_match.group(1)

    # Extract alternativas (A) ... B) ... etc)
    alternativas = {}
    alt_pattern = r"([A-E])\)\s*(.+?)(?=[A-E]\)|Resposta:|$)"
    alt_matches = re.findall(alt_pattern, block_text, re.DOTALL)

    for letra, texto in alt_matches:
        alternativas[letra] = texto.strip()

    # If not found with ), try with .
    if not alternativas:
        alt_pattern = r"([A-E])\.?\s*(.+?)(?=[A-E]\.?\s|Resposta:|$)"
        alt_matches = re.findall(alt_pattern, block_text, re.DOTALL)
        for letra, texto in alt_matches:
            alternativas[letra] = texto.strip()

    # Enunciado: everything before first alternativa
    enunciado = block_text
    if alternativas:
        first_alt = list(alternativas.keys())[0]
        enunciado_match = re.search(rf"(.+?)(?={first_alt}\))", block_text, re.DOTALL)
        if enunciado_match:
            enunciado = enunciado_match.group(1).strip()

    # Remove "Resposta:" from enunciado if present
    enunciado = re.sub(r"Resposta:.*$", "", enunciado, flags=re.MULTILINE).strip()

    # Validate
    alertas = []
    status = "ok"

    if len(enunciado) < 10:
        alertas.append("Enunciado muito curto")
        status = "revisar_manual"

    if len(alternativas) != 5:
        alertas.append(f"Número de alternativas inválido: {len(alternativas)}")
        status = "revisar_manual"

    return {
        "numero": numero,
        "disciplina": disciplina,
        "assunto_pci": assunto_pci,
        "enunciado": enunciado,
        "alternativas": alternativas,
        "gabarito": gabarito,
        "anulada": anulada,
        "motivo_anulacao": None,  # TODO: extract if available
        "tem_imagem": False,  # TODO: detect images
        "imagens": None,
        "texto_imagem_ocr": None,
        "metadados": {},
        "status_extracao": status,
        "alertas": alertas,
        "fonte": "PCI_Concursos",
    }
