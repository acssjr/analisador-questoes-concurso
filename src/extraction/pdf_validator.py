"""
PDF Validator - Pre-processing validation before LLM extraction

This module validates PDFs before spending tokens on LLM extraction,
checking for file existence, format, extractable text, and other
validation criteria.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import fitz  # PyMuPDF
from loguru import logger


@dataclass
class ValidationResult:
    """Result of PDF validation"""

    is_valid: bool
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    text_length: int = 0
    page_count: int = 0
    has_images: bool = False
    is_scanned: bool = False


class PDFValidator:
    """
    Validates PDFs before spending tokens on LLM extraction.

    Checks:
    1. File exists and opens correctly
    2. Not password protected
    3. Has extractable text (not pure scan/image)
    4. Text has minimum length (> 1000 chars)
    """

    MIN_TEXT_LENGTH = 1000

    def validate(self, file_path: Path) -> ValidationResult:
        """
        Validate a PDF file for processing.

        Args:
            file_path: Path to the PDF file to validate

        Returns:
            ValidationResult with is_valid=True if OK,
            or is_valid=False with error details if not.
        """
        # Check file exists
        if not file_path.exists():
            return ValidationResult(
                is_valid=False,
                error_code="FILE_NOT_FOUND",
                error_message=f"Arquivo nao encontrado: {file_path.name}",
            )

        # Check file extension
        if file_path.suffix.lower() != ".pdf":
            return ValidationResult(
                is_valid=False,
                error_code="NOT_PDF",
                error_message=f"Arquivo nao e PDF: {file_path.suffix}",
            )

        try:
            # Try to open the PDF
            doc = fitz.open(file_path)
        except Exception as e:
            logger.error(f"Failed to open PDF {file_path}: {e}")
            return ValidationResult(
                is_valid=False,
                error_code="CORRUPTED",
                error_message=f"PDF corrompido ou invalido: {str(e)[:100]}",
            )

        try:
            # Check if encrypted/password protected
            if doc.is_encrypted:
                return ValidationResult(
                    is_valid=False,
                    error_code="PASSWORD_PROTECTED",
                    error_message="PDF protegido por senha",
                )

            # Extract text from all pages
            full_text = ""
            has_images = False

            for page in doc:
                full_text += page.get_text()
                if page.get_images():
                    has_images = True

            text_length = len(full_text.strip())
            page_count = len(doc)

            # Check if it's a scanned document (images but very little text)
            is_scanned = has_images and text_length < 100 * page_count

            if is_scanned:
                return ValidationResult(
                    is_valid=False,
                    error_code="SCANNED_PDF",
                    error_message="PDF e digitalizado (imagem). OCR nao suportado ainda.",
                    text_length=text_length,
                    page_count=page_count,
                    has_images=True,
                    is_scanned=True,
                )

            # Check minimum text length
            if text_length < self.MIN_TEXT_LENGTH:
                return ValidationResult(
                    is_valid=False,
                    error_code="INSUFFICIENT_TEXT",
                    error_message=f"PDF tem pouco texto ({text_length} chars). Minimo: {self.MIN_TEXT_LENGTH}",
                    text_length=text_length,
                    page_count=page_count,
                )

            # All checks passed
            return ValidationResult(
                is_valid=True,
                text_length=text_length,
                page_count=page_count,
                has_images=has_images,
                is_scanned=False,
            )

        finally:
            doc.close()
