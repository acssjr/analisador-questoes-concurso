"""
Token optimization utilities for reducing API costs without quality loss.

Phase 1: Safe strategies (0% quality loss)
- Context pruning: removes formatting noise
- Token estimation: helps with batching decisions
"""

import re
from typing import Optional


def prune_context(text: Optional[str]) -> str:
    """
    Remove unnecessary tokens from text while preserving semantic content.

    Removes:
    - Extra whitespace (multiple spaces, newlines)
    - Question number prefixes (Questão 42:, Q.1, 01), etc.)
    - Banca/exam info in parentheses ((CESPE 2023), (FCC - 2022), etc.)

    Preserves:
    - Legal references (Lei 8.112/90, art. 5º, etc.)
    - Classification keywords (jurisprudência, STF, INCORRETO, etc.)
    - All semantic content

    Args:
        text: Input text to prune

    Returns:
        Pruned text with unnecessary tokens removed
    """
    if not text:
        return ""

    result = text

    # Remove question number prefixes FIRST (they often come before banca info)
    # Matches: "Questão 42:", "QUESTÃO 15 -", "Q.42:", "01)", "42 -"
    patterns = [
        r"^Questão\s+\d+[.:]\s*",  # Questão 42: or Questão 42.
        r"^QUESTÃO\s+\d+\s*[-–]\s*",  # QUESTÃO 15 -
        r"^Q\.\s*\d+[.:]\s*",  # Q.42:
        r"^\d+\)\s*",  # 01)
        r"^\d+\s*[-–]\s*",  # 42 -
    ]

    for pattern in patterns:
        result = re.sub(pattern, "", result, flags=re.IGNORECASE)

    # Remove banca/exam info in parentheses (now at the start after question number removed)
    # Matches: (CESPE 2023), (FCC - 2022), (VUNESP/2021), (Prova: CESPE/CEBRASPE - 2023)
    # Also matches: (TRF 3ª Região - Analista)
    result = re.sub(
        r"^\s*\([^)]*(?:CESPE|FCC|VUNESP|CEBRASPE|FGV|ESAF|IBFC|CESGRANRIO|"
        r"Prova|TRF|TRT|TRE|STF|STJ|MPU|MPF|Região|Analista|Técnico)[^)]*\)\s*",
        "",
        result,
        flags=re.IGNORECASE,
    )

    # Collapse multiple whitespace to single space
    result = re.sub(r"\s+", " ", result)

    # Strip leading/trailing whitespace
    result = result.strip()

    return result


def prune_questao(questao: dict) -> dict:
    """
    Prune a complete question dict, optimizing the enunciado field.

    Args:
        questao: Question dict with enunciado, alternativas, etc.

    Returns:
        New dict with pruned enunciado (original not modified)
    """
    # Create a copy to avoid modifying original
    result = questao.copy()

    # Prune the enunciado if present
    if "enunciado" in result:
        result["enunciado"] = prune_context(result["enunciado"])

    return result


def estimate_tokens(text: Optional[str]) -> int:
    """
    Estimate token count for Portuguese text.

    Uses approximation: ~4 characters per token for Portuguese
    (accounting for accents, longer words than English)

    Args:
        text: Input text

    Returns:
        Estimated token count
    """
    if not text:
        return 0

    # Portuguese averages ~4 chars per token
    # This is a rough estimate - actual tokenization varies by model
    return len(text) // 4
