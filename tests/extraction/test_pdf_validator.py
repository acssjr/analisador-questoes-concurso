"""
Tests for PDF Validator Service

TDD tests for pre-processing PDF validation before LLM extraction.
"""
import pytest
from pathlib import Path
from src.extraction.pdf_validator import PDFValidator, ValidationResult


def test_validator_returns_result():
    """Validator should return ValidationResult with status and details"""
    validator = PDFValidator()

    # Create a simple test - we'll mock the actual PDF
    result = validator.validate(Path("nonexistent.pdf"))

    assert isinstance(result, ValidationResult)
    assert hasattr(result, 'is_valid')
    assert hasattr(result, 'error_code')
    assert hasattr(result, 'error_message')
    assert hasattr(result, 'text_length')


def test_validator_rejects_nonexistent_file():
    """Validator should reject files that don't exist"""
    validator = PDFValidator()
    result = validator.validate(Path("this_file_does_not_exist.pdf"))

    assert result.is_valid is False
    assert result.error_code == "FILE_NOT_FOUND"


def test_validator_rejects_non_pdf_extension():
    """Validator should reject files without .pdf extension"""
    validator = PDFValidator()
    # Use a file that exists but isn't a PDF
    result = validator.validate(Path(__file__))  # This test file itself

    assert result.is_valid is False
    assert result.error_code == "NOT_PDF"


def test_validation_result_has_all_fields():
    """ValidationResult should have all expected fields"""
    result = ValidationResult(
        is_valid=True,
        text_length=5000,
        page_count=10,
        has_images=True,
        is_scanned=False
    )

    assert result.is_valid is True
    assert result.error_code is None
    assert result.error_message is None
    assert result.text_length == 5000
    assert result.page_count == 10
    assert result.has_images is True
    assert result.is_scanned is False


def test_validation_result_error_fields():
    """ValidationResult should properly hold error information"""
    result = ValidationResult(
        is_valid=False,
        error_code="CORRUPTED",
        error_message="PDF file is corrupted",
        text_length=0,
        page_count=0
    )

    assert result.is_valid is False
    assert result.error_code == "CORRUPTED"
    assert result.error_message == "PDF file is corrupted"


class TestPDFValidatorWithRealFiles:
    """Tests using real PDF files from the project"""

    def test_valid_pdf_with_sufficient_text(self, tmp_path):
        """A valid PDF with enough text should pass validation"""
        import fitz

        # Create a simple PDF with enough text
        pdf_path = tmp_path / "valid_test.pdf"
        doc = fitz.open()
        page = doc.new_page()

        # Add enough text to pass MIN_TEXT_LENGTH (1000 chars)
        # Insert multiple lines to ensure we have enough text
        y_pos = 50
        line = "Test content for PDF validation purposes. "  # ~42 chars
        for i in range(30):  # 30 lines * ~42 chars = ~1260 chars
            page.insert_text((50, y_pos), line)
            y_pos += 20

        doc.save(str(pdf_path))
        doc.close()

        validator = PDFValidator()
        result = validator.validate(pdf_path)

        assert result.is_valid is True
        assert result.text_length > 1000
        assert result.page_count == 1
        assert result.error_code is None

    def test_pdf_with_insufficient_text(self, tmp_path):
        """A PDF with too little text should fail validation"""
        import fitz

        # Create a PDF with minimal text
        pdf_path = tmp_path / "short_text.pdf"
        doc = fitz.open()
        page = doc.new_page()
        page.insert_text((50, 50), "Short text")  # Very little text
        doc.save(str(pdf_path))
        doc.close()

        validator = PDFValidator()
        result = validator.validate(pdf_path)

        assert result.is_valid is False
        assert result.error_code == "INSUFFICIENT_TEXT"
        assert result.text_length < 1000

    def test_corrupted_pdf_file(self, tmp_path):
        """A corrupted file should be rejected"""
        # Create a file that's not a valid PDF
        corrupted_path = tmp_path / "corrupted.pdf"
        corrupted_path.write_text("This is not a valid PDF content")

        validator = PDFValidator()
        result = validator.validate(corrupted_path)

        assert result.is_valid is False
        assert result.error_code == "CORRUPTED"

    def test_min_text_length_configurable(self):
        """MIN_TEXT_LENGTH should be accessible for configuration"""
        validator = PDFValidator()
        assert hasattr(validator, 'MIN_TEXT_LENGTH')
        assert validator.MIN_TEXT_LENGTH == 1000
