"""
Analysis module for question analysis and clustering
"""
from src.analysis.clustering import ClusteringService, ClusterResult
from src.analysis.cove_service import CoVeService, VerificationResult, VerifiedReport
from src.analysis.embeddings import EmbeddingGenerator
from src.analysis.map_service import ChunkDigest, MapService, QuestionAnalysis
from src.analysis.reduce_service import AnalysisReport, PatternFinding, ReduceService
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
    # CoVe Service (Phase 4 deep analysis - Chain-of-Verification)
    "CoVeService",
    "VerificationResult",
    "VerifiedReport",
    # Embeddings
    "EmbeddingGenerator",
    # Map Service (Phase 2 deep analysis)
    "MapService",
    "ChunkDigest",
    "QuestionAnalysis",
    # Reduce Service (Phase 3 deep analysis)
    "ReduceService",
    "AnalysisReport",
    "PatternFinding",
    # Similarity
    "calculate_cosine_similarity",
    "calculate_similarity_matrix",
    "find_most_similar_pairs",
    "find_similar_questions",
]
