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

        # Split by question numbers
        questoes = []
        pattern = r"(\d+)\.\s*\[([^\]]+)\]"  # "15. [Português - Sintaxe]"
        matches = list(re.finditer(pattern, full_text))

        for i, match in enumerate(matches):
            numero = int(match.group(1))
            categorias = match.group(2).strip()  # "Português - Sintaxe"

            # Extract disciplina e assunto
            categorias_parts = [p.strip() for p in categorias.split("-")]
            disciplina = categorias_parts[0] if len(categorias_parts) > 0 else None
            assunto_pci = categorias_parts[1] if len(categorias_parts) > 1 else None

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
                    page_num=match.start() // 2000,  # Rough page estimation
                )
                questoes.append(questao)
            except Exception as e:
                logger.error(f"Failed to parse question {numero}: {e}")
                # Create placeholder with error
                questoes.append(
                    {
                        "numero": numero,
                        "disciplina": disciplina,
                        "assunto_pci": assunto_pci,
                        "enunciado": question_block[:200],
                        "alternativas": {},
                        "gabarito": None,
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

    # Extract gabarito
    gabarito_match = re.search(r"Resposta:\s*([A-E])", block_text)
    gabarito = gabarito_match.group(1) if gabarito_match and not anulada else None

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
