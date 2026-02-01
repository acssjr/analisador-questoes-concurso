# src/extraction/vision_extractor.py
"""
Vision LLM fallback extraction.

Uses Claude Vision (Sonnet) to extract questions from PDF pages
when text-based extraction fails due to layout issues or corrupted text.
"""

import base64
import json
import os
import platform
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path
from typing import Optional

from loguru import logger


def _get_poppler_path() -> Optional[str]:
    """
    Get Poppler bin path for the current platform.

    Checks:
    1. POPPLER_PATH environment variable
    2. Common Windows installation locations
    3. None for Linux/macOS (usually in system PATH)
    """
    # Environment variable takes precedence
    env_path = os.environ.get("POPPLER_PATH")
    if env_path and Path(env_path).exists():
        return env_path

    # On Windows, check common locations
    if platform.system() == "Windows":
        home = Path.home()
        common_paths = [
            home / "poppler" / "poppler-24.08.0" / "Library" / "bin",
            home / "poppler" / "Library" / "bin",
            Path("C:/Program Files/poppler/Library/bin"),
            Path("C:/Program Files (x86)/poppler/Library/bin"),
        ]
        for path in common_paths:
            if path.exists() and (path / "pdftoppm.exe").exists():
                logger.debug(f"Found Poppler at: {path}")
                return str(path)

    # Linux/macOS: rely on system PATH
    return None


@dataclass
class VisionExtractionResult:
    """Result of Vision LLM extraction."""

    questions: list[dict] = field(default_factory=list)
    page_number: int = 0
    tokens_used: int = 0
    success: bool = True
    error: Optional[str] = None
    raw_response: Optional[str] = None


# Prompt otimizado para extração de questões via Vision
VISION_EXTRACTION_PROMPT = """Extraia todas as questões de múltipla escolha desta página de prova de concurso brasileiro.

FORMATO DE SAÍDA (JSON estrito):
{
  "questoes": [
    {
      "numero": integer,
      "disciplina": "string ou null se não identificável",
      "enunciado": "texto completo do enunciado preservando quebras de linha",
      "alternativas": {
        "A": "texto da alternativa A",
        "B": "texto da alternativa B",
        "C": "texto da alternativa C",
        "D": "texto da alternativa D",
        "E": "texto da alternativa E"
      },
      "gabarito": "A" | "B" | "C" | "D" | "E" | null
    }
  ],
  "questao_incompleta": boolean,
  "texto_continuacao": "texto que parece ser continuação de questão anterior" | null
}

REGRAS CRÍTICAS:
1. Extraia TODAS as questões visíveis, mesmo parciais
2. Se a questão começou em página anterior, inclua apenas a parte visível aqui
3. Se texto no TOPO da página (antes de "Questão N") parece ser continuação, coloque em "texto_continuacao"
4. Preserve EXATAMENTE os acentos e caracteres do português (á, é, í, ó, ú, ã, õ, ç)
5. NÃO corrija erros de ortografia - transcreva fielmente
6. Se houver imagens/figuras/tabelas no enunciado, descreva em [colchetes]
7. Respeite a ordem de leitura visual (esquerda→direita, cima→baixo, coluna por coluna)

ATENÇÃO PARA LAYOUTS DE DUAS COLUNAS:
- Processe a coluna ESQUERDA completamente primeiro
- Depois processe a coluna DIREITA
- Uma questão pode começar no fim da coluna esquerda e continuar no topo da direita

Retorne APENAS o JSON válido, sem explicações ou markdown."""


def rasterize_pdf_page(
    pdf_path: str | Path,
    page_number: int,
    dpi: int = 200,
) -> Optional[str]:
    """
    Convert a PDF page to base64-encoded PNG image.

    Args:
        pdf_path: Path to PDF file
        page_number: 0-indexed page number
        dpi: Resolution for rasterization (200 is good balance)

    Returns:
        Base64-encoded PNG string, or None if failed
    """
    try:
        from pdf2image import convert_from_path

        logger.debug(f"Rasterizing page {page_number} at {dpi} DPI")

        # Get Poppler path for Windows
        poppler_path = _get_poppler_path()
        if poppler_path:
            logger.debug(f"Using Poppler from: {poppler_path}")

        # Convert only the specific page (1-indexed for pdf2image)
        images = convert_from_path(
            pdf_path,
            dpi=dpi,
            first_page=page_number + 1,
            last_page=page_number + 1,
            fmt="PNG",
            poppler_path=poppler_path,
        )

        if not images:
            logger.error(f"No image generated for page {page_number}")
            return None

        # Convert PIL Image to base64
        img = images[0]
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        img_bytes = buffer.getvalue()

        b64_string = base64.standard_b64encode(img_bytes).decode("utf-8")

        logger.debug(f"Rasterized page {page_number}: {len(img_bytes)} bytes")
        return b64_string

    except ImportError:
        logger.error("pdf2image not installed. Run: pip install pdf2image")
        return None
    except Exception as e:
        logger.error(f"Failed to rasterize page {page_number}: {e}")
        return None


def extract_page_with_vision(
    pdf_path: str | Path,
    page_number: int,
    dpi: int = 200,
    model: str = "claude-sonnet-4-20250514",
) -> VisionExtractionResult:
    """
    Extract questions from a PDF page using Claude Vision.

    This is the fallback method when text extraction fails.

    Args:
        pdf_path: Path to PDF file
        page_number: 0-indexed page number
        dpi: Resolution for rasterization
        model: Claude model to use

    Returns:
        VisionExtractionResult with extracted questions
    """
    pdf_path = Path(pdf_path)

    # Step 1: Rasterize the page
    image_b64 = rasterize_pdf_page(pdf_path, page_number, dpi)

    if image_b64 is None:
        return VisionExtractionResult(
            page_number=page_number,
            success=False,
            error="Failed to rasterize PDF page",
        )

    # Step 2: Call Claude Vision
    try:
        import anthropic

        from src.core.config import get_settings

        settings = get_settings()
        api_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

        logger.info(f"Calling Claude Vision for page {page_number}")

        response = api_client.messages.create(
            model=model,
            max_tokens=4000,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": image_b64,
                            },
                        },
                        {
                            "type": "text",
                            "text": VISION_EXTRACTION_PROMPT,
                        },
                    ],
                }
            ],
        )

        content = response.content[0].text
        tokens_used = response.usage.input_tokens + response.usage.output_tokens

        logger.info(f"Vision extraction complete: {tokens_used} tokens")

        # Parse JSON response
        try:
            # Clean potential markdown wrapping
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]

            data = json.loads(content.strip())
            questions = data.get("questoes", [])

            # Add metadata to each question
            for q in questions:
                q["extraction_method"] = "vision"
                q["page"] = page_number

            return VisionExtractionResult(
                questions=questions,
                page_number=page_number,
                tokens_used=tokens_used,
                success=True,
                raw_response=content,
            )

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Vision response as JSON: {e}")
            return VisionExtractionResult(
                page_number=page_number,
                success=False,
                error=f"Invalid JSON response: {e}",
                raw_response=content,
            )

    except ImportError as e:
        logger.error(f"Anthropic client not available: {e}")
        return VisionExtractionResult(
            page_number=page_number,
            success=False,
            error=f"Anthropic client not installed: {e}",
        )
    except Exception as e:
        logger.error(f"Vision extraction failed: {e}")
        return VisionExtractionResult(
            page_number=page_number,
            success=False,
            error=str(e),
        )


def extract_pages_with_vision(
    pdf_path: str | Path,
    page_numbers: list[int],
    dpi: int = 200,
) -> list[VisionExtractionResult]:
    """
    Extract multiple pages with Vision LLM.

    Args:
        pdf_path: Path to PDF file
        page_numbers: List of 0-indexed page numbers
        dpi: Resolution for rasterization

    Returns:
        List of VisionExtractionResult for each page
    """
    results = []

    for page_num in page_numbers:
        result = extract_page_with_vision(pdf_path, page_num, dpi)
        results.append(result)

        # Log progress
        status = "OK" if result.success else f"FAIL: {result.error}"
        logger.info(f"Page {page_num}: {status}")

    return results
