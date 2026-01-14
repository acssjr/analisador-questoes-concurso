"""
Analysis module for question analysis and clustering
"""
from src.analysis.clustering import ClusteringService, ClusterResult
from src.analysis.embeddings import EmbeddingGenerator
from src.analysis.similarity import (
    calculate_cosine_similarity,
    calculate_similarity_matrix,
    find_most_similar_pairs,
    find_similar_questions,
)

__all__ = [
    # Clustering
    "ClusteringService",
    "ClusterResult",
    # Embeddings
    "EmbeddingGenerator",
    # Similarity
    "calculate_cosine_similarity",
    "calculate_similarity_matrix",
    "find_most_similar_pairs",
    "find_similar_questions",
]
