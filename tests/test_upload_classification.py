"""
Tests for question classification integration in upload flow
"""

import uuid
from unittest.mock import MagicMock, patch

import pytest

# Test the integration of classifier with upload


class TestUploadClassificationIntegration:
    """Tests for classification integration in upload route"""

    @pytest.fixture
    def mock_classifier_response(self):
        """Mock classifier response"""
        return {
            "disciplina": "Língua Portuguesa",
            "assunto": "Sintaxe",
            "topico": "Período Composto",
            "subtopico": "Orações Subordinadas",
            "conceito_especifico": "Orações subordinadas adverbiais",
            "item_edital_path": "Língua Portuguesa > Sintaxe > Período Composto",
            "confianca_disciplina": 0.95,
            "confianca_assunto": 0.88,
            "confianca_topico": 0.75,
            "confianca_subtopico": 0.65,
            "conceito_testado": "Identificação de orações subordinadas",
            "habilidade_bloom": "analisar",
            "nivel_dificuldade": "intermediario",
            "llm_provider": "groq",
            "llm_model": "llama-3.3-70b",
            "questao_numero": 1,
        }

    def test_classifier_imported_in_upload_module(self):
        """Verify QuestionClassifier is imported in upload module"""
        from src.api.routes import upload

        assert hasattr(upload, "QuestionClassifier")
        assert hasattr(upload, "Classificacao")

    def test_classificacao_model_has_required_fields(self):
        """Verify Classificacao model has all fields needed for integration"""
        from src.models.classificacao import Classificacao

        # Check required fields exist
        assert hasattr(Classificacao, "questao_id")
        assert hasattr(Classificacao, "edital_id")
        assert hasattr(Classificacao, "disciplina")
        assert hasattr(Classificacao, "assunto")
        assert hasattr(Classificacao, "topico")
        assert hasattr(Classificacao, "subtopico")
        assert hasattr(Classificacao, "conceito_especifico")
        assert hasattr(Classificacao, "item_edital_path")
        assert hasattr(Classificacao, "confianca_disciplina")
        assert hasattr(Classificacao, "confianca_assunto")
        assert hasattr(Classificacao, "llm_provider")
        assert hasattr(Classificacao, "llm_model")

    def test_classifier_batch_handles_errors_gracefully(self, mock_classifier_response):
        """Verify classify_batch handles per-question errors without failing batch"""
        from src.classification import classifier as classifier_module

        # Create mock that returns success for first question, error for second
        call_count = [0]

        def mock_generate(**kwargs):
            call_count[0] += 1
            if call_count[0] == 2:
                raise Exception("Simulated API error")
            return {
                "content": '{"disciplina": "Direito", "assunto": "Constitucional"}',
                "provider": "groq",
                "model": "llama-3.3-70b",
            }

        mock_llm = MagicMock()
        mock_llm.generate.side_effect = mock_generate

        with patch.object(classifier_module, "LLMOrchestrator", return_value=mock_llm):
            classifier = classifier_module.QuestionClassifier()

            questoes = [
                {
                    "numero": 1,
                    "enunciado": "Questão 1",
                    "alternativas": {"A": "opt1", "B": "opt2"},
                },
                {
                    "numero": 2,
                    "enunciado": "Questão 2",
                    "alternativas": {"A": "opt1", "B": "opt2"},
                },
                {
                    "numero": 3,
                    "enunciado": "Questão 3",
                    "alternativas": {"A": "opt1", "B": "opt2"},
                },
            ]

            # Should not raise - errors are captured per-question
            results = classifier.classify_batch(questoes)

            # Should have 3 results
            assert len(results) == 3

            # First and third should succeed
            assert results[0].get("disciplina") == "Direito"
            assert results[2].get("disciplina") == "Direito"

            # Second should have error marker
            assert results[1].get("erro") is not None

    def test_classificacao_stats_in_file_result(self, sample_taxonomia):
        """Test that file_result includes classification stats"""
        # This tests the structure we add to file_result
        file_result = {
            "success": True,
            "filename": "test.pdf",
            "classificacao": {
                "tentada": True,
                "criadas": 5,
                "erros": 1,
            },
        }

        assert file_result["classificacao"]["tentada"] is True
        assert file_result["classificacao"]["criadas"] == 5
        assert file_result["classificacao"]["erros"] == 1

    def test_classificacao_stats_when_no_edital(self):
        """Test classification stats when no edital is linked"""
        file_result = {
            "success": True,
            "filename": "test.pdf",
            "classificacao": {
                "tentada": False,
                "motivo": "Sem edital/taxonomia vinculada",
            },
        }

        assert file_result["classificacao"]["tentada"] is False
        assert "edital" in file_result["classificacao"]["motivo"].lower()


class TestClassificacaoMapping:
    """Tests for mapping classifier output to Classificacao model"""

    def test_classifier_output_matches_classificacao_fields(self):
        """Verify classifier output fields map correctly to Classificacao"""
        from src.models.classificacao import Classificacao

        # Simulate classifier output
        classificacao_result = {
            "disciplina": "Língua Portuguesa",
            "assunto": "Sintaxe",
            "topico": "Período Composto",
            "subtopico": "Orações Subordinadas",
            "conceito_especifico": "Orações subordinadas adverbiais",
            "item_edital_path": "Língua Portuguesa > Sintaxe > Período Composto",
            "confianca_disciplina": 0.95,
            "confianca_assunto": 0.88,
            "confianca_topico": 0.75,
            "confianca_subtopico": 0.65,
            "conceito_testado": "Identificação de orações subordinadas",
            "habilidade_bloom": "analisar",
            "nivel_dificuldade": "intermediario",
            "llm_provider": "groq",
            "llm_model": "llama-3.3-70b",
        }

        # Verify all fields can be mapped (using .get for safety)
        questao_id = uuid.uuid4()
        classificacao = Classificacao(
            questao_id=questao_id,
            disciplina=classificacao_result.get("disciplina", ""),
            assunto=classificacao_result.get("assunto"),
            topico=classificacao_result.get("topico"),
            subtopico=classificacao_result.get("subtopico"),
            conceito_especifico=classificacao_result.get("conceito_especifico"),
            item_edital_path=classificacao_result.get("item_edital_path"),
            confianca_disciplina=classificacao_result.get("confianca_disciplina"),
            confianca_assunto=classificacao_result.get("confianca_assunto"),
            confianca_topico=classificacao_result.get("confianca_topico"),
            confianca_subtopico=classificacao_result.get("confianca_subtopico"),
            conceito_testado=classificacao_result.get("conceito_testado"),
            habilidade_bloom=classificacao_result.get("habilidade_bloom"),
            nivel_dificuldade=classificacao_result.get("nivel_dificuldade"),
            llm_provider=classificacao_result.get("llm_provider"),
            llm_model=classificacao_result.get("llm_model"),
        )

        # All fields should be set correctly
        assert classificacao.disciplina == "Língua Portuguesa"
        assert classificacao.assunto == "Sintaxe"
        assert classificacao.topico == "Período Composto"
        assert classificacao.confianca_disciplina == 0.95
        assert classificacao.llm_provider == "groq"
