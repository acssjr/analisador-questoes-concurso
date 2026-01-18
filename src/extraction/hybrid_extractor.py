# src/extraction/hybrid_extractor.py
"""
Hybrid extraction pipeline with intelligent routing.

Combines Docling (free) + Claude Haiku (cheap) + Claude Vision (fallback)
for optimal cost/accuracy balance.
"""

from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional

from loguru import logger

from src.extraction.docling_extractor import extract_with_docling
from src.extraction.quality_checker import assess_extraction_quality
from src.extraction.vision_extractor import extract_page_with_vision


class ExtractionTier(Enum):
    """Extraction method tiers."""
    DOCLING = "docling"
    TEXT_LLM = "text_llm"  # Claude Haiku for text correction
    VISION_LLM = "vision_llm"  # Claude Sonnet Vision


@dataclass
class HybridExtractionResult:
    """Result of hybrid extraction pipeline."""

    questions: list[dict] = field(default_factory=list)
    tier_used: ExtractionTier = ExtractionTier.DOCLING
    quality_score: float = 0.0
    pages_by_tier: dict[ExtractionTier, list[int]] = field(default_factory=dict)
    total_pages: int = 0
    success: bool = True
    error: Optional[str] = None

    @property
    def vision_fallback_rate(self) -> float:
        """Proportion of pages that needed Vision fallback."""
        if self.total_pages == 0:
            return 0.0
        vision_pages = len(self.pages_by_tier.get(ExtractionTier.VISION_LLM, []))
        return vision_pages / self.total_pages


class HybridExtractionPipeline:
    """
    Intelligent extraction pipeline with 3 tiers.

    Tier 1: Docling (free, handles columns well)
    Tier 2: Claude Haiku (cheap, corrects OCR errors)
    Tier 3: Claude Vision (expensive, 95%+ accuracy)

    Routes based on quality metrics to minimize cost while maximizing accuracy.
    """

    def __init__(
        self,
        quality_threshold: float = 0.80,
        vision_threshold: float = 0.60,
        use_text_correction: bool = True,
        force_ocr: bool = True,  # Default True for multi-column PDFs
    ):
        """
        Initialize pipeline.

        Args:
            quality_threshold: Score above which Docling is accepted
            vision_threshold: Score below which Vision is used (after text correction)
            use_text_correction: Whether to try Haiku correction before Vision
            force_ocr: Force OCR on all pages (solves column bleeding in multi-column PDFs)
        """
        self.quality_threshold = quality_threshold
        self.vision_threshold = vision_threshold
        self.use_text_correction = use_text_correction
        self.force_ocr = force_ocr
        self._llm = None

    @property
    def llm(self):
        """Lazy load LLM orchestrator."""
        if self._llm is None:
            from src.llm.llm_orchestrator import LLMOrchestrator
            self._llm = LLMOrchestrator()
        return self._llm

    def extract(
        self,
        pdf_path: str | Path,
        expected_questions: Optional[int] = None,
    ) -> HybridExtractionResult:
        """
        Extract questions using hybrid pipeline.

        Args:
            pdf_path: Path to PDF file
            expected_questions: Expected number of questions (for validation)

        Returns:
            HybridExtractionResult with questions and metadata
        """
        pdf_path = Path(pdf_path)
        pages_by_tier: dict[ExtractionTier, list[int]] = {
            ExtractionTier.DOCLING: [],
            ExtractionTier.TEXT_LLM: [],
            ExtractionTier.VISION_LLM: [],
        }

        logger.info(f"Starting hybrid extraction: {pdf_path.name}")

        # TIER 1: Try Docling first (with optional forced OCR for multi-column PDFs)
        docling_result = extract_with_docling(pdf_path, force_ocr=self.force_ocr)

        if not docling_result.success:
            logger.warning(f"Docling failed: {docling_result.error}")
            # Full Vision fallback
            return self._extract_all_with_vision_wrapped(pdf_path, pages_by_tier)

        # When force_ocr is enabled, skip quality check and go straight to LLM parsing
        # OCR text will have concatenated words and missing accents that LLM can fix
        if self.force_ocr:
            logger.info("Force OCR enabled - skipping quality check, using LLM parser directly")
            pages_by_tier[ExtractionTier.DOCLING] = list(range(docling_result.page_count))

            questions = self._parse_questions_from_text(docling_result.text)

            return HybridExtractionResult(
                questions=questions,
                tier_used=ExtractionTier.DOCLING,
                quality_score=1.0,  # Assume good since OCR bypasses quality check
                pages_by_tier=pages_by_tier,
                total_pages=docling_result.page_count,
                success=True,
            )

        # Assess quality (only when not using forced OCR)
        quality = assess_extraction_quality(docling_result.text)
        logger.info(f"Docling quality score: {quality.score:.3f}")

        if quality.score >= self.quality_threshold:
            # Good quality - parse directly
            logger.info("Quality OK - using Docling extraction")
            pages_by_tier[ExtractionTier.DOCLING] = list(range(docling_result.page_count))

            questions = self._parse_questions_from_text(docling_result.text)

            return HybridExtractionResult(
                questions=questions,
                tier_used=ExtractionTier.DOCLING,
                quality_score=quality.score,
                pages_by_tier=pages_by_tier,
                total_pages=docling_result.page_count,
                success=True,
            )

        # TIER 2: Try text correction with Haiku
        if self.use_text_correction and quality.score >= self.vision_threshold:
            logger.info("Trying text correction with Claude Haiku")
            corrected_text = self._correct_text_with_haiku(docling_result.text)
            corrected_quality = assess_extraction_quality(corrected_text)

            if corrected_quality.score >= self.quality_threshold:
                logger.info(f"Text correction improved quality: {corrected_quality.score:.3f}")
                pages_by_tier[ExtractionTier.TEXT_LLM] = list(range(docling_result.page_count))

                questions = self._parse_questions_from_text(corrected_text)

                return HybridExtractionResult(
                    questions=questions,
                    tier_used=ExtractionTier.TEXT_LLM,
                    quality_score=corrected_quality.score,
                    pages_by_tier=pages_by_tier,
                    total_pages=docling_result.page_count,
                    success=True,
                )

        # TIER 3: Vision fallback
        logger.info("Quality still poor - using Vision fallback")
        return self._extract_all_with_vision_wrapped(pdf_path, pages_by_tier)

    def _correct_text_with_haiku(self, text: str) -> str:
        """
        Correct OCR errors using Claude Haiku (cheap).

        Args:
            text: Corrupted text from extraction

        Returns:
            Corrected text
        """
        try:
            prompt = f"""Corrija erros de OCR neste texto de prova de concurso em português.

REGRAS:
1. Separe palavras concatenadas (ex: "Aquestão" → "A questão")
2. Corrija confusões de caracteres: 'rn'→'m', 'l'→'I', '0'→'O'
3. Preserve a estrutura original (questões, alternativas)
4. NÃO adicione conteúdo - apenas corrija erros
5. Mantenha números de questões e letras de alternativas

TEXTO:
{text[:8000]}

TEXTO CORRIGIDO:"""

            result = self.llm.generate(
                prompt=prompt,
                temperature=0.1,
                max_tokens=8000,
                prefer_fast=True,  # Use Haiku if available
            )

            return result.get("content", text)

        except Exception as e:
            logger.error(f"Text correction failed: {e}")
            return text

    def _parse_questions_from_text(self, text: str) -> list[dict]:
        """
        Parse questions from extracted text using LLM.

        Args:
            text: Extracted/corrected text

        Returns:
            List of question dictionaries
        """
        from src.extraction.llm_parser import EXTRACTION_SYSTEM_PROMPT, parse_llm_response

        prompt = f"""Analise o texto abaixo extraído de uma prova de concurso e extraia TODAS as questões.

TEXTO:
{text}

Extraia todas as questões no formato JSON especificado."""

        try:
            result = self.llm.generate(
                prompt=prompt,
                system_prompt=EXTRACTION_SYSTEM_PROMPT,
                temperature=0.1,
                max_tokens=8192,
            )

            response_text = result.get("content", "")
            parsed = parse_llm_response(response_text)

            if parsed:
                questions = parsed.get("questoes", [])
                logger.info(f"Parsed {len(questions)} questions from text")
                return questions

            return []

        except Exception as e:
            logger.error(f"Question parsing failed: {e}")
            return []

    def _extract_all_with_vision_wrapped(
        self,
        pdf_path: Path,
        pages_by_tier: dict,
    ) -> HybridExtractionResult:
        """Wrapper for full Vision extraction."""
        # Check if file exists
        if not pdf_path.exists():
            return HybridExtractionResult(
                questions=[],
                tier_used=ExtractionTier.VISION_LLM,
                quality_score=0.0,
                pages_by_tier=pages_by_tier,
                total_pages=0,
                success=False,
                error=f"File not found: {pdf_path}",
            )

        try:
            questions = self._extract_all_with_vision(pdf_path)

            # Get page count
            import fitz
            doc = fitz.open(pdf_path)
            page_count = len(doc)
            doc.close()

            pages_by_tier[ExtractionTier.VISION_LLM] = list(range(page_count))

            return HybridExtractionResult(
                questions=questions,
                tier_used=ExtractionTier.VISION_LLM,
                quality_score=0.95,  # Vision assumed high quality
                pages_by_tier=pages_by_tier,
                total_pages=page_count,
                success=len(questions) > 0,
                error=None if questions else "No questions extracted",
            )
        except Exception as e:
            logger.error(f"Vision extraction failed: {e}")
            return HybridExtractionResult(
                questions=[],
                tier_used=ExtractionTier.VISION_LLM,
                quality_score=0.0,
                pages_by_tier=pages_by_tier,
                total_pages=0,
                success=False,
                error=str(e),
            )

    def _extract_all_with_vision(self, pdf_path: Path) -> list[dict]:
        """
        Extract all pages with Vision LLM.

        Args:
            pdf_path: Path to PDF file

        Returns:
            List of all questions from all pages
        """
        import fitz

        doc = fitz.open(pdf_path)
        page_count = len(doc)
        doc.close()

        all_questions = []

        for page_num in range(page_count):
            logger.info(f"Vision extraction: page {page_num + 1}/{page_count}")

            result = extract_page_with_vision(pdf_path, page_num)

            if result.success:
                all_questions.extend(result.questions)
            else:
                logger.warning(f"Vision failed for page {page_num}: {result.error}")

        # Deduplicate by question number
        seen_numbers = set()
        unique_questions = []
        for q in all_questions:
            num = q.get("numero")
            if num not in seen_numbers:
                seen_numbers.add(num)
                unique_questions.append(q)

        logger.info(f"Vision extracted {len(unique_questions)} unique questions")
        return unique_questions


# Convenience function
def extract_questions_hybrid(
    pdf_path: str | Path,
    expected_questions: Optional[int] = None,
) -> HybridExtractionResult:
    """
    Extract questions using hybrid pipeline.

    This is the main entry point for the new extraction system.

    Args:
        pdf_path: Path to PDF file
        expected_questions: Expected number of questions (for validation)

    Returns:
        HybridExtractionResult with questions and metadata
    """
    pipeline = HybridExtractionPipeline()
    return pipeline.extract(pdf_path, expected_questions)
