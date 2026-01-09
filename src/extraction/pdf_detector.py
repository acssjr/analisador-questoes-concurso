"""
PDF format detector - detects PCI vs generic format
"""
import re
from pathlib import Path
from typing import Literal

import fitz  # PyMuPDF
from loguru import logger

from src.core.exceptions import PDFFormatError


PDFFormat = Literal["PCI", "PROVA_GENERICA", "GABARITO"]


def detect_pdf_format(pdf_path: str | Path) -> PDFFormat:
    """
    Detect PDF format by analyzing content patterns

    Args:
        pdf_path: Path to PDF file

    Returns:
        PDFFormat: 'PCI', 'PROVA_GENERICA', or 'GABARITO'

    Raises:
        PDFFormatError: If format cannot be determined
    """
    try:
        doc = fitz.open(pdf_path)
        # Extract first 3 pages for analysis
        sample_text = ""
        for page_num in range(min(3, len(doc))):
            sample_text += doc[page_num].get_text()
        doc.close()

        logger.debug(f"Analyzing PDF: {pdf_path}")

        # Check for PCI patterns (prova completa com questões + respostas)
        pci_patterns = [
            r"\d+\.\s*\[.*?\]",  # "15. [Português - Sintaxe]" - questão com categoria
            r"Resposta:\s*[A-E]",  # "Resposta: C" ao lado da questão
            r"(?i)ANULADA",  # Marcação de anulação
            r"(?i)PCI\s+Concursos",  # Logo PCI
        ]

        # Check if has question content (enunciados longos, alternativas)
        has_question_content = bool(
            re.search(r"\([A-E]\)\s+.{20,}", sample_text) or  # (A) texto longo
            re.search(r"[A-E]\)\s+.{20,}", sample_text)  # A) texto longo
        )

        pci_matches = sum(1 for p in pci_patterns if re.search(p, sample_text))

        # Se tem questões formatadas E respostas, é PCI
        if pci_matches >= 2 or (pci_matches >= 1 and has_question_content):
            logger.info(f"Detected PCI Concursos format (prova com respostas)")
            return "PCI"

        # Check for gabarito-only patterns (apenas respostas, sem questões completas)
        gabarito_patterns = [
            r"(?i)gabarito",  # Palavra gabarito
            r"\d+[.\-\s]+[A-E]\s*$",  # "1. C" em linha isolada
            r"(?i)Quest[aã]o\s+\d+:\s*[A-E]\s*$",  # "Questão 5: C" em linha isolada
        ]

        gabarito_matches = sum(1 for p in gabarito_patterns if re.search(p, sample_text, re.MULTILINE))

        # Gabarito verdadeiro: tem respostas mas NÃO tem questões completas
        if gabarito_matches >= 1 and not has_question_content:
            logger.info(f"Detected Gabarito format (apenas respostas)")
            return "GABARITO"

        # Default: generic prova format
        logger.info(f"Detected generic prova format")
        return "PROVA_GENERICA"

    except Exception as e:
        logger.error(f"Error detecting PDF format: {e}")
        raise PDFFormatError(f"Failed to detect PDF format: {e}")


def extract_pdf_metadata(pdf_path: str | Path) -> dict:
    """
    Extract metadata from PDF

    Args:
        pdf_path: Path to PDF file

    Returns:
        dict: Metadata information
    """
    try:
        doc = fitz.open(pdf_path)
        metadata = doc.metadata
        doc.close()

        return {
            "title": metadata.get("title", ""),
            "author": metadata.get("author", ""),
            "subject": metadata.get("subject", ""),
            "creator": metadata.get("creator", ""),
            "producer": metadata.get("producer", ""),
            "total_pages": len(doc),
        }
    except Exception as e:
        logger.warning(f"Failed to extract metadata: {e}")
        return {}


def inferir_banca_cargo_ano(pdf_path: str | Path, text_sample: str = "") -> dict:
    """
    Infer banca, cargo, and ano from PDF filename and content

    Args:
        pdf_path: Path to PDF
        text_sample: Sample text from PDF (optional)

    Returns:
        dict with banca, cargo, ano
    """
    filename = Path(pdf_path).stem.lower()
    result = {"banca": None, "cargo": None, "ano": None}

    # Common bancas
    bancas = [
        "fcc",
        "cespe",
        "cesgranrio",
        "vunesp",
        "fgv",
        "quadrix",
        "ibfc",
        "aocp",
        "fundatec",
    ]

    for banca in bancas:
        if banca in filename or (text_sample and banca in text_sample.lower()):
            result["banca"] = banca.upper()
            break

    # Extract year (4 digits)
    year_match = re.search(r"(20\d{2})", filename)
    if year_match:
        result["ano"] = int(year_match.group(1))

    # Try to extract cargo (between banca and year usually)
    cargo_match = re.search(r"(?:fcc|cespe|vunesp)[\-_](.+?)[\-_](?:20\d{2})", filename)
    if cargo_match:
        result["cargo"] = cargo_match.group(1).replace("_", " ").title()

    return result
