"""
Clustering service using HDBSCAN for automatic cluster detection
Part of Phase 1 (Vetorizacao) of the deep analysis pipeline
"""

from dataclasses import dataclass

import hdbscan
import numpy as np
from loguru import logger
from umap import UMAP


@dataclass
class ClusterResult:
    """Result of clustering operation"""

    cluster_labels: list[int]  # -1 = noise
    n_clusters: int
    cluster_sizes: dict[int, int]  # cluster_id -> size
    centroids: dict[int, list[float]]  # cluster_id -> centroid
    noise_count: int


class ClusteringService:
    """
    Clustering service using HDBSCAN

    HDBSCAN advantages:
    - Auto-detects number of clusters
    - Handles noise (outliers labeled as -1)
    - Works well with varying density
    """

    def __init__(
        self,
        min_cluster_size: int = 5,
        min_samples: int = 3,
        use_umap: bool = True,
        umap_n_components: int = 10,
        umap_n_neighbors: int = 15,
    ):
        self.min_cluster_size = min_cluster_size
        self.min_samples = min_samples
        self.use_umap = use_umap
        self.umap_n_components = umap_n_components
        self.umap_n_neighbors = umap_n_neighbors

    def cluster_embeddings(
        self,
        embeddings: list[list[float]],
    ) -> ClusterResult:
        """
        Cluster embeddings using HDBSCAN

        Args:
            embeddings: List of embedding vectors

        Returns:
            ClusterResult with cluster assignments and metadata
        """
        if len(embeddings) < self.min_cluster_size:
            logger.warning(f"Too few embeddings ({len(embeddings)}) for clustering")
            return ClusterResult(
                cluster_labels=[-1] * len(embeddings),
                n_clusters=0,
                cluster_sizes={},
                centroids={},
                noise_count=len(embeddings),
            )

        data = np.array(embeddings)
        logger.info(f"Clustering {len(embeddings)} embeddings (dim={data.shape[1]})")

        # Optional UMAP dimensionality reduction
        if self.use_umap and data.shape[1] > self.umap_n_components:
            logger.info(
                f"Reducing dimensions with UMAP: {data.shape[1]} -> {self.umap_n_components}"
            )
            reducer = UMAP(
                n_components=self.umap_n_components,
                n_neighbors=min(self.umap_n_neighbors, len(embeddings) - 1),
                metric="cosine",
                random_state=42,
            )
            data = reducer.fit_transform(data)

        # HDBSCAN clustering
        logger.info(f"Running HDBSCAN (min_cluster_size={self.min_cluster_size})")
        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=self.min_cluster_size,
            min_samples=self.min_samples,
            metric="euclidean",
            cluster_selection_epsilon=0.0,
        )
        labels = clusterer.fit_predict(data)

        # Calculate cluster statistics
        unique_labels = set(labels)
        n_clusters = len(unique_labels) - (1 if -1 in unique_labels else 0)

        cluster_sizes = {}
        centroids = {}
        original_embeddings = np.array(embeddings)  # Use original for centroids

        for label in unique_labels:
            if label == -1:
                continue
            mask = labels == label
            cluster_sizes[label] = int(mask.sum())
            centroids[label] = original_embeddings[mask].mean(axis=0).tolist()

        noise_count = int((labels == -1).sum())

        logger.info(f"Found {n_clusters} clusters, {noise_count} noise points")

        return ClusterResult(
            cluster_labels=labels.tolist(),
            n_clusters=n_clusters,
            cluster_sizes=cluster_sizes,
            centroids=centroids,
            noise_count=noise_count,
        )

    def get_cluster_questions(
        self, cluster_result: ClusterResult, questao_ids: list[str], cluster_id: int
    ) -> list[str]:
        """Get question IDs belonging to a specific cluster"""
        return [
            qid
            for qid, label in zip(questao_ids, cluster_result.cluster_labels)
            if label == cluster_id
        ]
