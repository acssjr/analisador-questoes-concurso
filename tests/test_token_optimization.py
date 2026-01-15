"""
Tests for token optimization utilities (Phase 1: Safe strategies)
"""


class TestContextPruning:
    """Tests for context pruning - removes unnecessary tokens"""

    def test_removes_extra_whitespace(self):
        """Multiple spaces and newlines should be collapsed to single space"""
        from src.optimization.token_utils import prune_context

        text = "Sobre   a    Constituição\n\nFederal,   assinale:"
        result = prune_context(text)

        assert result == "Sobre a Constituição Federal, assinale:"

    def test_removes_question_number_prefix(self):
        """Question number prefixes like 'Questão 42:' should be removed"""
        from src.optimization.token_utils import prune_context

        text = "Questão 42: Assinale a alternativa correta."
        result = prune_context(text)

        assert result == "Assinale a alternativa correta."

    def test_removes_question_number_variations(self):
        """Various question number formats should be removed"""
        from src.optimization.token_utils import prune_context

        cases = [
            ("Questão 1. O servidor público...", "O servidor público..."),
            ("QUESTÃO 15 - Considerando...", "Considerando..."),
            ("Q.42: Sobre a lei...", "Sobre a lei..."),
            ("01) A administração pública...", "A administração pública..."),
            ("42 - Marque a opção...", "Marque a opção..."),
        ]

        for input_text, expected in cases:
            result = prune_context(input_text)
            assert result == expected, f"Failed for: {input_text}"

    def test_removes_banca_info(self):
        """Banca/exam info in parentheses should be removed"""
        from src.optimization.token_utils import prune_context

        cases = [
            ("(CESPE 2023) O princípio...", "O princípio..."),
            ("(FCC - 2022) Assinale...", "Assinale..."),
            ("(VUNESP/2021) Considerando...", "Considerando..."),
            ("(Prova: CESPE/CEBRASPE - 2023) Sobre...", "Sobre..."),
            ("(TRF 3ª Região - Analista) A lei...", "A lei..."),
        ]

        for input_text, expected in cases:
            result = prune_context(input_text)
            assert result == expected, f"Failed for: {input_text}"

    def test_preserves_legal_content(self):
        """Legal references and content must be preserved"""
        from src.optimization.token_utils import prune_context

        text = "Conforme a Lei 8.112/90, art. 5º, inciso II, o servidor..."
        result = prune_context(text)

        # Should preserve all legal references
        assert "Lei 8.112/90" in result
        assert "art. 5º" in result
        assert "inciso II" in result

    def test_preserves_keywords(self):
        """Important keywords for classification must be preserved"""
        from src.optimization.token_utils import prune_context

        text = "(CESPE 2023) Questão 42: Considerando a jurisprudência do STF sobre INCORRETO assinale."
        result = prune_context(text)

        # Must preserve classification keywords
        assert "jurisprudência" in result
        assert "STF" in result
        assert "INCORRETO" in result

    def test_handles_empty_and_none(self):
        """Should handle empty string and None gracefully"""
        from src.optimization.token_utils import prune_context

        assert prune_context("") == ""
        assert prune_context("   ") == ""
        assert prune_context(None) == ""


class TestPruneQuestao:
    """Tests for pruning complete question dict"""

    def test_prunes_enunciado(self):
        """Should prune the enunciado field"""
        from src.optimization.token_utils import prune_questao

        questao = {
            "numero": 42,
            "enunciado": "Questão 42: (CESPE 2023)   Sobre a lei...",
            "alternativas": ["A) opção 1", "B) opção 2"],
        }

        result = prune_questao(questao)

        assert result["enunciado"] == "Sobre a lei..."
        assert result["numero"] == 42  # Preserved
        assert result["alternativas"] == ["A) opção 1", "B) opção 2"]  # Preserved

    def test_does_not_modify_original(self):
        """Should return new dict, not modify original"""
        from src.optimization.token_utils import prune_questao

        original = {
            "numero": 1,
            "enunciado": "Questão 1: Original text",
        }
        original_copy = original.copy()

        result = prune_questao(original)

        assert original == original_copy  # Original unchanged
        assert result is not original  # New dict returned


class TestTokenEstimation:
    """Tests for token count estimation"""

    def test_estimates_tokens_approximately(self):
        """Should estimate token count (roughly 4 chars per token for Portuguese)"""
        from src.optimization.token_utils import estimate_tokens

        # ~100 characters ≈ 25 tokens (Portuguese average)
        text = "A Constituição Federal de 1988 estabelece os princípios fundamentais da República."
        tokens = estimate_tokens(text)

        assert 15 <= tokens <= 35  # Reasonable range

    def test_empty_text_zero_tokens(self):
        """Empty text should return 0 tokens"""
        from src.optimization.token_utils import estimate_tokens

        assert estimate_tokens("") == 0
        assert estimate_tokens(None) == 0
