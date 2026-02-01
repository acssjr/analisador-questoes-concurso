# tests/extraction/test_hybrid_extractor.py
"""Tests for hybrid extraction pipeline."""

from unittest.mock import MagicMock, patch

from src.extraction.hybrid_extractor import (
    ExtractionTier,
    HybridExtractionPipeline,
    HybridExtractionResult,
)


class TestExtractionTier:
    """Test ExtractionTier enum."""

    def test_tier_values(self):
        """All tiers should be defined."""
        assert ExtractionTier.DOCLING.value == "docling"
        assert ExtractionTier.TEXT_LLM.value == "text_llm"
        assert ExtractionTier.VISION_LLM.value == "vision_llm"


class TestHybridExtractionResult:
    """Test HybridExtractionResult dataclass."""

    def test_result_fields(self):
        """Result should store all required fields."""
        result = HybridExtractionResult(
            questions=[{"numero": 1}],
            tier_used=ExtractionTier.DOCLING,
            quality_score=0.85,
            pages_by_tier={
                ExtractionTier.DOCLING: [0, 1, 2],
                ExtractionTier.VISION_LLM: [3],
            },
            total_pages=4,
            success=True,
        )
        assert result.success
        assert result.vision_fallback_rate == 0.25  # 1/4 pages

    def test_vision_fallback_rate_zero_pages(self):
        """Zero pages should return 0 fallback rate."""
        result = HybridExtractionResult(
            questions=[],
            tier_used=ExtractionTier.DOCLING,
            quality_score=0.0,
            pages_by_tier={},
            total_pages=0,
            success=False,
        )
        assert result.vision_fallback_rate == 0.0


class TestHybridExtractionPipeline:
    """Test hybrid extraction pipeline."""

    @patch("src.extraction.hybrid_extractor.extract_with_docling")
    @patch("src.extraction.hybrid_extractor.assess_extraction_quality")
    def test_docling_only_good_quality(self, mock_quality, mock_docling):
        """Good quality extraction should use Docling only."""
        # Setup mocks
        mock_docling.return_value = MagicMock(
            success=True,
            text="Questão 1 sobre português. Alternativas A B C D E.",
            page_count=2,
        )
        mock_quality.return_value = MagicMock(
            score=0.90,
            needs_correction=lambda threshold=0.8: False,
        )

        pipeline = HybridExtractionPipeline()

        with patch.object(pipeline, "_parse_questions_from_text") as mock_parse:
            mock_parse.return_value = [{"numero": 1}]
            result = pipeline.extract("test.pdf")

        assert result.success
        assert ExtractionTier.DOCLING in result.pages_by_tier
        # Vision should not have any pages
        vision_pages = result.pages_by_tier.get(ExtractionTier.VISION_LLM, [])
        assert len(vision_pages) == 0

    @patch("src.extraction.hybrid_extractor.extract_with_docling")
    @patch("src.extraction.hybrid_extractor.assess_extraction_quality")
    def test_vision_fallback_bad_quality(self, mock_quality, mock_docling):
        """Poor quality extraction should trigger Vision fallback."""
        # Setup mocks
        mock_docling.return_value = MagicMock(
            success=True,
            text="Textocorrompidosemespaços",
            page_count=1,
        )
        mock_quality.return_value = MagicMock(
            score=0.30,
            needs_correction=lambda threshold=0.8: True,
        )

        # force_ocr=False so quality check path is exercised (default is True which skips it)
        pipeline = HybridExtractionPipeline(force_ocr=False)

        # Mock the vision wrapper directly since score < vision_threshold (0.60)
        # skips Tier 2 and goes straight to _extract_all_with_vision_wrapped
        with patch.object(pipeline, "_extract_all_with_vision_wrapped") as mock_vision_wrapped:
            mock_vision_wrapped.return_value = HybridExtractionResult(
                questions=[{"numero": 1, "enunciado": "Questão correta"}],
                tier_used=ExtractionTier.VISION_LLM,
                quality_score=0.95,
                pages_by_tier={ExtractionTier.VISION_LLM: [0]},
                total_pages=1,
                success=True,
            )
            result = pipeline.extract("test.pdf")

        assert result.success
        assert mock_vision_wrapped.called
        assert result.tier_used == ExtractionTier.VISION_LLM

    @patch("src.extraction.hybrid_extractor.extract_with_docling")
    def test_docling_failure_uses_vision(self, mock_docling):
        """Docling failure should trigger full Vision extraction."""
        mock_docling.return_value = MagicMock(
            success=False,
            error="PDF corrupted",
        )

        pipeline = HybridExtractionPipeline()

        with patch.object(pipeline, "_extract_all_with_vision_wrapped") as mock_vision:
            mock_vision.return_value = HybridExtractionResult(
                questions=[{"numero": 1}],
                tier_used=ExtractionTier.VISION_LLM,
                quality_score=0.95,
                pages_by_tier={ExtractionTier.VISION_LLM: [0]},
                total_pages=1,
                success=True,
            )
            result = pipeline.extract("test.pdf")

        assert mock_vision.called
        assert result.tier_used == ExtractionTier.VISION_LLM

    def test_pipeline_initialization_defaults(self):
        """Pipeline should initialize with default thresholds."""
        pipeline = HybridExtractionPipeline()
        assert pipeline.quality_threshold == 0.80
        assert pipeline.vision_threshold == 0.60
        assert pipeline.use_text_correction is True

    def test_pipeline_initialization_custom(self):
        """Pipeline should accept custom thresholds."""
        pipeline = HybridExtractionPipeline(
            quality_threshold=0.90,
            vision_threshold=0.50,
            use_text_correction=False,
        )
        assert pipeline.quality_threshold == 0.90
        assert pipeline.vision_threshold == 0.50
        assert pipeline.use_text_correction is False
