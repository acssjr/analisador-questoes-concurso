# tests/integration/test_hybrid_extraction_e2e.py
"""End-to-end tests for hybrid extraction pipeline."""

from pathlib import Path

import pytest

from src.extraction.hybrid_extractor import (
    ExtractionTier,
    extract_questions_hybrid,
)


@pytest.fixture
def sample_pdf_path():
    """Path to sample exam PDF."""
    paths = [
        Path("data/raw/provas/PROVA UNEB 2024 TÉCNICO UNIVERSITÁRIO.pdf"),
        Path("tests/fixtures/sample_prova.pdf"),
    ]
    for p in paths:
        if p.exists():
            return p
    pytest.skip("No test PDF available")


@pytest.mark.integration
@pytest.mark.slow
class TestHybridExtractionE2E:
    """End-to-end integration tests."""

    def test_full_extraction_returns_result(self, sample_pdf_path):
        """Extract real PDF and verify basic structure."""
        result = extract_questions_hybrid(sample_pdf_path)

        # Should return a result (success or failure)
        assert result is not None
        assert hasattr(result, 'success')
        assert hasattr(result, 'questions')
        assert hasattr(result, 'tier_used')

    def test_extraction_tier_tracking(self, sample_pdf_path):
        """Verify tier usage is tracked correctly."""
        result = extract_questions_hybrid(sample_pdf_path)

        assert result.tier_used in ExtractionTier
        assert result.pages_by_tier is not None

        # At least one tier should have pages if successful
        if result.success:
            total_tracked = sum(
                len(pages) for pages in result.pages_by_tier.values()
            )
            assert total_tracked > 0

    def test_quality_score_in_range(self, sample_pdf_path):
        """Quality score should be in valid range."""
        result = extract_questions_hybrid(sample_pdf_path)

        assert 0.0 <= result.quality_score <= 1.0

    def test_vision_fallback_rate_reasonable(self, sample_pdf_path):
        """Vision fallback should be tracked."""
        result = extract_questions_hybrid(sample_pdf_path)

        # Fallback rate should be in valid range
        assert 0.0 <= result.vision_fallback_rate <= 1.0


@pytest.mark.integration
class TestHybridExtractionWithMockPDF:
    """Tests with minimal mocks for faster execution."""

    @pytest.fixture
    def mock_pdf_path(self, tmp_path):
        """Create a minimal PDF for testing."""
        # Create a simple PDF file
        pdf_path = tmp_path / "test.pdf"
        # Minimal PDF content (not a real PDF but enough for file existence check)
        pdf_path.write_bytes(b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF")
        return pdf_path

    def test_nonexistent_file_handling(self):
        """Extraction should handle missing files gracefully."""
        result = extract_questions_hybrid("/nonexistent/path/to/file.pdf")

        # Should fail gracefully, not crash
        assert result.success is False or result.questions == []

    def test_invalid_pdf_handling(self, mock_pdf_path):
        """Extraction should handle invalid PDFs gracefully."""
        result = extract_questions_hybrid(mock_pdf_path)

        # Should fail gracefully with error message
        # (The minimal PDF is not valid for Docling)
        assert result.success is False or len(result.questions) == 0


@pytest.mark.integration
class TestExtractionQualityMetrics:
    """Tests for extraction quality metrics."""

    def test_good_text_quality_score(self):
        """Good text should have high quality score."""
        from src.extraction.quality_checker import assess_extraction_quality

        good_text = """
        Questão 1. A Constituição Federal estabelece que a República
        Federativa do Brasil constitui-se em Estado Democrático de Direito
        e tem como fundamentos a soberania, a cidadania, a dignidade da
        pessoa humana, os valores sociais do trabalho e da livre iniciativa
        e o pluralismo político.

        A) Somente a afirmativa I está correta.
        B) Somente as afirmativas I e II estão corretas.
        C) Somente as afirmativas II e III estão corretas.
        D) Todas as afirmativas estão corretas.
        E) Nenhuma das afirmativas está correta.
        """
        metrics = assess_extraction_quality(good_text)

        assert metrics.score >= 0.60
        assert metrics.long_word_ratio < 0.10

    def test_corrupted_text_detected(self):
        """Corrupted/concatenated text should be detected."""
        from src.extraction.quality_checker import assess_extraction_quality

        # Mix normal and concatenated words
        corrupted_text = """
        Aquestãotratadedireitoconstitucionalefundamentos
        texto normal aqui para passar o limite minimo
        outra frase com palavras normais aqui
        mais uma linha de texto correto
        """
        metrics = assess_extraction_quality(corrupted_text)

        # Should detect concatenation
        assert metrics.long_word_ratio > 0.05 or metrics.spell_error_rate > 0.20
