"""
Tests for classifier batch throttling
"""

import sys
import time
from pathlib import Path
from unittest.mock import MagicMock, patch

# Add src to path
src_path = Path(__file__).parent.parent / "src"
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path.parent))


class TestClassifierThrottling:
    """Tests for batch classification throttling"""

    def test_batch_classification_has_delay_between_calls(self):
        """
        When classifying multiple questions in batch, there should be
        a delay between API calls to avoid rate limiting.
        """
        # Import the module first
        from src.classification import classifier as classifier_module

        # Track call times
        call_times = []

        def mock_generate(**kwargs):
            call_times.append(time.time())
            return {
                "content": '{"disciplina": "Direito", "assunto": "Constitucional"}',
                "provider": "groq",
                "model": "llama-3.3-70b",
            }

        # Create a mock orchestrator
        mock_llm = MagicMock()
        mock_llm.generate.side_effect = mock_generate

        # Patch the LLMOrchestrator class in the module
        with patch.object(classifier_module, "LLMOrchestrator", return_value=mock_llm):
            # Create classifier (this will use the mocked orchestrator)
            classifier = classifier_module.QuestionClassifier()

            questoes = [
                {"numero": 1, "enunciado": "Questão 1", "alternativas": ["A", "B", "C", "D"]},
                {"numero": 2, "enunciado": "Questão 2", "alternativas": ["A", "B", "C", "D"]},
                {"numero": 3, "enunciado": "Questão 3", "alternativas": ["A", "B", "C", "D"]},
            ]

            # Act
            results = classifier.classify_batch(questoes)

            # Assert
            assert len(results) == 3
            assert len(call_times) == 3

            # Verify delays between calls (at least 0.3s between each)
            min_delay = 0.3  # seconds

            for i in range(1, len(call_times)):
                delay = call_times[i] - call_times[i - 1]
                assert delay >= min_delay, (
                    f"Delay between call {i} and {i + 1} was {delay:.3f}s, "
                    f"expected at least {min_delay}s"
                )

    def test_single_classification_has_no_delay(self):
        """
        Single question classification should not have artificial delay.
        """
        from src.classification import classifier as classifier_module

        mock_llm = MagicMock()
        mock_llm.generate.return_value = {
            "content": '{"disciplina": "Direito", "assunto": "Constitucional"}',
            "provider": "groq",
            "model": "llama-3.3-70b",
        }

        with patch.object(classifier_module, "LLMOrchestrator", return_value=mock_llm):
            classifier = classifier_module.QuestionClassifier()

            questao = {"numero": 1, "enunciado": "Questão 1", "alternativas": ["A", "B", "C", "D"]}

            # Act - time single classification
            start = time.time()
            result = classifier.classify_question(questao)
            elapsed = time.time() - start

            # Assert - should be fast (no artificial delay)
            assert elapsed < 0.5, f"Single classification took {elapsed:.3f}s, expected < 0.5s"
            assert result["disciplina"] == "Direito"
