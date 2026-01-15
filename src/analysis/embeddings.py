"""
Embeddings generation using sentence-transformers
"""

from typing import Optional

from loguru import logger
from sentence_transformers import SentenceTransformer

from src.core.config import get_settings
from src.core.exceptions import EmbeddingError

settings = get_settings()


class EmbeddingGenerator:
    """Generate embeddings for semantic similarity"""

    def __init__(self, model_name: Optional[str] = None):
        self.model_name = model_name or settings.embedding_model
        logger.info(f"Loading embedding model: {self.model_name}")
        try:
            self.model = SentenceTransformer(self.model_name)
            logger.info(
                f"Model loaded successfully - Dimension: {self.model.get_sentence_embedding_dimension()}"
            )
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            raise EmbeddingError(f"Failed to load model: {e}")

    def generate_embedding(self, text: str) -> list[float]:
        """
        Generate embedding for a single text

        Args:
            text: Input text

        Returns:
            list of floats (embedding vector)

        Raises:
            EmbeddingError: If generation fails
        """
        try:
            embedding = self.model.encode(text, convert_to_numpy=True)
            return embedding.tolist()
        except Exception as e:
            logger.error(f"Failed to generate embedding: {e}")
            raise EmbeddingError(f"Embedding generation failed: {e}")

    def generate_embeddings_batch(self, texts: list[str]) -> list[list[float]]:
        """
        Generate embeddings for multiple texts (batched for efficiency)

        Args:
            texts: List of input texts

        Returns:
            list of embeddings

        Raises:
            EmbeddingError: If generation fails
        """
        try:
            logger.debug(f"Generating embeddings for {len(texts)} texts")
            embeddings = self.model.encode(texts, convert_to_numpy=True, batch_size=32)
            return embeddings.tolist()
        except Exception as e:
            logger.error(f"Failed to generate batch embeddings: {e}")
            raise EmbeddingError(f"Batch embedding generation failed: {e}")

    def generate_question_embedding(self, questao: dict, tipo: str = "enunciado") -> list[float]:
        """
        Generate embedding for a question

        Args:
            questao: Question dict
            tipo: Type of embedding:
                - 'enunciado': only enunciado
                - 'enunciado_completo': enunciado + alternativas
                - 'resposta_correta': only correct answer text

        Returns:
            list[float]: Embedding vector
        """
        if tipo == "enunciado":
            text = questao.get("enunciado", "")

        elif tipo == "enunciado_completo":
            text = questao.get("enunciado", "")
            alternativas = questao.get("alternativas", {})
            for letra, conteudo in alternativas.items():
                text += f"\n{letra}) {conteudo}"

        elif tipo == "resposta_correta":
            gabarito = questao.get("gabarito")
            alternativas = questao.get("alternativas", {})
            text = alternativas.get(gabarito, "") if gabarito else ""

        else:
            raise ValueError(f"Unknown embedding type: {tipo}")

        return self.generate_embedding(text)
