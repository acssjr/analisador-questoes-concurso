# src/extraction/quality_checker.py
"""
Extraction quality checker for intelligent routing.

Assesses text quality to determine if it needs correction via LLM
or fallback to Vision extraction.
"""

from dataclasses import dataclass
from typing import Optional

from loguru import logger

# Lazy import to avoid startup cost
_spell_checker = None


def _get_spell_checker():
    """Lazy load spell checker."""
    global _spell_checker
    if _spell_checker is None:
        from spellchecker import SpellChecker
        _spell_checker = SpellChecker(language="pt")
    return _spell_checker


@dataclass
class QualityMetrics:
    """Metrics for assessing extraction quality."""

    spell_error_rate: float  # Proportion of misspelled words (0-1)
    long_word_ratio: float   # Proportion of words >18 chars (0-1)
    valid_word_ratio: float  # Proportion of recognized words (0-1)
    word_count: int          # Total words analyzed
    flagged_words: Optional[list[str]] = None  # Sample of problematic words

    def __post_init__(self):
        if self.flagged_words is None:
            self.flagged_words = []

    @property
    def score(self) -> float:
        """
        Composite quality score (0-1, higher = better).

        Weighs spell errors heavily, penalizes concatenated words.
        """
        if self.word_count < 10:
            return 0.0

        # Base score from valid words
        base = self.valid_word_ratio

        # Penalty for spell errors (up to 50% reduction)
        spell_penalty = min(self.spell_error_rate, 0.5) * 2

        # Penalty for concatenated words (5x weight since rare in normal text)
        concat_penalty = min(self.long_word_ratio * 5, 0.5)

        score = base * (1 - spell_penalty) * (1 - concat_penalty)
        return max(0.0, min(1.0, score))

    def needs_correction(self, threshold: float = 0.80) -> bool:
        """Check if extraction needs correction."""
        return self.score < threshold or self.long_word_ratio > 0.05


def assess_extraction_quality(
    text: str,
    sample_size: int = 500,
) -> QualityMetrics:
    """
    Assess quality of extracted text.

    Args:
        text: Extracted text to analyze
        sample_size: Max words to check for spell errors (performance)

    Returns:
        QualityMetrics with detailed quality information
    """
    import re

    # Tokenize - extract alphabetic words with 3+ chars (strip punctuation)
    raw_words = text.split()
    words = []
    for w in raw_words:
        # Strip punctuation from start and end
        cleaned = re.sub(r'^[^\w]+|[^\w]+$', '', w)
        # Check if remaining is alphabetic (allows accented chars)
        if cleaned and len(cleaned) >= 3 and re.match(r'^[a-zA-ZáéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇ]+$', cleaned):
            words.append(cleaned)

    if len(words) < 10:
        logger.debug(f"Insufficient words for quality check: {len(words)}")
        return QualityMetrics(
            spell_error_rate=1.0,
            long_word_ratio=0.0,
            valid_word_ratio=0.0,
            word_count=len(words),
        )

    # Sample words for spell checking (expensive operation)
    sample = words[:sample_size] if len(words) > sample_size else words

    # Spell check
    spell = _get_spell_checker()
    misspelled = spell.unknown([w.lower() for w in sample])
    spell_error_rate = len(misspelled) / len(sample)

    # Long words (likely concatenations)
    long_words = [w for w in words if len(w) > 18]
    long_word_ratio = len(long_words) / len(words)

    # Valid word ratio
    valid_word_ratio = 1.0 - spell_error_rate

    # Sample flagged words for debugging
    flagged = list(long_words[:3]) + list(misspelled)[:2]

    metrics = QualityMetrics(
        spell_error_rate=round(spell_error_rate, 4),
        long_word_ratio=round(long_word_ratio, 4),
        valid_word_ratio=round(valid_word_ratio, 4),
        word_count=len(words),
        flagged_words=flagged,
    )

    logger.debug(
        f"Quality assessment: score={metrics.score:.3f}, "
        f"spell_errors={metrics.spell_error_rate:.1%}, "
        f"long_words={metrics.long_word_ratio:.1%}"
    )

    return metrics


def needs_vision_fallback(
    text: str,
    quality_threshold: float = 0.75,
) -> bool:
    """
    Quick check if text needs Vision LLM fallback.

    Args:
        text: Extracted text to check
        quality_threshold: Score below which Vision is needed

    Returns:
        True if Vision fallback recommended
    """
    metrics = assess_extraction_quality(text)
    return metrics.score < quality_threshold
