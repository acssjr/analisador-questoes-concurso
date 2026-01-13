"""
LLM Orchestrator - manages multiple LLM providers with fallback
"""
from pathlib import Path
from typing import Literal, Optional

from loguru import logger

from src.core.config import get_settings
from src.core.exceptions import LLMError, LLMRateLimitError
from src.llm.providers.anthropic_client import AnthropicClient
from src.llm.providers.groq_client import GroqClient
from src.llm.quota_tracker import get_quota_tracker

settings = get_settings()

LLMProvider = Literal["groq", "anthropic", "huggingface"]


class LLMOrchestrator:
    """
    Orchestrates multiple LLM providers with automatic fallback
    """

    def __init__(self):
        self.groq_client: Optional[GroqClient] = None
        self.anthropic_client: Optional[AnthropicClient] = None
        self.quota_tracker = get_quota_tracker()

        # Initialize available clients
        try:
            if settings.groq_api_key:
                self.groq_client = GroqClient()
                logger.info("Groq client initialized")
        except Exception as e:
            logger.warning(f"Failed to initialize Groq client: {e}")

        try:
            if settings.anthropic_api_key:
                self.anthropic_client = AnthropicClient()
                logger.info("Anthropic client initialized")
        except Exception as e:
            logger.warning(f"Failed to initialize Anthropic client: {e}")

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 4096,
        preferred_provider: Optional[LLMProvider] = None,
    ) -> dict:
        """
        Generate text with automatic fallback

        Args:
            prompt: User prompt
            system_prompt: System prompt
            temperature: Temperature
            max_tokens: Max tokens
            preferred_provider: Preferred LLM provider

        Returns:
            dict with response

        Raises:
            LLMError: If all providers fail
        """
        providers_to_try = []

        # Determine order of providers to try
        if preferred_provider:
            providers_to_try.append(preferred_provider)
        else:
            # Default: try Groq first (free + fast)
            if self.groq_client:
                providers_to_try.append("groq")
            if self.anthropic_client:
                providers_to_try.append("anthropic")

        # Try each provider
        errors = []
        for provider in providers_to_try:
            try:
                logger.debug(f"Trying LLM provider: {provider}")

                # Check quota before making request
                quota_check = self.quota_tracker.check_quota(provider)
                if not quota_check["can_proceed"]:
                    logger.warning(f"Quota exceeded for {provider}: {quota_check.get('reason')}")
                    errors.append(f"{provider}: Quota exceeded - {quota_check.get('reason')}")
                    continue

                if provider == "groq" and self.groq_client:
                    result = self.groq_client.generate(
                        prompt, system_prompt, temperature, max_tokens
                    )
                    result["provider"] = "groq"

                    # Record successful request
                    self.quota_tracker.record_request(
                        provider="groq",
                        tokens_used=result.get("tokens", {}).get("total", 0),
                        prompt_tokens=result.get("tokens", {}).get("prompt", 0),
                        completion_tokens=result.get("tokens", {}).get("completion", 0),
                        model=result.get("model", ""),
                        success=True,
                    )
                    return result

                elif provider == "anthropic" and self.anthropic_client:
                    result = self.anthropic_client.generate(
                        prompt, system_prompt, temperature, max_tokens
                    )
                    result["provider"] = "anthropic"

                    # Record successful request
                    self.quota_tracker.record_request(
                        provider="anthropic",
                        tokens_used=result.get("tokens", {}).get("total", 0),
                        prompt_tokens=result.get("tokens", {}).get("prompt", 0),
                        completion_tokens=result.get("tokens", {}).get("completion", 0),
                        model=result.get("model", ""),
                        success=True,
                    )
                    return result

            except LLMRateLimitError as e:
                # Record failed request due to rate limit
                self.quota_tracker.record_request(
                    provider=provider,
                    tokens_used=0,
                    success=False,
                    error=f"Rate limit: {str(e)}",
                )
                logger.warning(f"Provider {provider} rate limited: {e}")
                errors.append(f"{provider}: Rate limit - {str(e)}")
                continue

            except Exception as e:
                # Record failed request
                self.quota_tracker.record_request(
                    provider=provider,
                    tokens_used=0,
                    success=False,
                    error=str(e),
                )
                logger.warning(f"Provider {provider} failed: {e}")
                errors.append(f"{provider}: {str(e)}")
                continue

        # All providers failed
        error_msg = f"All LLM providers failed: {'; '.join(errors)}"
        logger.error(error_msg)
        raise LLMError(error_msg)

    def generate_with_image(
        self,
        prompt: str,
        image_path: str | Path,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 4096,
    ) -> dict:
        """
        Generate with image (uses Claude vision)

        Args:
            prompt: Text prompt
            image_path: Path to image
            system_prompt: System prompt
            temperature: Temperature
            max_tokens: Max tokens

        Returns:
            dict with response

        Raises:
            LLMError: If Claude is not available or fails
        """
        if not self.anthropic_client:
            raise LLMError("Claude API not configured - required for image analysis")

        try:
            result = self.anthropic_client.generate_with_image(
                prompt, image_path, system_prompt, temperature, max_tokens
            )
            result["provider"] = "anthropic_vision"
            return result
        except Exception as e:
            logger.error(f"Claude vision failed: {e}")
            raise LLMError(f"Image analysis failed: {e}")
