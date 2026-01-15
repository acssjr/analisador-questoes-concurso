"""
Image extraction from PDFs
"""

from pathlib import Path
from typing import Optional

import fitz  # PyMuPDF
from loguru import logger
from PIL import Image

from src.core.config import get_settings
from src.core.exceptions import ImageExtractionError

settings = get_settings()


def extract_images_from_page(
    pdf_path: str | Path, page_num: int, output_dir: Optional[Path] = None
) -> list[dict]:
    """
    Extract all images from a specific PDF page

    Args:
        pdf_path: Path to PDF
        page_num: Page number (0-indexed)
        output_dir: Directory to save images (default: data/processed/imagens)

    Returns:
        list of dicts with image info: {"arquivo": path, "tipo": "figura", "descricao_ocr": ""}
    """
    if output_dir is None:
        output_dir = settings.processed_data_dir / "imagens"
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        doc = fitz.open(pdf_path)
        if page_num >= len(doc):
            logger.warning(f"Page {page_num} does not exist in {pdf_path}")
            return []

        page = doc[page_num]
        image_list = page.get_images(full=True)

        extracted_images = []

        for img_index, img_info in enumerate(image_list):
            xref = img_info[0]
            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]
            image_ext = base_image["ext"]

            # Save image
            pdf_name = Path(pdf_path).stem
            image_filename = f"{pdf_name}_p{page_num}_img{img_index}.{image_ext}"
            image_path = output_dir / image_filename

            with open(image_path, "wb") as f:
                f.write(image_bytes)

            logger.debug(f"Extracted image: {image_path}")

            extracted_images.append(
                {
                    "arquivo": str(image_path),
                    "tipo": "imagem_generica",  # Will be classified later
                    "descricao_ocr": "",  # Will be filled by OCR
                    "essencial": False,  # Will be determined later
                }
            )

        doc.close()
        return extracted_images

    except Exception as e:
        logger.error(f"Failed to extract images from page {page_num}: {e}")
        raise ImageExtractionError(f"Failed to extract images: {e}")


def extract_all_images_from_pdf(pdf_path: str | Path) -> dict[int, list[dict]]:
    """
    Extract images from all pages of PDF

    Args:
        pdf_path: Path to PDF

    Returns:
        dict mapping page_num -> list of image dicts
    """
    try:
        doc = fitz.open(pdf_path)
        images_by_page = {}

        for page_num in range(len(doc)):
            images = extract_images_from_page(pdf_path, page_num)
            if images:
                images_by_page[page_num] = images

        doc.close()

        total_images = sum(len(imgs) for imgs in images_by_page.values())
        logger.info(f"Extracted {total_images} images from {len(images_by_page)} pages")

        return images_by_page

    except Exception as e:
        logger.error(f"Failed to extract images from PDF: {e}")
        raise ImageExtractionError(f"Failed to extract images: {e}")


def classify_image_type(image_path: Path) -> str:
    """
    Classify image type (basic heuristics, can be enhanced with LLM)

    Args:
        image_path: Path to image

    Returns:
        str: 'figura_geometrica', 'grafico', 'tabela', 'charge', 'foto', 'outro'
    """
    try:
        img = Image.open(image_path)
        width, height = img.size

        # Simple heuristics (placeholder - should use LLM for better classification)
        aspect_ratio = width / height

        if 0.8 < aspect_ratio < 1.2 and width < 800:
            return "figura_geometrica"
        elif aspect_ratio > 1.5 or aspect_ratio < 0.7:
            return "grafico"
        else:
            return "imagem_generica"

    except Exception as e:
        logger.warning(f"Failed to classify image type: {e}")
        return "outro"
