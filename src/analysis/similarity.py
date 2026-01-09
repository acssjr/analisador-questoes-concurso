"""
Similarity calculation between questions
"""
import numpy as np
from loguru import logger
from sklearn.metrics.pairwise import cosine_similarity


def calculate_cosine_similarity(embedding1: list[float], embedding2: list[float]) -> float:
    """
    Calculate cosine similarity between two embeddings

    Args:
        embedding1: First embedding vector
        embedding2: Second embedding vector

    Returns:
        float: Similarity score (0.0 - 1.0)
    """
    vec1 = np.array(embedding1).reshape(1, -1)
    vec2 = np.array(embedding2).reshape(1, -1)
    similarity = cosine_similarity(vec1, vec2)[0][0]
    return float(similarity)


def find_similar_questions(
    target_embedding: list[float],
    all_embeddings: list[tuple[str, list[float]]],  # (questao_id, embedding)
    threshold: float = 0.75,
    top_k: int = 10,
) -> list[tuple[str, float]]:
    """
    Find most similar questions to target

    Args:
        target_embedding: Target question embedding
        all_embeddings: List of (questao_id, embedding) tuples
        threshold: Minimum similarity threshold
        top_k: Maximum number of results

    Returns:
        list of (questao_id, similarity_score) tuples, sorted by similarity desc
    """
    target_vec = np.array(target_embedding).reshape(1, -1)

    similarities = []
    for questao_id, embedding in all_embeddings:
        vec = np.array(embedding).reshape(1, -1)
        sim = cosine_similarity(target_vec, vec)[0][0]
        if sim >= threshold:
            similarities.append((questao_id, float(sim)))

    # Sort by similarity desc
    similarities.sort(key=lambda x: x[1], reverse=True)

    return similarities[:top_k]


def calculate_similarity_matrix(embeddings: list[list[float]]) -> np.ndarray:
    """
    Calculate pairwise similarity matrix for all embeddings

    Args:
        embeddings: List of embedding vectors

    Returns:
        numpy array of shape (n, n) with similarity scores
    """
    logger.debug(f"Calculating similarity matrix for {len(embeddings)} embeddings")
    vectors = np.array(embeddings)
    similarity_matrix = cosine_similarity(vectors)
    return similarity_matrix


def find_most_similar_pairs(
    embeddings: list[list[float]],
    questao_ids: list[str],
    threshold: float = 0.75,
    top_k: int = 20,
) -> list[tuple[str, str, float]]:
    """
    Find most similar question pairs

    Args:
        embeddings: List of embeddings
        questao_ids: List of question IDs (same order as embeddings)
        threshold: Minimum similarity threshold
        top_k: Maximum number of pairs

    Returns:
        list of (questao_id1, questao_id2, similarity) tuples
    """
    sim_matrix = calculate_similarity_matrix(embeddings)

    pairs = []
    n = len(questao_ids)

    for i in range(n):
        for j in range(i + 1, n):  # Only upper triangle (avoid duplicates)
            similarity = sim_matrix[i, j]
            if similarity >= threshold:
                pairs.append((questao_ids[i], questao_ids[j], float(similarity)))

    # Sort by similarity desc
    pairs.sort(key=lambda x: x[2], reverse=True)

    logger.info(f"Found {len(pairs)} similar pairs (threshold={threshold})")

    return pairs[:top_k]
