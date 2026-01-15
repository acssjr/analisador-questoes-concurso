"""
Anthropic Claude API client (multimodal - vision support)
"""

import base64
from pathlib import Path
from typing import Optional

from anthropic import Anthropic
from loguru import logger

from src.core.config import get_settings
from src.core.exceptions import LLMAPIError

settings = get_settings()


class AnthropicClient:
    """Anthropic Claude API client with vision support"""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.anthropic_api_key
        if not self.api_key:
            raise ValueError("Anthropic API key not configured")

        self.client = Anthropic(api_key=self.api_key)
        self.model = settings.default_vision_model  # claude-3-5-sonnet-20241022

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 4096,
    ) -> dict:
        """Text-only generation"""
        try:
            messages = [{"role": "user", "content": prompt}]

            logger.debug(f"Calling Claude API (text-only) with model: {self.model}")

            response = self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_prompt if system_prompt else None,
                messages=messages,
            )

            content = response.content[0].text

            logger.info(
                f"Claude API success - Tokens: input={response.usage.input_tokens}, output={response.usage.output_tokens}"
            )

            return {
                "content": content,
                "model": self.model,
                "tokens": {
                    "prompt": response.usage.input_tokens,
                    "completion": response.usage.output_tokens,
                    "total": response.usage.input_tokens + response.usage.output_tokens,
                },
                "raw_response": response.model_dump(),
            }

        except Exception as e:
            logger.error(f"Claude API error: {e}")
            raise LLMAPIError(f"Claude API failed: {e}")

    def generate_with_image(
        self,
        prompt: str,
        image_path: str | Path,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 4096,
    ) -> dict:
        """
        Generate with image (multimodal)

        Args:
            prompt: Text prompt
            image_path: Path to image file
            system_prompt: System prompt
            temperature: Temperature
            max_tokens: Max tokens

        Returns:
            dict with response
        """
        try:
            # Read and encode image
            image_path = Path(image_path)
            with open(image_path, "rb") as f:
                image_data = base64.standard_b64encode(f.read()).decode("utf-8")

            # Detect media type
            ext = image_path.suffix.lower()
            media_type_map = {
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
                ".gif": "image/gif",
                ".webp": "image/webp",
            }
            media_type = media_type_map.get(ext, "image/jpeg")

            # Build message with image
            messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_data,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ]

            logger.debug(f"Calling Claude API (vision) with image: {image_path}")

            response = self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_prompt if system_prompt else None,
                messages=messages,
            )

            content = response.content[0].text

            logger.info(
                f"Claude Vision API success - Tokens: input={response.usage.input_tokens}, output={response.usage.output_tokens}"
            )

            return {
                "content": content,
                "model": self.model,
                "tokens": {
                    "prompt": response.usage.input_tokens,
                    "completion": response.usage.output_tokens,
                    "total": response.usage.input_tokens + response.usage.output_tokens,
                },
                "raw_response": response.model_dump(),
            }

        except Exception as e:
            logger.error(f"Claude Vision API error: {e}")
            raise LLMAPIError(f"Claude Vision API failed: {e}")
