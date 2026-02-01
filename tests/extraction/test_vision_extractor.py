# tests/extraction/test_vision_extractor.py
"""Tests for Vision LLM fallback extraction."""

import base64
from unittest.mock import MagicMock, patch

import pytest

from src.extraction.vision_extractor import (
    VISION_EXTRACTION_PROMPT,
    VisionExtractionResult,
    extract_page_with_vision,
    rasterize_pdf_page,
)


class TestVisionExtractionResult:
    """Test VisionExtractionResult dataclass."""

    def test_result_fields(self):
        """Result should store all fields."""
        result = VisionExtractionResult(
            questions=[{"numero": 1, "enunciado": "Test"}],
            page_number=0,
            tokens_used=1500,
            success=True,
        )
        assert result.success is True
        assert len(result.questions) == 1


class TestRasterizePdfPage:
    """Test PDF rasterization."""

    @patch("pdf2image.convert_from_path")
    def test_rasterize_returns_base64(self, mock_convert):
        """Rasterization should return base64-encoded PNG."""
        # Create mock PIL Image
        mock_image = MagicMock()

        # Mock save method to write to buffer
        def mock_save(buffer, format):
            buffer.write(b"fake_png_data")
        mock_image.save.side_effect = mock_save

        mock_convert.return_value = [mock_image]

        result = rasterize_pdf_page("test.pdf", page_number=0, dpi=200)

        assert result is not None
        # Should be valid base64
        try:
            decoded = base64.b64decode(result)
            assert len(decoded) > 0
        except Exception:
            pytest.fail("Result is not valid base64")

    @patch("pdf2image.convert_from_path")
    def test_rasterize_failure_returns_none(self, mock_convert):
        """Failed rasterization should return None."""
        mock_convert.side_effect = Exception("Poppler not found")

        result = rasterize_pdf_page("test.pdf", page_number=0)

        assert result is None


class TestExtractPageWithVision:
    """Test Vision LLM extraction."""

    @patch("anthropic.Anthropic")
    @patch("src.core.config.get_settings")
    @patch("pdf2image.convert_from_path")
    def test_extract_success(self, mock_convert, mock_settings, mock_anthropic_class):
        """Successful Vision extraction should return questions."""
        # Setup pdf2image mock
        mock_image = MagicMock()
        def mock_save(buffer, format):
            buffer.write(b"fake_png_data")
        mock_image.save.side_effect = mock_save
        mock_convert.return_value = [mock_image]

        # Setup settings mock
        mock_settings.return_value.anthropic_api_key = "test-key"

        # Setup anthropic mock
        mock_response = MagicMock()
        mock_response.content = [MagicMock(
            text='{"questoes": [{"numero": 1, "enunciado": "Test", "alternativas": {"A": "a", "B": "b", "C": "c", "D": "d", "E": "e"}}]}'
        )]
        mock_response.usage.input_tokens = 1000
        mock_response.usage.output_tokens = 500

        mock_client = MagicMock()
        mock_client.messages.create.return_value = mock_response
        mock_anthropic_class.return_value = mock_client

        result = extract_page_with_vision("test.pdf", page_number=0)

        assert result.success is True
        assert len(result.questions) == 1
        assert result.questions[0]["numero"] == 1

    @patch("pdf2image.convert_from_path")
    def test_extract_rasterize_failure(self, mock_convert):
        """Failed rasterization should return error."""
        mock_convert.side_effect = Exception("Poppler not found")

        result = extract_page_with_vision("test.pdf", page_number=0)

        assert result.success is False
        assert "rasterize" in result.error.lower()


class TestVisionPrompt:
    """Test Vision extraction prompt."""

    def test_prompt_includes_json_format(self):
        """Prompt should specify JSON output format."""
        assert "JSON" in VISION_EXTRACTION_PROMPT or "json" in VISION_EXTRACTION_PROMPT

    def test_prompt_includes_portuguese_handling(self):
        """Prompt should mention Portuguese characters."""
        assert "português" in VISION_EXTRACTION_PROMPT.lower() or "acentos" in VISION_EXTRACTION_PROMPT.lower()
