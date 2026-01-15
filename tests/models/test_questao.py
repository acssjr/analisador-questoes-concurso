# tests/models/test_questao.py
from src.models.questao import Questao


def test_questao_has_confidence_fields():
    """Questao model should have confidence scoring fields"""
    questao = Questao(numero=1, enunciado="Test enunciado", alternativas={"A": "opt1", "B": "opt2"})

    assert hasattr(questao, "confianca_score")
    assert hasattr(questao, "confianca_detalhes")
    assert hasattr(questao, "dificuldade")
    assert hasattr(questao, "bloom_level")
    assert hasattr(questao, "tem_pegadinha")
    assert hasattr(questao, "pegadinha_descricao")


def test_questao_confidence_can_be_set():
    """Questao model confidence fields can be set"""
    questao = Questao(
        numero=1,
        enunciado="Test enunciado",
        alternativas={"A": "opt1", "B": "opt2"},
        confianca_score=85,
        confianca_detalhes={
            "enunciado_tamanho": 25,
            "alternativas_validas": 25,
            "gabarito_claro": 20,
            "disciplina_match": 15,
            "formato_consistente": 0,
        },
        dificuldade="medium",
        bloom_level="apply",
        tem_pegadinha=True,
        pegadinha_descricao="Alternativa B parece correta mas ignora um detalhe",
    )

    assert questao.confianca_score == 85
    assert questao.confianca_detalhes["enunciado_tamanho"] == 25
    assert questao.dificuldade == "medium"
    assert questao.bloom_level == "apply"
    assert questao.tem_pegadinha is True
    assert "Alternativa B" in questao.pegadinha_descricao
