"""
Deep Analysis Pipeline Orchestrator
Coordinates all 4 phases of the analysis pipeline
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from loguru import logger

from src.analysis.clustering import ClusteringService, ClusterResult
from src.analysis.cove_service import CoVeService, VerifiedReport
from src.analysis.embeddings import EmbeddingGenerator
from src.analysis.map_service import ChunkDigest, MapService
from src.analysis.reduce_service import AnalysisReport, ReduceService
from src.analysis.similarity import find_most_similar_pairs


@dataclass
class PipelineResult:
    """Complete result of the analysis pipeline"""

    disciplina: str
    total_questoes: int

    # Phase 1 results
    cluster_result: Optional[ClusterResult] = None
    similar_pairs: list[tuple[str, str, float]] = field(default_factory=list)

    # Phase 2 results
    chunk_digests: list[ChunkDigest] = field(default_factory=list)

    # Phase 3 results
    analysis_report: Optional[AnalysisReport] = None

    # Phase 4 results
    verified_report: Optional[VerifiedReport] = None

    # Metadata
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    phases_completed: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


class AnalysisPipeline:
    """
    Orchestrates the 4-phase deep analysis pipeline:

    Phase 1: Vetorizacao (embeddings + clustering + similarity)
    Phase 2: Map (chunk analysis with Llama 4 Scout)
    Phase 3: Reduce (Multi-Pass synthesis with Claude)
    Phase 4: CoVe (Chain-of-Verification)
    """

    def __init__(
        self,
        embedding_generator: Optional[EmbeddingGenerator] = None,
        clustering_service: Optional[ClusteringService] = None,
        map_service: Optional[MapService] = None,
        reduce_service: Optional[ReduceService] = None,
        cove_service: Optional[CoVeService] = None,
    ):
        self.embedding_generator = embedding_generator or EmbeddingGenerator()
        self.clustering_service = clustering_service or ClusteringService()
        self.map_service = map_service or MapService()
        self.reduce_service = reduce_service or ReduceService()
        self.cove_service = cove_service or CoVeService()

    def run(
        self,
        questoes: list[dict],
        disciplina: str,
        banca: str,
        anos: list[int],
        skip_phases: Optional[list[int]] = None,
    ) -> PipelineResult:
        """
        Run the complete analysis pipeline

        Args:
            questoes: List of question dicts to analyze
            disciplina: Discipline name (e.g., "Portugues")
            banca: Exam board name (e.g., "CEBRASPE")
            anos: List of years covered
            skip_phases: Optional list of phase numbers to skip (1-4)

        Returns:
            PipelineResult with results from all phases
        """
        skip_phases = skip_phases or []

        result = PipelineResult(
            disciplina=disciplina,
            total_questoes=len(questoes),
            started_at=datetime.now(),
        )

        logger.info(f"Starting analysis pipeline for {disciplina}: {len(questoes)} questions")

        try:
            # Phase 1: Vetorizacao
            if 1 not in skip_phases:
                self._run_phase_1(questoes, result)

            # Phase 2: Map
            if 2 not in skip_phases:
                self._run_phase_2(questoes, disciplina, banca, result)

            # Phase 3: Reduce
            if 3 not in skip_phases:
                self._run_phase_3(disciplina, banca, anos, result)

            # Phase 4: CoVe
            if 4 not in skip_phases:
                self._run_phase_4(questoes, result)

        except Exception as e:
            logger.error(f"Pipeline failed: {e}")
            result.errors.append(str(e))

        result.completed_at = datetime.now()
        logger.info(f"Pipeline completed. Phases: {result.phases_completed}")

        return result

    def _run_phase_1(self, questoes: list[dict], result: PipelineResult):
        """Phase 1: Vetorizacao (embeddings + clustering + similarity)"""
        logger.info("Phase 1: Starting Vetorizacao")

        try:
            # Generate embeddings
            logger.info("Generating embeddings...")
            embeddings = []
            questao_ids = []

            for q in questoes:
                q_id = str(q.get("id", q.get("numero", len(embeddings))))
                embedding = self.embedding_generator.generate_question_embedding(q)
                embeddings.append(embedding)
                questao_ids.append(q_id)

            # Cluster embeddings
            logger.info("Clustering embeddings...")
            result.cluster_result = self.clustering_service.cluster_embeddings(embeddings)

            # Find similar pairs
            logger.info("Finding similar pairs...")
            result.similar_pairs = find_most_similar_pairs(
                embeddings, questao_ids, threshold=0.85, top_k=20
            )

            result.phases_completed.append("Phase 1: Vetorizacao")
            logger.info(
                f"Phase 1 complete: {result.cluster_result.n_clusters} clusters, "
                f"{len(result.similar_pairs)} similar pairs"
            )

        except Exception as e:
            logger.error(f"Phase 1 failed: {e}")
            result.errors.append(f"Phase 1: {str(e)}")

    def _run_phase_2(
        self,
        questoes: list[dict],
        disciplina: str,
        banca: str,
        result: PipelineResult,
    ):
        """Phase 2: Map (chunk analysis)"""
        logger.info("Phase 2: Starting Map")

        try:
            # Create chunks
            chunks = self.map_service.create_chunks(questoes)

            # Build cluster info for context
            cluster_info = {}
            if result.cluster_result:
                for cluster_id in result.cluster_result.cluster_sizes.keys():
                    cluster_info[cluster_id] = self.clustering_service.get_cluster_questions(
                        result.cluster_result,
                        [str(q.get("id", q.get("numero", i))) for i, q in enumerate(questoes)],
                        cluster_id,
                    )

            # Analyze each chunk
            result.chunk_digests = []
            for i, chunk in enumerate(chunks):
                digest = self.map_service.analyze_chunk(
                    chunk_id=f"chunk_{i + 1}",
                    questoes=chunk,
                    disciplina=disciplina,
                    banca=banca,
                    cluster_info=cluster_info if cluster_info else None,
                )
                result.chunk_digests.append(digest)

            result.phases_completed.append("Phase 2: Map")
            logger.info(f"Phase 2 complete: {len(result.chunk_digests)} chunks analyzed")

        except Exception as e:
            logger.error(f"Phase 2 failed: {e}")
            result.errors.append(f"Phase 2: {str(e)}")

    def _run_phase_3(
        self,
        disciplina: str,
        banca: str,
        anos: list[int],
        result: PipelineResult,
    ):
        """Phase 3: Reduce (Multi-Pass synthesis)"""
        logger.info("Phase 3: Starting Reduce")

        if not result.chunk_digests:
            logger.warning("Phase 3 skipped: no chunk digests from Phase 2")
            result.errors.append("Phase 3: No chunk digests available")
            return

        try:
            # Build similarity report from Phase 1
            similarity_report = {
                "similar_pairs": [
                    {"q1": p[0], "q2": p[1], "score": p[2]} for p in result.similar_pairs
                ],
                "clusters": (result.cluster_result.n_clusters if result.cluster_result else 0),
            }

            # Run synthesis
            result.analysis_report = self.reduce_service.synthesize(
                chunk_digests=result.chunk_digests,
                similarity_report=similarity_report,
                disciplina=disciplina,
                banca=banca,
                anos=anos,
                total_questoes=result.total_questoes,
            )

            result.phases_completed.append("Phase 3: Reduce")
            logger.info(
                f"Phase 3 complete: "
                f"{len(result.analysis_report.temporal_patterns)} temporal patterns found"
            )

        except Exception as e:
            logger.error(f"Phase 3 failed: {e}")
            result.errors.append(f"Phase 3: {str(e)}")

    def _run_phase_4(self, questoes: list[dict], result: PipelineResult):
        """Phase 4: CoVe (Chain-of-Verification)"""
        logger.info("Phase 4: Starting CoVe")

        if not result.analysis_report:
            logger.warning("Phase 4 skipped: no analysis report from Phase 3")
            result.errors.append("Phase 4: No analysis report available")
            return

        try:
            result.verified_report = self.cove_service.verify_report(
                report_text=result.analysis_report.raw_text,
                questoes=questoes,
                max_claims=15,
            )

            result.phases_completed.append("Phase 4: CoVe")
            logger.info(
                f"Phase 4 complete: "
                f"{result.verified_report.verified_claims}/"
                f"{result.verified_report.original_claims} claims verified"
            )

        except Exception as e:
            logger.error(f"Phase 4 failed: {e}")
            result.errors.append(f"Phase 4: {str(e)}")
