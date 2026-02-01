# tests/extraction/test_quality_checker.py
"""Tests for extraction quality checker."""

from src.extraction.quality_checker import (
    QualityMetrics,
    assess_extraction_quality,
    needs_vision_fallback,
)


class TestQualityMetrics:
    """Test QualityMetrics dataclass."""

    def test_score_calculation_perfect(self):
        """Perfect extraction should have score near 1.0."""
        metrics = QualityMetrics(
            spell_error_rate=0.0,
            long_word_ratio=0.0,
            valid_word_ratio=1.0,
            word_count=100,
        )
        assert metrics.score >= 0.95

    def test_score_calculation_poor(self):
        """Poor extraction should have low score."""
        metrics = QualityMetrics(
            spell_error_rate=0.5,
            long_word_ratio=0.2,
            valid_word_ratio=0.5,
            word_count=100,
        )
        assert metrics.score < 0.5

    def test_needs_correction_threshold(self):
        """Score below threshold should need correction."""
        metrics = QualityMetrics(
            spell_error_rate=0.3,
            long_word_ratio=0.1,
            valid_word_ratio=0.7,
            word_count=100,
        )
        assert metrics.needs_correction(threshold=0.80) is True


class TestAssessExtractionQuality:
    """Test assess_extraction_quality function."""

    def test_good_portuguese_text(self):
        """Well-extracted Portuguese text should score high."""
        text = """
        A questão trata de interpretação de texto em língua portuguesa.
        O candidato deve analisar o trecho apresentado e identificar
        a alternativa correta conforme o enunciado da questão.
        """
        metrics = assess_extraction_quality(text)
        assert metrics.score >= 0.70
        assert metrics.spell_error_rate < 0.20

    def test_concatenated_words(self):
        """Text with concatenated words should have high long_word_ratio."""
        # Mix of normal words and concatenated words to exceed 10 word threshold
        text = """
        Aquestãotratadetextoconcatenadoquenãofoiseparadocorretamente
        Estaspalavrassãomuitolongasporqueforamjuntadaserronamente
        texto normal aqui para teste
        outra frase com palavras simples
        mais uma linha de texto correto
        palavrasjuntassemespaçoaquitambém
        """
        metrics = assess_extraction_quality(text)
        # At least 3 of 15+ words are long concatenations (>18 chars)
        assert metrics.long_word_ratio > 0.15

    def test_insufficient_text(self):
        """Very short text should return zero score."""
        text = "abc"
        metrics = assess_extraction_quality(text)
        assert metrics.score == 0.0
        assert metrics.word_count < 10


class TestNeedsVisionFallback:
    """Test needs_vision_fallback convenience function."""

    def test_good_text_no_fallback(self):
        """Good quality text should not need vision fallback."""
        text = """
        Esta é uma questão de múltipla escolha sobre direito constitucional.
        O candidato deve marcar a alternativa que melhor corresponde ao
        entendimento do Supremo Tribunal Federal sobre a matéria.
        """
        assert needs_vision_fallback(text) is False

    def test_bad_text_needs_fallback(self):
        """Poor quality text should need vision fallback."""
        text = "Estéétextocorrompidocommuitoserrosdextraçãoepalavrasjuntas"
        assert needs_vision_fallback(text) is True
