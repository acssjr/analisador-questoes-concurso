# src/extraction/hybrid_extractor.py
"""
Hybrid extraction pipeline with intelligent routing.

Combines Docling (free) + Claude Haiku (cheap) + Claude Vision (fallback)
for optimal cost/accuracy balance.
"""

import re
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional

from loguru import logger

from src.extraction.docling_extractor import extract_with_docling
from src.extraction.quality_checker import assess_extraction_quality
from src.extraction.vision_extractor import extract_page_with_vision


def preprocess_ocr_text(text: str) -> str:
    """
    Pre-process OCR text to fix simple issues.

    Only fixes obvious patterns that won't break valid words.

    Args:
        text: Raw OCR text

    Returns:
        Text with basic fixes applied
    """
    if not text:
        return text

    # 1. Add space after punctuation if missing
    text = re.sub(r"([,;:])([a-záéíóúâêôãõç])", r"\1 \2", text)

    # 2. Fix camelCase-like patterns (lowercase followed by uppercase word)
    text = re.sub(r"([a-záéíóúâêôãõç])([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç])", r"\1 \2", text)

    # 3. Clean up multiple spaces
    text = re.sub(r" +", " ", text)

    return text


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
        ocr_engine: str = "tesseract",  # "tesseract" or "rapidocr"
    ):
        """
        Initialize pipeline.

        Args:
            quality_threshold: Score above which Docling is accepted
            vision_threshold: Score below which Vision is used (after text correction)
            use_text_correction: Whether to try Haiku correction before Vision
            force_ocr: Force OCR on all pages (solves column bleeding in multi-column PDFs)
            ocr_engine: OCR engine - "tesseract" (better for Portuguese) or "rapidocr"
        """
        self.quality_threshold = quality_threshold
        self.vision_threshold = vision_threshold
        self.use_text_correction = use_text_correction
        self.force_ocr = force_ocr
        self.ocr_engine = ocr_engine
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
        docling_result = extract_with_docling(
            pdf_path, force_ocr=self.force_ocr, ocr_engine=self.ocr_engine
        )

        if not docling_result.success:
            logger.warning(f"Docling failed: {docling_result.error}")
            # Full Vision fallback
            return self._extract_all_with_vision_wrapped(pdf_path, pages_by_tier)

        # When force_ocr is enabled, skip quality check and go straight to LLM parsing
        # OCR text will have concatenated words and missing accents - correct them first
        if self.force_ocr:
            logger.info("Force OCR enabled - correcting text before parsing")
            pages_by_tier[ExtractionTier.DOCLING] = list(range(docling_result.page_count))

            # Pre-process with regex to fix obvious concatenations
            preprocessed_text = preprocess_ocr_text(docling_result.text)
            logger.debug(
                f"Pre-processed text: {len(docling_result.text)} -> {len(preprocessed_text)} chars"
            )

            # Then use LLM for more nuanced correction
            corrected_text = self._correct_text_with_haiku(preprocessed_text)
            questions = self._parse_questions_from_text(corrected_text)
            # Override LLM disciplines with section header positions
            questions = self._assign_disciplines_from_headers(corrected_text, questions)

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
            # Override LLM disciplines with section header positions
            questions = self._assign_disciplines_from_headers(docling_result.text, questions)

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
                # Override LLM disciplines with section header positions
                questions = self._assign_disciplines_from_headers(corrected_text, questions)

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

        Processes text in chunks to handle large documents.

        Args:
            text: Corrupted text from extraction

        Returns:
            Corrected text
        """
        # Process in chunks to handle large documents
        chunk_size = 6000  # Smaller chunks for correction (leaves room for expansion)
        overlap = 200  # Small overlap to maintain context

        if len(text) <= chunk_size:
            chunks = [text]
        else:
            chunks = []
            start = 0
            while start < len(text):
                end = min(start + chunk_size, len(text))
                # Try to break at a newline or space
                if end < len(text):
                    for i in range(end, max(start + chunk_size - 500, start), -1):
                        if text[i] in "\n ":
                            end = i + 1
                            break
                chunks.append(text[start:end])
                start = end - overlap if end < len(text) else end

        logger.info(f"Correcting OCR text in {len(chunks)} chunks")

        corrected_chunks = []
        for i, chunk in enumerate(chunks):
            try:
                prompt = f"""Corrija erros de OCR neste texto de prova de concurso em português.

PROBLEMAS COMUNS DE OCR QUE VOCÊ DEVE CORRIGIR:
1. Palavras concatenadas sem espaço:
   - "seraoessenciaisparaosucessonomercado" → "serão essenciais para o sucesso no mercado"
   - "que'saibamos'comofalar" → "que saibamos como falar"
   - "Overbodestacadonafraseencontra-seconjugadono" → "O verbo destacado na frase encontra-se conjugado no"
   - "aosoutros,estabelecendoconexoes" → "aos outros, estabelecendo conexões"

2. Confusões de caracteres:
   - 'rn' → 'm' (quando apropriado)
   - '0' → 'O' (quando é letra, não número)
   - 'l' → 'I' (quando apropriado no contexto)

3. Acentos faltantes ou errados:
   - Adicione acentos onde necessário em português
   - "questao" → "questão", "nao" → "não"

REGRAS:
- SEPARE TODAS as palavras que estão grudadas
- Preserve a estrutura original (números de questões, alternativas A-E)
- NÃO adicione ou remova conteúdo - apenas corrija a formatação
- Mantenha parágrafos e quebras de linha importantes

TEXTO:
{chunk}

TEXTO CORRIGIDO:"""

                # Try Claude first (better for Portuguese), fall back to Groq
                result = self.llm.generate(
                    prompt=prompt,
                    temperature=0.1,
                    max_tokens=8000,
                    # No preferred provider - let orchestrator try both
                )

                corrected = result.get("content", chunk)
                corrected_chunks.append(corrected)
                logger.debug(f"Corrected chunk {i + 1}/{len(chunks)}")

            except Exception as e:
                logger.error(f"Text correction failed for chunk {i + 1}: {e}")
                corrected_chunks.append(chunk)  # Use original on error

        # Join corrected chunks
        return "\n".join(corrected_chunks)

    def _assign_disciplines_from_headers(self, text: str, questions: list[dict]) -> list[dict]:
        """
        Override LLM-assigned disciplines with position-based detection from section headers.

        Scans the text for discipline section headers (e.g., "Língua Portuguesa", "Matemática")
        and assigns each question's discipline based on which header precedes it in the text.

        Args:
            text: The full extracted text (same text used for parsing)
            questions: List of question dicts from LLM parsing

        Returns:
            Questions with corrected discipline assignments
        """
        # Find section headers in the text.
        # Headers must be standalone lines (not embedded in sentences).
        # We use MULTILINE + ^ to match line starts, and $ for line ends.
        # This avoids false positives from mid-sentence discipline words.
        #
        # The pattern uses flexible accent matching (. for accented chars) since
        # OCR text may have mangled accents.
        discipline_pattern = (
            r"^\s*"
            r"("
            r"L.ngua\s+Portuguesa"
            r"|Portugu.s"
            r"|Matem.tica\s+e\s+Racioc.nio\s+L.gico"
            r"|Racioc.nio\s+L.gico"
            r"|Inform.tica"
            r"|Legisla..o[^\n]{0,60}"
            r"|No..es\s+de[^\n]{0,60}"
            r"|Conhecimentos\s+(?:Espec.ficos|Gerais)[^\n]{0,60}"
            r"|Direito\s+(?:Constitucional|Administrativo|Penal|Civil|Tribut.rio|Processual)[^\n]{0,30}"
            r")"
            r"\s*$"
        )
        raw_matches = list(re.finditer(discipline_pattern, text, re.IGNORECASE | re.MULTILINE))

        # Build final header list, merging multi-line headers.
        # e.g., "Legislação Básica aplicada à\nAdministração Pública"
        # The regex only matches the first line; we grab the continuation.
        merged_headers: list[tuple[int, str]] = []
        for m in raw_matches:
            header_text = m.group(1).strip()
            pos = m.start()

            # Check if header ends with a preposition (à, a, ao, de, do, e, em, para)
            # indicating continuation on the next line
            if re.search(r"\b(?:à|a|ao|de|do|e|em|para)\s*$", header_text, re.IGNORECASE):
                # Grab the next non-empty line as continuation
                after_match = text[m.end() :]
                # Skip leading whitespace/newlines to find next content line
                lines_after = after_match.split("\n")
                continuation = ""
                for line in lines_after:
                    stripped = line.strip()
                    if stripped:
                        continuation = stripped
                        break
                # Only merge if continuation is short (a title, not question text)
                if (
                    continuation
                    and len(continuation) < 60
                    and not re.search(r"quest[aã]o|correta|\d{2,}", continuation, re.IGNORECASE)
                ):
                    header_text = f"{header_text} {continuation}"

            merged_headers.append((pos, header_text))

        if not merged_headers:
            logger.warning("No discipline section headers found in text - keeping LLM assignments")
            return questions

        logger.info(f"Found {len(merged_headers)} discipline section headers:")
        for pos, header in merged_headers:
            logger.info(f"  - '{header}' at position {pos}")

        def get_discipline_for_position(pos: int) -> str | None:
            """Find the discipline that applies to a given text position."""
            current_disc = None
            for header_pos, header_text in merged_headers:
                if header_pos < pos:
                    current_disc = header_text
                else:
                    break
            return current_disc

        # For each question, find its position in text and assign discipline
        for q in questions:
            numero = q.get("numero")
            if numero is None:
                continue

            # Search for "Questão N" or just the question number pattern in text
            q_patterns = [
                rf"Quest[aã]o\s*0*{numero}\b",
                rf"(?:^|\n)\s*0*{numero}\s*[\.\)]\s",
                rf"(?:^|\n)\s*0*{numero}\s*[-–]\s",
            ]

            best_pos = None
            for pat in q_patterns:
                match = re.search(pat, text, re.IGNORECASE)
                if match:
                    best_pos = match.start()
                    break

            if best_pos is not None:
                header_disc = get_discipline_for_position(best_pos)
                if header_disc:
                    old_disc = q.get("disciplina", "N/A")
                    if old_disc != header_disc:
                        logger.debug(
                            f"Q{numero}: discipline '{old_disc}' -> '{header_disc}' (from header)"
                        )
                    q["disciplina"] = header_disc
            else:
                logger.debug(f"Q{numero}: could not find position in text, keeping LLM assignment")

        return questions

    def _parse_questions_from_text(self, text: str) -> list[dict]:
        """
        Parse questions from extracted text using LLM.

        Processes text in chunks to avoid LLM token limits (8192 max output).
        Each chunk is processed separately, then results are merged with deduplication.

        Args:
            text: Extracted/corrected text

        Returns:
            List of question dictionaries
        """
        from src.extraction.llm_parser import EXTRACTION_SYSTEM_PROMPT, parse_llm_response

        # Split text into chunks of ~8000 chars with overlap
        # This ensures each chunk can be processed without truncation
        chunk_size = 8000
        overlap = 1000
        chunks = []

        if len(text) <= chunk_size:
            chunks = [text]
        else:
            start = 0
            while start < len(text):
                end = start + chunk_size
                chunk = text[start:end]
                chunks.append(chunk)
                start = end - overlap  # Overlap to catch questions at boundaries

        logger.info(f"Processing text in {len(chunks)} chunks")

        all_questions = []
        for i, chunk in enumerate(chunks):
            logger.info(f"Processing chunk {i + 1}/{len(chunks)} ({len(chunk)} chars)")

            prompt = f"""Analise o texto abaixo extraído de uma prova de concurso e extraia TODAS as questões.

TEXTO:
{chunk}

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
                    logger.info(f"Chunk {i + 1}: found {len(questions)} questions")
                    all_questions.extend(questions)

            except Exception as e:
                logger.error(f"Chunk {i + 1} parsing failed: {e}")

        # Deduplicate by question number, keeping most complete version
        questions_by_number: dict[int, dict] = {}
        for q in all_questions:
            num = q.get("numero")
            if num is None:
                continue

            # Score completeness: more alternatives + longer enunciado = better
            alternativas = q.get("alternativas") or {}
            enunciado = q.get("enunciado") or ""
            completeness = len(alternativas) * 10 + len(enunciado)

            existing = questions_by_number.get(num)
            if existing is None:
                questions_by_number[num] = {"question": q, "score": completeness}
            elif completeness > existing["score"]:
                questions_by_number[num] = {"question": q, "score": completeness}

        # Sort by question number and return
        unique_questions = [
            questions_by_number[num]["question"] for num in sorted(questions_by_number.keys())
        ]

        logger.info(
            f"Parsed {len(unique_questions)} unique questions from {len(all_questions)} total"
        )
        return unique_questions

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
    ocr_engine: str = "tesseract",
) -> HybridExtractionResult:
    """
    Extract questions using hybrid pipeline.

    This is the main entry point for the new extraction system.

    Args:
        pdf_path: Path to PDF file
        expected_questions: Expected number of questions (for validation)
        ocr_engine: OCR engine - "tesseract" (better for Portuguese) or "rapidocr"

    Returns:
        HybridExtractionResult with questions and metadata
    """
    pipeline = HybridExtractionPipeline(ocr_engine=ocr_engine)
    return pipeline.extract(pdf_path, expected_questions)
