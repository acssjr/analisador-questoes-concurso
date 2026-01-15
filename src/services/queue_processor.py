# src/services/queue_processor.py
"""
Queue Processor - Handles PDF processing with state machine

The QueueProcessor is the core service that orchestrates the PDF
processing pipeline:
1. Validates PDFs using PDFValidator
2. Extracts questions using the LLM parser
3. Scores questions using ConfidenceScorer
4. Returns a ProcessingResult with final status
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

from loguru import logger

from src.extraction.confidence_scorer import ConfidenceScorer
from src.extraction.llm_parser import extract_questions_chunked
from src.extraction.pdf_validator import PDFValidator
from src.llm.llm_orchestrator import LLMOrchestrator


@dataclass
class ProcessingResult:
    """Result of processing a prova"""

    success: bool
    status: str  # final status: completed, partial, failed, retry
    questoes_count: int = 0
    questoes_revisao: int = 0  # questions needing manual review
    confianca_media: float = 0.0
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    checkpoint: Optional[str] = None
    questoes: List[dict] = field(default_factory=list)


class QueueProcessor:
    """
    Processes PDFs through a state machine:
    pending -> validating -> processing -> completed/partial/failed

    Features:
    - Pre-validation before spending tokens
    - Confidence scoring per question
    - Checkpoints for recovery
    - Retry with fallback on rate limits
    """

    STATES = ["pending", "validating", "processing", "completed", "partial", "failed", "retry"]

    def __init__(self):
        self.validator = PDFValidator()
        self.scorer = ConfidenceScorer()
        self.llm: Optional[LLMOrchestrator] = None

    def process_prova(
        self, prova, edital_disciplinas: Optional[List[str]] = None
    ) -> ProcessingResult:
        """
        Process a single prova through the pipeline.

        Args:
            prova: Prova model instance (or mock with arquivo_original)
            edital_disciplinas: List of normalized discipline names

        Returns:
            ProcessingResult with status and extracted questions
        """
        file_path = Path(prova.arquivo_original) if prova.arquivo_original else None

        if not file_path:
            return ProcessingResult(
                success=False,
                status="failed",
                error_code="NO_FILE",
                error_message="Prova nao tem arquivo associado",
            )

        # State: validating
        logger.info(f"[{prova.id}] Validating {file_path.name}")
        validation = self.validator.validate(file_path)

        if not validation.is_valid:
            return ProcessingResult(
                success=False,
                status="failed",
                error_code=validation.error_code,
                error_message=validation.error_message,
                checkpoint="validation_failed",
            )

        # Checkpoint: validated
        logger.info(
            f"[{prova.id}] Validated: {validation.page_count} pages, {validation.text_length} chars"
        )

        # State: processing
        try:
            # Initialize LLM if needed
            if not self.llm:
                self.llm = LLMOrchestrator()

            # Extract questions
            logger.info(f"[{prova.id}] Extracting questions with LLM")
            extraction_result = extract_questions_chunked(file_path, self.llm, pages_per_chunk=4)

            questoes = extraction_result.get("questoes", [])

            if not questoes:
                return ProcessingResult(
                    success=False,
                    status="failed",
                    error_code="NO_QUESTIONS",
                    error_message="Nenhuma questao extraida do PDF",
                    checkpoint="extraction_failed",
                )

            # Checkpoint: questions extracted
            logger.info(f"[{prova.id}] Extracted {len(questoes)} questions")

            # Score each question
            scored_questoes = []
            total_score = 0
            revisao_count = 0

            for q in questoes:
                score_result = self.scorer.calculate(q, edital_disciplinas)
                q["confianca_score"] = score_result["score"]
                q["confianca_detalhes"] = score_result["detalhes"]
                q["confianca_nivel"] = score_result["nivel"]

                total_score += score_result["score"]
                if score_result["nivel"] == "baixa":
                    revisao_count += 1

                scored_questoes.append(q)

            confianca_media = total_score / len(scored_questoes) if scored_questoes else 0

            # Determine final status
            if revisao_count == 0:
                status = "completed"
            elif revisao_count < len(scored_questoes):
                status = "partial"
            else:
                status = "failed"  # All questions need review

            return ProcessingResult(
                success=status in ["completed", "partial"],
                status=status,
                questoes_count=len(scored_questoes),
                questoes_revisao=revisao_count,
                confianca_media=confianca_media,
                checkpoint="completed",
                questoes=scored_questoes,
            )

        except Exception as e:
            logger.error(f"[{prova.id}] Processing failed: {e}")

            # Check if rate limit
            error_str = str(e).lower()
            if "rate" in error_str or "429" in error_str or "limit" in error_str:
                return ProcessingResult(
                    success=False,
                    status="retry",
                    error_code="RATE_LIMIT",
                    error_message="Rate limit atingido. Retry automatico em breve.",
                    checkpoint="rate_limited",
                )

            return ProcessingResult(
                success=False,
                status="failed",
                error_code="PROCESSING_ERROR",
                error_message=str(e)[:500],
                checkpoint="processing_failed",
            )
