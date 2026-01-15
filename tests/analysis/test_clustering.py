"""Tests for clustering service"""

import numpy as np

from src.analysis.clustering import ClusteringService, ClusterResult


def test_clustering_service_basic():
    """Basic clustering test"""
    service = ClusteringService(min_cluster_size=2, min_samples=2, use_umap=False)

    # Create simple embeddings with 2 clear clusters
    np.random.seed(42)
    cluster1 = np.random.randn(5, 10) + np.array([10] * 10)
    cluster2 = np.random.randn(5, 10) + np.array([-10] * 10)
    embeddings = np.vstack([cluster1, cluster2]).tolist()

    result = service.cluster_embeddings(embeddings)

    assert isinstance(result, ClusterResult)
    assert len(result.cluster_labels) == 10
    assert result.n_clusters >= 1  # Should find at least 1 cluster


def test_clustering_with_umap():
    """Test clustering with UMAP dimensionality reduction"""
    service = ClusteringService(
        min_cluster_size=3, min_samples=2, use_umap=True, umap_n_components=5
    )

    # Create embeddings with higher dimension
    np.random.seed(42)
    cluster1 = np.random.randn(10, 768) + np.array([5] * 768)
    cluster2 = np.random.randn(10, 768) + np.array([-5] * 768)
    embeddings = np.vstack([cluster1, cluster2]).tolist()

    result = service.cluster_embeddings(embeddings)

    assert isinstance(result, ClusterResult)
    assert len(result.cluster_labels) == 20


def test_clustering_too_few_points():
    """Should handle too few points gracefully"""
    service = ClusteringService(min_cluster_size=5)
    embeddings = [[1.0, 2.0, 3.0], [4.0, 5.0, 6.0]]  # Only 2 points

    result = service.cluster_embeddings(embeddings)

    assert result.n_clusters == 0
    assert result.noise_count == 2


def test_get_cluster_questions():
    """Test getting questions by cluster"""
    service = ClusteringService()

    result = ClusterResult(
        cluster_labels=[0, 0, 1, 1, -1],
        n_clusters=2,
        cluster_sizes={0: 2, 1: 2},
        centroids={},
        noise_count=1,
    )
    questao_ids = ["q1", "q2", "q3", "q4", "q5"]

    cluster_0 = service.get_cluster_questions(result, questao_ids, 0)
    cluster_1 = service.get_cluster_questions(result, questao_ids, 1)

    assert cluster_0 == ["q1", "q2"]
    assert cluster_1 == ["q3", "q4"]


def test_clustering_returns_centroids():
    """Test that clustering returns valid centroids"""
    service = ClusteringService(min_cluster_size=2, min_samples=2, use_umap=False)

    # Create clear clusters
    np.random.seed(42)
    cluster1 = np.random.randn(5, 10) + np.array([10] * 10)
    cluster2 = np.random.randn(5, 10) + np.array([-10] * 10)
    embeddings = np.vstack([cluster1, cluster2]).tolist()

    result = service.cluster_embeddings(embeddings)

    # Check centroids are computed for each cluster
    for cluster_id in result.cluster_sizes.keys():
        assert cluster_id in result.centroids
        # Centroids should have same dimension as original embeddings
        assert len(result.centroids[cluster_id]) == 10


def test_clustering_cluster_sizes_match_labels():
    """Test that cluster_sizes matches actual label counts"""
    service = ClusteringService(min_cluster_size=2, min_samples=2, use_umap=False)

    np.random.seed(42)
    cluster1 = np.random.randn(5, 10) + np.array([10] * 10)
    cluster2 = np.random.randn(5, 10) + np.array([-10] * 10)
    embeddings = np.vstack([cluster1, cluster2]).tolist()

    result = service.cluster_embeddings(embeddings)

    # Count labels manually
    labels = result.cluster_labels
    for cluster_id, expected_size in result.cluster_sizes.items():
        actual_size = sum(1 for label in labels if label == cluster_id)
        assert actual_size == expected_size


def test_clustering_empty_embeddings():
    """Test handling of empty embeddings list"""
    service = ClusteringService(min_cluster_size=2)

    result = service.cluster_embeddings([])

    assert result.n_clusters == 0
    assert result.noise_count == 0
    assert result.cluster_labels == []
