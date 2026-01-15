"""
Question classifier using LLM
"""

import json
import time
from typing import Optional

from loguru import logger

from src.core.exceptions import ClassificationError, LLMResponseError
from src.llm.llm_orchestrator import LLMOrchestrator
from src.llm.prompts.classificacao import (
    SYSTEM_PROMPT_CLASSIFICACAO,
    build_classification_prompt,
)
from src.optimization.token_utils import estimate_tokens, prune_questao

# Throttling configuration for batch operations
BATCH_DELAY_SECONDS = 0.5  # Delay between API calls to avoid rate limits

# Output control: limit response tokens (classification JSON needs ~200-300 tokens max)
MAX_OUTPUT_TOKENS = 512


class QuestionClassifier:
    """Classifies questions using LLM"""

    def __init__(self):
        self.llm = LLMOrchestrator()

    def classify_question(
        self,
        questao: dict,
        edital_taxonomia: Optional[dict] = None,
        temperature: float = 0.1,
    ) -> dict:
        """
        Classify a single question

        Args:
            questao: Question dict with enunciado, alternativas, etc
            edital_taxonomia: Optional edital taxonomy
            temperature: LLM temperature

        Returns:
            dict with classification results

        Raises:
            ClassificationError: If classification fails
        """
        try:
            # Token optimization: prune unnecessary tokens from question
            questao_otimizada = prune_questao(questao)
            tokens_before = estimate_tokens(questao.get("enunciado", ""))
            tokens_after = estimate_tokens(questao_otimizada.get("enunciado", ""))
            if tokens_before > tokens_after:
                logger.debug(
                    f"Token optimization: {tokens_before} → {tokens_after} tokens (-{tokens_before - tokens_after})"
                )

            # Build prompt with optimized question
            prompt = build_classification_prompt(questao_otimizada, edital_taxonomia)

            logger.debug(f"Classifying question #{questao.get('numero')}")

            # Call LLM with output control (reduced max_tokens)
            response = self.llm.generate(
                prompt=prompt,
                system_prompt=SYSTEM_PROMPT_CLASSIFICACAO,
                temperature=temperature,
                max_tokens=MAX_OUTPUT_TOKENS,  # Reduced from 2048 - JSON needs ~200-300 max
            )

            # Parse JSON response
            classification = self._parse_llm_response(response["content"])

            # Add metadata
            classification["llm_provider"] = response.get("provider")
            classification["llm_model"] = response.get("model")
            classification["prompt_usado"] = prompt
            classification["raw_response"] = response

            logger.info(
                f"Question #{questao.get('numero')} classified as: {classification.get('disciplina')} → {classification.get('assunto')}"
            )

            return classification

        except Exception as e:
            logger.error(f"Failed to classify question: {e}")
            raise ClassificationError(f"Classification failed: {e}")

    def _parse_llm_response(self, response_text: str) -> dict:
        """
        Parse LLM JSON response

        Args:
            response_text: Raw LLM response

        Returns:
            dict with parsed classification

        Raises:
            LLMResponseError: If parsing fails
        """
        try:
            # Extract JSON from markdown code blocks if present
            if "```json" in response_text:
                start = response_text.find("```json") + 7
                end = response_text.find("```", start)
                json_str = response_text[start:end].strip()
            elif "```" in response_text:
                start = response_text.find("```") + 3
                end = response_text.find("```", start)
                json_str = response_text[start:end].strip()
            else:
                json_str = response_text.strip()

            # Parse JSON
            classification = json.loads(json_str)

            # Validate required fields
            required_fields = ["disciplina", "assunto"]
            for field in required_fields:
                if field not in classification:
                    raise ValueError(f"Missing required field: {field}")

            return classification

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM JSON response: {e}")
            logger.debug(f"Response text: {response_text}")
            raise LLMResponseError(f"Invalid JSON response: {e}")
        except Exception as e:
            logger.error(f"Failed to parse LLM response: {e}")
            raise LLMResponseError(f"Failed to parse response: {e}")

    async def classify_question_async(
        self,
        questao: dict,
        edital_taxonomia: Optional[dict] = None,
        temperature: float = 0.1,
    ) -> dict:
        """Async version of classify_question"""
        # For now, just calls sync version
        # TODO: implement true async when LLM clients support it
        return self.classify_question(questao, edital_taxonomia, temperature)

    def classify_batch(
        self,
        questoes: list[dict],
        edital_taxonomia: Optional[dict] = None,
        temperature: float = 0.1,
    ) -> list[dict]:
        """
        Classify multiple questions

        Args:
            questoes: List of question dicts
            edital_taxonomia: Optional edital taxonomy
            temperature: LLM temperature

        Returns:
            list of classification dicts
        """
        results = []

        for i, questao in enumerate(questoes):
            # Throttle between API calls to avoid rate limits
            if i > 0:
                logger.debug(f"Throttling: waiting {BATCH_DELAY_SECONDS}s before next API call")
                time.sleep(BATCH_DELAY_SECONDS)

            logger.info(f"Classifying question {i + 1}/{len(questoes)}")
            try:
                classification = self.classify_question(questao, edital_taxonomia, temperature)
                classification["questao_numero"] = questao.get("numero")
                results.append(classification)
            except Exception as e:
                logger.error(f"Failed to classify question #{questao.get('numero')}: {e}")
                # Add error placeholder
                results.append(
                    {
                        "questao_numero": questao.get("numero"),
                        "disciplina": questao.get("disciplina", "UNKNOWN"),
                        "assunto": None,
                        "erro": str(e),
                    }
                )

        logger.info(f"Classified {len(results)}/{len(questoes)} questions")
        return results
