"""
Tests for LLM retry logic with exponential backoff
"""
import time
from unittest.mock import MagicMock, patch

import pytest

from src.core.exceptions import LLMRateLimitError
from src.llm.providers.groq_client import GroqClient


class TestGroqClientRetry:
    """Tests for Groq client retry behavior"""

    @patch("src.llm.providers.groq_client.Groq")
    @patch("src.llm.providers.groq_client.settings")
    def test_retries_on_rate_limit_then_succeeds(self, mock_settings, mock_groq_class):
        """
        When rate limit is hit, the client should retry up to 3 times
        with exponential backoff before succeeding.
        """
        # Setup
        mock_settings.groq_api_key = "test-key"
        mock_settings.default_text_model = "llama-3.3-70b-versatile"

        mock_client = MagicMock()
        mock_groq_class.return_value = mock_client

        # Track attempts
        attempts = []

        def mock_create(**kwargs):
            attempts.append(time.time())
            if len(attempts) < 3:
                # Simulate rate limit error
                error = Exception("rate_limit_exceeded: too many requests")
                raise error
            # Third attempt succeeds
            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = "Success"
            mock_response.usage = MagicMock()
            mock_response.usage.prompt_tokens = 10
            mock_response.usage.completion_tokens = 5
            mock_response.usage.total_tokens = 15
            mock_response.model_dump.return_value = {}
            return mock_response

        mock_client.chat.completions.create.side_effect = mock_create

        # Act
        client = GroqClient(api_key="test-key")
        result = client.generate(prompt="Test prompt")

        # Assert
        assert len(attempts) == 3, f"Expected 3 attempts, got {len(attempts)}"
        assert result["content"] == "Success"

        # Verify exponential backoff - delays should increase
        if len(attempts) >= 3:
            delay1 = attempts[1] - attempts[0]
            delay2 = attempts[2] - attempts[1]
            assert delay1 >= 0.5, f"First delay should be >= 0.5s, got {delay1}"
            assert delay2 >= delay1, f"Second delay {delay2} should be >= first delay {delay1}"

    @patch("src.llm.providers.groq_client.Groq")
    @patch("src.llm.providers.groq_client.settings")
    def test_raises_after_max_retries(self, mock_settings, mock_groq_class):
        """
        When rate limit persists after max retries, should raise LLMRateLimitError.
        """
        # Setup
        mock_settings.groq_api_key = "test-key"
        mock_settings.default_text_model = "llama-3.3-70b-versatile"

        mock_client = MagicMock()
        mock_groq_class.return_value = mock_client

        # Always fail with rate limit
        mock_client.chat.completions.create.side_effect = Exception(
            "rate_limit_exceeded: quota exceeded"
        )

        # Act & Assert
        client = GroqClient(api_key="test-key")

        with pytest.raises(LLMRateLimitError) as exc_info:
            client.generate(prompt="Test prompt")

        # Should have tried multiple times before failing
        assert mock_client.chat.completions.create.call_count >= 3

    @patch("src.llm.providers.groq_client.Groq")
    @patch("src.llm.providers.groq_client.settings")
    def test_no_retry_on_other_errors(self, mock_settings, mock_groq_class):
        """
        Non-rate-limit errors should not trigger retry.
        """
        # Setup
        mock_settings.groq_api_key = "test-key"
        mock_settings.default_text_model = "llama-3.3-70b-versatile"

        mock_client = MagicMock()
        mock_groq_class.return_value = mock_client

        # Non-rate-limit error
        mock_client.chat.completions.create.side_effect = Exception(
            "authentication_error: invalid API key"
        )

        # Act & Assert
        client = GroqClient(api_key="test-key")

        from src.core.exceptions import LLMAPIError
        with pytest.raises(LLMAPIError):
            client.generate(prompt="Test prompt")

        # Should only try once for non-rate-limit errors
        assert mock_client.chat.completions.create.call_count == 1
