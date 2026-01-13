# tests/extraction/test_confidence_scorer.py
"""Tests for ConfidenceScorer - TDD approach"""
import pytest
from src.extraction.confidence_scorer import ConfidenceScorer


class TestConfidenceScorer:
    """Test suite for ConfidenceScorer"""

    def test_scorer_calculates_score(self):
        """Scorer should calculate 0-100 score based on criteria"""
        scorer = ConfidenceScorer()

        questao = {
            "numero": 1,
            "enunciado": "Este e um enunciado de teste com tamanho adequado para uma questao de concurso publico.",
            "alternativas": {"A": "Opcao A", "B": "Opcao B", "C": "Opcao C", "D": "Opcao D", "E": "Opcao E"},
            "gabarito": "A",
            "disciplina": "Portugues"
        }

        edital_disciplinas = ["portugues", "matematica"]

        result = scorer.calculate(questao, edital_disciplinas)

        assert "score" in result
        assert 0 <= result["score"] <= 100
        assert "detalhes" in result

    def test_scorer_high_score_for_complete_question(self):
        """Complete question should get high confidence score"""
        scorer = ConfidenceScorer()

        questao = {
            "numero": 1,
            "enunciado": "A" * 100,  # Good length
            "alternativas": {"A": "1", "B": "2", "C": "3", "D": "4", "E": "5"},
            "gabarito": "A",
            "disciplina": "Portugues"
        }

        result = scorer.calculate(questao, ["portugues"])
        assert result["score"] >= 80  # High confidence

    def test_scorer_low_score_for_incomplete_question(self):
        """Incomplete question should get low confidence score"""
        scorer = ConfidenceScorer()

        questao = {
            "enunciado": "Short",  # Too short
            "alternativas": {"A": "1"},  # Only one alternative
        }

        result = scorer.calculate(questao, [])
        assert result["score"] < 50  # Low confidence

    def test_scorer_returns_nivel(self):
        """Scorer should return confidence level (alta/media/baixa)"""
        scorer = ConfidenceScorer()

        # High confidence question
        questao_alta = {
            "numero": 1,
            "enunciado": "A" * 100,
            "alternativas": {"A": "1", "B": "2", "C": "3", "D": "4", "E": "5"},
            "gabarito": "A",
            "disciplina": "Portugues"
        }

        result = scorer.calculate(questao_alta, ["portugues"])
        assert "nivel" in result
        assert result["nivel"] in ["alta", "media", "baixa"]

    def test_scorer_enunciado_length_scoring(self):
        """Test enunciado length scoring criteria"""
        scorer = ConfidenceScorer()

        # Optimal length (50-2000 chars) -> 25 pts
        questao_optimal = {"enunciado": "A" * 100, "alternativas": {}}
        result = scorer.calculate(questao_optimal, [])
        assert result["detalhes"]["enunciado_tamanho"] == 25

        # Marginal length (20-50 chars) -> 15 pts
        questao_short = {"enunciado": "A" * 30, "alternativas": {}}
        result = scorer.calculate(questao_short, [])
        assert result["detalhes"]["enunciado_tamanho"] == 15

        # Too short (<20 chars) -> 0 pts
        questao_too_short = {"enunciado": "A" * 10, "alternativas": {}}
        result = scorer.calculate(questao_too_short, [])
        assert result["detalhes"]["enunciado_tamanho"] == 0

    def test_scorer_alternativas_scoring(self):
        """Test alternativas scoring criteria"""
        scorer = ConfidenceScorer()

        # 5 valid alternatives (A-E) -> 25 pts
        questao_5alt = {
            "enunciado": "Test",
            "alternativas": {"A": "1", "B": "2", "C": "3", "D": "4", "E": "5"}
        }
        result = scorer.calculate(questao_5alt, [])
        assert result["detalhes"]["alternativas_validas"] == 25

        # 4 valid alternatives -> 25 pts
        questao_4alt = {
            "enunciado": "Test",
            "alternativas": {"A": "1", "B": "2", "C": "3", "D": "4"}
        }
        result = scorer.calculate(questao_4alt, [])
        assert result["detalhes"]["alternativas_validas"] == 25

        # 3 alternatives -> 15 pts (partial)
        questao_3alt = {
            "enunciado": "Test",
            "alternativas": {"A": "1", "B": "2", "C": "3"}
        }
        result = scorer.calculate(questao_3alt, [])
        assert result["detalhes"]["alternativas_validas"] == 15

    def test_scorer_gabarito_scoring(self):
        """Test gabarito scoring criteria"""
        scorer = ConfidenceScorer()

        # Clear gabarito (A-E) -> 20 pts
        questao_clear = {"enunciado": "Test", "alternativas": {}, "gabarito": "A"}
        result = scorer.calculate(questao_clear, [])
        assert result["detalhes"]["gabarito_claro"] == 20

        # Non-standard gabarito -> 10 pts
        questao_unclear = {"enunciado": "Test", "alternativas": {}, "gabarito": "X"}
        result = scorer.calculate(questao_unclear, [])
        assert result["detalhes"]["gabarito_claro"] == 10

        # No gabarito -> 0 pts
        questao_none = {"enunciado": "Test", "alternativas": {}}
        result = scorer.calculate(questao_none, [])
        assert result["detalhes"]["gabarito_claro"] == 0

    def test_scorer_disciplina_match_scoring(self):
        """Test disciplina match scoring criteria"""
        scorer = ConfidenceScorer()

        # Exact match -> 15 pts
        questao = {"enunciado": "Test", "alternativas": {}, "disciplina": "Portugues"}
        result = scorer.calculate(questao, ["portugues"])
        assert result["detalhes"]["disciplina_match"] == 15

        # Has disciplina, no match -> 5 pts
        result = scorer.calculate(questao, ["matematica"])
        assert result["detalhes"]["disciplina_match"] == 5

        # Has disciplina, no edital to compare -> 10 pts
        result = scorer.calculate(questao, [])
        assert result["detalhes"]["disciplina_match"] == 10

    def test_scorer_formato_consistente_scoring(self):
        """Test format consistency scoring criteria"""
        scorer = ConfidenceScorer()

        # Has numero and all fields -> 15 pts
        questao_complete = {
            "numero": 1,
            "enunciado": "Test",
            "alternativas": {"A": "1"}
        }
        result = scorer.calculate(questao_complete, [])
        assert result["detalhes"]["formato_consistente"] == 15

        # Missing numero -> 10 pts
        questao_no_numero = {
            "enunciado": "Test",
            "alternativas": {"A": "1"}
        }
        result = scorer.calculate(questao_no_numero, [])
        assert result["detalhes"]["formato_consistente"] == 10

    def test_scorer_handles_accented_disciplina(self):
        """Scorer should match disciplina with accents"""
        scorer = ConfidenceScorer()

        questao = {"enunciado": "Test", "alternativas": {}, "disciplina": "Portugues"}
        result = scorer.calculate(questao, ["portugues"])
        assert result["detalhes"]["disciplina_match"] == 15

    def test_scorer_handles_empty_questao(self):
        """Scorer should handle empty question gracefully"""
        scorer = ConfidenceScorer()

        result = scorer.calculate({}, [])
        assert result["score"] == 0
        assert result["nivel"] == "baixa"
