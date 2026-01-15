# src/extraction/confidence_scorer.py
"""
Confidence Score Calculator for extracted questions

Scoring criteria (total 100 points):
- 25 pts: Enunciado has reasonable length (50-2000 chars)
- 25 pts: Has exactly 4-5 alternatives (A-E)
- 20 pts: Gabarito clearly identified
- 15 pts: Disciplina matches edital
- 15 pts: Format consistent (has numero, no missing fields)
"""

import unicodedata
from typing import Optional


def normalize_text(text: str) -> str:
    """Normalize text for comparison (lowercase, no accents)"""
    if not text:
        return ""
    nfkd = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c))


class ConfidenceScorer:
    """Calculate confidence score for extracted questions"""

    def calculate(self, questao: dict, edital_disciplinas: Optional[list[str]] = None) -> dict:
        """
        Calculate confidence score for a question.

        Args:
            questao: Extracted question dict
            edital_disciplinas: List of discipline names from edital (normalized)

        Returns:
            dict with 'score' (0-100) and 'detalhes' breakdown
        """
        detalhes = {}

        # 1. Enunciado length (25 pts)
        enunciado = questao.get("enunciado", "")
        enunciado_len = len(enunciado)
        if 50 <= enunciado_len <= 2000:
            detalhes["enunciado_tamanho"] = 25
        elif 20 <= enunciado_len < 50 or 2000 < enunciado_len <= 5000:
            detalhes["enunciado_tamanho"] = 15
        else:
            detalhes["enunciado_tamanho"] = 0

        # 2. Alternatives (25 pts)
        alternativas = questao.get("alternativas", {})
        if isinstance(alternativas, dict):
            alt_count = len(alternativas)
            valid_keys = all(k in "ABCDE" for k in alternativas.keys())

            if 4 <= alt_count <= 5 and valid_keys:
                detalhes["alternativas_validas"] = 25
            elif 3 <= alt_count <= 5:
                detalhes["alternativas_validas"] = 15
            else:
                detalhes["alternativas_validas"] = 0
        else:
            detalhes["alternativas_validas"] = 0

        # 3. Gabarito (20 pts)
        gabarito = questao.get("gabarito")
        if gabarito and gabarito in "ABCDE":
            detalhes["gabarito_claro"] = 20
        elif gabarito:
            detalhes["gabarito_claro"] = 10
        else:
            detalhes["gabarito_claro"] = 0

        # 4. Disciplina match (15 pts)
        disciplina = questao.get("disciplina", "")
        if edital_disciplinas and disciplina:
            disc_norm = normalize_text(disciplina)
            edital_norm = [normalize_text(ed) for ed in edital_disciplinas]
            if any(disc_norm in ed or ed in disc_norm for ed in edital_norm):
                detalhes["disciplina_match"] = 15
            else:
                detalhes["disciplina_match"] = 5  # Has disciplina but doesn't match
        elif disciplina:
            detalhes["disciplina_match"] = 10  # Has disciplina, no edital to compare
        else:
            detalhes["disciplina_match"] = 0

        # 5. Format consistency (15 pts)
        has_numero = questao.get("numero") is not None
        has_all_fields = all([enunciado, alternativas])

        if has_numero and has_all_fields:
            detalhes["formato_consistente"] = 15
        elif has_all_fields:
            detalhes["formato_consistente"] = 10
        else:
            detalhes["formato_consistente"] = 0

        # Calculate total
        score = sum(detalhes.values())

        return {"score": score, "detalhes": detalhes, "nivel": self._get_nivel(score)}

    def _get_nivel(self, score: int) -> str:
        """Get confidence level from score"""
        if score >= 80:
            return "alta"
        elif score >= 50:
            return "media"
        else:
            return "baixa"
