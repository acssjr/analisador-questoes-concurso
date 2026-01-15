"""
Groq API client (fast and free LLM)
"""

import time
from typing import Optional

from groq import Groq
from loguru import logger

from src.core.config import get_settings
from src.core.exceptions import LLMAPIError, LLMRateLimitError

# Retry configuration
MAX_RETRIES = 3
BASE_DELAY = 1.0  # seconds

settings = get_settings()


class GroqClient:
    """Groq API client for text generation"""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.groq_api_key
        if not self.api_key:
            raise ValueError("Groq API key not configured")

        self.client = Groq(api_key=self.api_key)
        self.model = settings.default_text_model  # llama-3.3-70b-versatile

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 4096,
    ) -> dict:
        """
        Generate text completion

        Args:
            prompt: User prompt
            system_prompt: System prompt (optional)
            temperature: Temperature (0.0 - 1.0)
            max_tokens: Max tokens to generate

        Returns:
            dict with:
                - content: Generated text
                - model: Model used
                - tokens: Token usage info
                - raw_response: Full API response

        Raises:
            LLMAPIError: If API request fails
            LLMRateLimitError: If rate limit exceeded
        """
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        last_error = None

        for attempt in range(MAX_RETRIES):
            try:
                logger.debug(
                    f"Calling Groq API with model: {self.model} (attempt {attempt + 1}/{MAX_RETRIES})"
                )

                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )

                content = response.choices[0].message.content

                logger.info(
                    f"Groq API success - Tokens: {response.usage.total_tokens if response.usage else 'N/A'}"
                )

                return {
                    "content": content,
                    "model": self.model,
                    "tokens": {
                        "prompt": response.usage.prompt_tokens if response.usage else None,
                        "completion": response.usage.completion_tokens if response.usage else None,
                        "total": response.usage.total_tokens if response.usage else None,
                    },
                    "raw_response": response.model_dump(),
                }

            except Exception as e:
                error_msg = str(e)

                # Check if rate limit error
                if "rate_limit" in error_msg.lower():
                    last_error = e
                    if attempt < MAX_RETRIES - 1:
                        delay = BASE_DELAY * (2**attempt)
                        logger.warning(
                            f"Groq rate limit hit, retrying in {delay}s (attempt {attempt + 1}/{MAX_RETRIES})"
                        )
                        time.sleep(delay)
                        continue
                    else:
                        logger.error(
                            f"Groq rate limit exceeded after {MAX_RETRIES} attempts: {error_msg}"
                        )
                        raise LLMRateLimitError(f"Groq rate limit: {error_msg}")
                else:
                    # Non-rate-limit errors: fail immediately
                    logger.error(f"Groq API error: {error_msg}")
                    raise LLMAPIError(f"Groq API failed: {error_msg}")

        # Should not reach here, but just in case
        raise LLMRateLimitError(f"Groq rate limit: {last_error}")

    async def generate_async(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 4096,
    ) -> dict:
        """Async version of generate (uses sync internally for now)"""
        # Groq SDK doesn't have async support yet, so we use sync
        return self.generate(prompt, system_prompt, temperature, max_tokens)
