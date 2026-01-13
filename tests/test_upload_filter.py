"""
Tests for question filtering by edital disciplines
"""
import pytest

from src.api.routes.upload import (
    normalize_disciplina,
    get_edital_disciplinas,
    disciplina_matches_edital,
    filter_questoes_by_edital,
    DISCIPLINA_ALIASES,
)


class TestNormalizeDisciplina:
    """Tests for discipline name normalization"""

    def test_lowercase(self):
        assert normalize_disciplina("PORTUGUÊS") == "português"

    def test_strip_whitespace(self):
        assert normalize_disciplina("  Matemática  ") == "matemática"

    def test_empty_string(self):
        assert normalize_disciplina("") == ""

    def test_none(self):
        assert normalize_disciplina(None) == ""


class TestGetEditalDisciplinas:
    """Tests for extracting disciplines from taxonomy"""

    def test_extract_disciplines(self, sample_taxonomia):
        result = get_edital_disciplinas(sample_taxonomia)

        assert "língua portuguesa" in result
        assert "raciocínio lógico" in result
        assert len(result) == 2

    def test_empty_taxonomy(self):
        result = get_edital_disciplinas({})
        assert result == []

    def test_none_taxonomy(self):
        result = get_edital_disciplinas(None)
        assert result == []

    def test_missing_nome(self):
        taxonomy = {"disciplinas": [{"itens": []}]}
        result = get_edital_disciplinas(taxonomy)
        assert result == []


class TestDisciplinaMatchesEdital:
    """Tests for discipline matching logic"""

    def test_exact_match(self):
        edital_disciplinas = ["língua portuguesa", "matemática"]
        assert disciplina_matches_edital("Língua Portuguesa", edital_disciplinas) is True

    def test_substring_match_questao_in_edital(self):
        """Questão discipline is substring of edital discipline"""
        edital_disciplinas = ["língua portuguesa"]
        assert disciplina_matches_edital("Português", edital_disciplinas) is True

    def test_substring_match_edital_in_questao(self):
        """Edital discipline is substring of questão discipline"""
        edital_disciplinas = ["português"]
        assert disciplina_matches_edital("Língua Portuguesa", edital_disciplinas) is True

    def test_alias_match_portugues(self):
        """Test alias matching for Português → Língua Portuguesa"""
        edital_disciplinas = ["língua portuguesa"]
        assert disciplina_matches_edital("Português", edital_disciplinas) is True

    def test_alias_match_matematica_rlm(self):
        """Test alias matching for Matemática → Raciocínio Lógico"""
        edital_disciplinas = ["raciocínio lógico"]
        assert disciplina_matches_edital("Matemática", edital_disciplinas) is True

    def test_alias_match_informatica(self):
        """Test alias matching for Informática"""
        edital_disciplinas = ["noções de informática"]
        assert disciplina_matches_edital("Informática", edital_disciplinas) is True

    def test_no_match(self):
        edital_disciplinas = ["língua portuguesa", "matemática"]
        assert disciplina_matches_edital("Inglês", edital_disciplinas) is False

    def test_empty_questao_disciplina(self):
        edital_disciplinas = ["língua portuguesa"]
        assert disciplina_matches_edital("", edital_disciplinas) is False

    def test_empty_edital_disciplinas(self):
        assert disciplina_matches_edital("Português", []) is False

    def test_reverse_alias_match(self):
        """Test that edital alias also matches questão"""
        edital_disciplinas = ["afo"]  # Alias for "administração financeira e orçamentária"
        assert disciplina_matches_edital("Administração Financeira e Orçamentária", edital_disciplinas) is True


class TestFilterQuestoesByEdital:
    """Tests for filtering questions by edital disciplines"""

    @pytest.fixture
    def questoes_mistas(self):
        """Questions from multiple disciplines"""
        return [
            {"numero": 1, "disciplina": "Português", "enunciado": "Questão de português"},
            {"numero": 2, "disciplina": "Matemática", "enunciado": "Questão de matemática"},
            {"numero": 3, "disciplina": "Inglês", "enunciado": "Questão de inglês"},
            {"numero": 4, "disciplina": "Língua Portuguesa", "enunciado": "Outra questão"},
            {"numero": 5, "disciplina": "Espanhol", "enunciado": "Questão de espanhol"},
        ]

    def test_filter_keeps_matching(self, questoes_mistas, sample_taxonomia):
        result = filter_questoes_by_edital(questoes_mistas, sample_taxonomia)

        # Português e Matemática devem passar (aliases de Língua Portuguesa e Raciocínio Lógico)
        assert len(result["questoes_filtradas"]) == 3  # Português, Matemática, Língua Portuguesa
        numeros = [q["numero"] for q in result["questoes_filtradas"]]
        assert 1 in numeros  # Português
        assert 2 in numeros  # Matemática
        assert 4 in numeros  # Língua Portuguesa

    def test_filter_removes_non_matching(self, questoes_mistas, sample_taxonomia):
        result = filter_questoes_by_edital(questoes_mistas, sample_taxonomia)

        # Inglês e Espanhol devem ser removidos
        assert len(result["questoes_removidas"]) == 2
        numeros_removidos = [q["numero"] for q in result["questoes_removidas"]]
        assert 3 in numeros_removidos  # Inglês
        assert 5 in numeros_removidos  # Espanhol

    def test_filter_stats(self, questoes_mistas, sample_taxonomia):
        result = filter_questoes_by_edital(questoes_mistas, sample_taxonomia)

        stats = result["stats"]
        assert stats["total_original"] == 5
        assert stats["total_filtrado"] == 3
        assert stats["total_removido"] == 2
        assert "Inglês" in stats["disciplinas_removidas"]
        assert "Espanhol" in stats["disciplinas_removidas"]

    def test_filter_empty_taxonomy(self, questoes_mistas):
        """Empty taxonomy should return all questions"""
        result = filter_questoes_by_edital(questoes_mistas, {})

        assert len(result["questoes_filtradas"]) == 5
        assert len(result["questoes_removidas"]) == 0

    def test_filter_none_taxonomy(self, questoes_mistas):
        """None taxonomy should return all questions"""
        result = filter_questoes_by_edital(questoes_mistas, None)

        assert len(result["questoes_filtradas"]) == 5

    def test_filter_all_match(self, sample_taxonomia):
        """All questions match taxonomy"""
        questoes = [
            {"numero": 1, "disciplina": "Português"},
            {"numero": 2, "disciplina": "Raciocínio Lógico"},
        ]

        result = filter_questoes_by_edital(questoes, sample_taxonomia)

        assert len(result["questoes_filtradas"]) == 2
        assert len(result["questoes_removidas"]) == 0

    def test_filter_none_match(self, sample_taxonomia):
        """No questions match taxonomy"""
        questoes = [
            {"numero": 1, "disciplina": "Inglês"},
            {"numero": 2, "disciplina": "Espanhol"},
        ]

        result = filter_questoes_by_edital(questoes, sample_taxonomia)

        assert len(result["questoes_filtradas"]) == 0
        assert len(result["questoes_removidas"]) == 2

    def test_filter_questao_sem_disciplina(self, sample_taxonomia):
        """Questions without discipline should be removed"""
        questoes = [
            {"numero": 1, "disciplina": None},
            {"numero": 2, "disciplina": ""},
            {"numero": 3, "disciplina": "Português"},
        ]

        result = filter_questoes_by_edital(questoes, sample_taxonomia)

        assert len(result["questoes_filtradas"]) == 1
        assert result["questoes_filtradas"][0]["numero"] == 3
        assert "Sem disciplina" in result["stats"]["disciplinas_removidas"]


class TestDisciplinaAliases:
    """Tests for discipline alias dictionary"""

    def test_aliases_exist(self):
        assert "português" in DISCIPLINA_ALIASES
        assert "matemática" in DISCIPLINA_ALIASES
        assert "informática" in DISCIPLINA_ALIASES

    def test_aliases_bidirectional(self):
        """Check that common aliases work both ways"""
        # Português should alias to Língua Portuguesa
        assert "língua portuguesa" in DISCIPLINA_ALIASES["português"]
        # Língua Portuguesa should alias to Português
        assert "português" in DISCIPLINA_ALIASES["língua portuguesa"]

    def test_aliases_case_insensitive(self):
        """All aliases should be lowercase"""
        for key, values in DISCIPLINA_ALIASES.items():
            assert key == key.lower(), f"Key {key} should be lowercase"
            for val in values:
                assert val == val.lower(), f"Alias {val} should be lowercase"
