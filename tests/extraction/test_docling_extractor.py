# tests/extraction/test_docling_extractor.py
"""Tests for Docling-based PDF extraction."""

import pytest
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

from src.extraction.docling_extractor import (
    extract_with_docling,
    DoclingExtractionResult,
)


class TestDoclingExtractor:
    """Test Docling extraction functions."""

    def test_result_dataclass(self):
        """DoclingExtractionResult should store all fields."""
        result = DoclingExtractionResult(
            text="Test content",
            markdown="# Test\n\nTest content",
            page_count=5,
            tables=[{"header": ["A", "B"], "rows": [["1", "2"]]}],
            success=True,
            error=None,
        )
        assert result.success is True
        assert result.page_count == 5
        assert len(result.tables) == 1

    @patch("docling.document_converter.DocumentConverter")
    def test_extract_with_docling_success(self, mock_converter_class):
        """Successful extraction should return text and markdown."""
        # Setup mock
        mock_doc = MagicMock()
        mock_doc.export_to_markdown.return_value = "# Questão 1\n\nEnunciado"
        mock_doc.export_to_text.return_value = "Questão 1 Enunciado"
        mock_doc.tables = []

        mock_result = MagicMock()
        mock_result.document = mock_doc

        mock_converter = MagicMock()
        mock_converter.convert.return_value = mock_result
        mock_converter_class.return_value = mock_converter

        # Create a temp file for the test
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            f.write(b"%PDF-1.4 fake content")
            temp_path = f.name

        try:
            # Execute
            result = extract_with_docling(temp_path)

            # Assert
            assert result.success is True
            assert "Questão" in result.text
            assert result.markdown is not None
        finally:
            import os
            os.unlink(temp_path)

    @patch("docling.document_converter.DocumentConverter")
    def test_extract_with_docling_failure(self, mock_converter_class):
        """Failed extraction should return error."""
        mock_converter = MagicMock()
        mock_converter.convert.side_effect = Exception("PDF corrupted")
        mock_converter_class.return_value = mock_converter

        # Create a temp file for the test
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            f.write(b"%PDF-1.4 fake content")
            temp_path = f.name

        try:
            result = extract_with_docling(temp_path)

            assert result.success is False
            assert "PDF corrupted" in result.error
        finally:
            import os
            os.unlink(temp_path)

    def test_extract_file_not_found(self):
        """Non-existent file should return error."""
        result = extract_with_docling("nonexistent.pdf")
        assert result.success is False
        assert "not found" in result.error.lower()


class TestDoclingIntegration:
    """Integration tests with real PDFs (skip if no test data)."""

    @pytest.fixture
    def sample_pdf_path(self):
        """Path to a sample test PDF."""
        # Use an existing test PDF if available
        paths = [
            Path("data/raw/provas/PROVA UNEB 2024 TÉCNICO UNIVERSITÁRIO.pdf"),
            Path("tests/fixtures/sample_prova.pdf"),
        ]
        for p in paths:
            if p.exists():
                return p
        pytest.skip("No test PDF available")

    @pytest.mark.integration
    def test_real_pdf_extraction(self, sample_pdf_path):
        """Extract real PDF and verify structure."""
        result = extract_with_docling(str(sample_pdf_path))

        assert result.success is True
        assert result.page_count > 0
        assert len(result.text) > 1000  # Substantial content
        # Should find question markers
        assert "Questão" in result.text or "QUESTÃO" in result.text
