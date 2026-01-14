"""Tests for Analysis Pipeline Orchestrator"""
import pytest
from datetime import datetime
from unittest.mock import MagicMock, patch

from src.analysis.clustering import ClusterResult
from src.analysis.cove_service import VerifiedReport
from src.analysis.map_service import ChunkDigest, QuestionAnalysis
from src.analysis.pipeline import AnalysisPipeline, PipelineResult
from src.analysis.reduce_service import AnalysisReport


def test_pipeline_initialization():
    """Test pipeline initialization with default services"""
    with patch("src.analysis.pipeline.EmbeddingGenerator"):
        with patch("src.analysis.pipeline.ClusteringService"):
            with patch("src.analysis.pipeline.MapService"):
                with patch("src.analysis.pipeline.ReduceService"):
                    with patch("src.analysis.pipeline.CoVeService"):
                        pipeline = AnalysisPipeline()
                        assert pipeline is not None


def test_pipeline_result_dataclass():
    """Test PipelineResult dataclass"""
    result = PipelineResult(disciplina="Portugues", total_questoes=50)

    assert result.disciplina == "Portugues"
    assert result.total_questoes == 50
    assert result.phases_completed == []
    assert result.errors == []
    assert result.cluster_result is None
    assert result.similar_pairs == []
    assert result.chunk_digests == []
    assert result.analysis_report is None
    assert result.verified_report is None


def test_pipeline_result_with_all_fields():
    """Test PipelineResult with all fields populated"""
    cluster_result = ClusterResult(
        cluster_labels=[0, 1, 0],
        n_clusters=2,
        cluster_sizes={0: 2, 1: 1},
        centroids={},
        noise_count=0,
    )

    result = PipelineResult(
        disciplina="Direito",
        total_questoes=100,
        cluster_result=cluster_result,
        similar_pairs=[("q1", "q2", 0.95)],
        chunk_digests=[],
        started_at=datetime.now(),
        phases_completed=["Phase 1: Vetorizacao"],
    )

    assert result.cluster_result.n_clusters == 2
    assert len(result.similar_pairs) == 1
    assert "Phase 1" in result.phases_completed[0]


def test_pipeline_run_all_phases():
    """Test running all phases"""
    # Mock all services
    mock_embedding = MagicMock()
    mock_embedding.generate_question_embedding.return_value = [0.1] * 768

    mock_clustering = MagicMock()
    mock_clustering.cluster_embeddings.return_value = ClusterResult(
        cluster_labels=[0, 0, 1],
        n_clusters=2,
        cluster_sizes={0: 2, 1: 1},
        centroids={},
        noise_count=0,
    )
    mock_clustering.get_cluster_questions.return_value = ["q1", "q2"]

    mock_map = MagicMock()
    mock_map.create_chunks.return_value = [[{"id": "q1"}]]
    mock_map.analyze_chunk.return_value = ChunkDigest(
        chunk_id="chunk_1", summary="Test", patterns_found=[], questions_analysis=[]
    )

    mock_reduce = MagicMock()
    mock_reduce.synthesize.return_value = AnalysisReport(
        disciplina="Portugues",
        total_questoes=3,
        temporal_patterns=[],
        similarity_patterns=[],
        difficulty_analysis={},
        trap_analysis={},
        study_recommendations=[],
        raw_text="Test report",
    )

    mock_cove = MagicMock()
    mock_cove.verify_report.return_value = VerifiedReport(
        original_claims=5,
        verified_claims=4,
        rejected_claims=1,
        verification_results=[],
        cleaned_report="Verified report",
    )

    pipeline = AnalysisPipeline(
        embedding_generator=mock_embedding,
        clustering_service=mock_clustering,
        map_service=mock_map,
        reduce_service=mock_reduce,
        cove_service=mock_cove,
    )

    questoes = [
        {"id": "q1", "enunciado": "Test 1"},
        {"id": "q2", "enunciado": "Test 2"},
        {"id": "q3", "enunciado": "Test 3"},
    ]

    result = pipeline.run(
        questoes=questoes, disciplina="Portugues", banca="CEBRASPE", anos=[2022, 2023]
    )

    assert len(result.phases_completed) == 4
    assert result.verified_report is not None
    assert result.started_at is not None
    assert result.completed_at is not None
    assert result.disciplina == "Portugues"
    assert result.total_questoes == 3


def test_pipeline_skip_phases():
    """Test skipping specific phases"""
    mock_embedding = MagicMock()
    mock_embedding.generate_question_embedding.return_value = [0.1] * 768

    mock_clustering = MagicMock()
    mock_clustering.cluster_embeddings.return_value = ClusterResult(
        cluster_labels=[0], n_clusters=1, cluster_sizes={0: 1}, centroids={}, noise_count=0
    )

    pipeline = AnalysisPipeline(
        embedding_generator=mock_embedding,
        clustering_service=mock_clustering,
        map_service=MagicMock(),
        reduce_service=MagicMock(),
        cove_service=MagicMock(),
    )

    result = pipeline.run(
        questoes=[{"id": "q1"}],
        disciplina="Test",
        banca="Test",
        anos=[2023],
        skip_phases=[2, 3, 4],
    )

    assert "Phase 1" in result.phases_completed[0]
    assert len(result.phases_completed) == 1


def test_pipeline_skip_all_phases():
    """Test skipping all phases"""
    pipeline = AnalysisPipeline(
        embedding_generator=MagicMock(),
        clustering_service=MagicMock(),
        map_service=MagicMock(),
        reduce_service=MagicMock(),
        cove_service=MagicMock(),
    )

    result = pipeline.run(
        questoes=[{"id": "q1"}],
        disciplina="Test",
        banca="Test",
        anos=[2023],
        skip_phases=[1, 2, 3, 4],
    )

    assert len(result.phases_completed) == 0
    assert result.started_at is not None
    assert result.completed_at is not None


def test_pipeline_handles_phase_1_errors():
    """Test error handling when Phase 1 fails"""
    mock_embedding = MagicMock()
    mock_embedding.generate_question_embedding.side_effect = Exception("Embedding failed")

    pipeline = AnalysisPipeline(
        embedding_generator=mock_embedding,
        clustering_service=MagicMock(),
        map_service=MagicMock(),
        reduce_service=MagicMock(),
        cove_service=MagicMock(),
    )

    result = pipeline.run(
        questoes=[{"id": "q1"}], disciplina="Test", banca="Test", anos=[2023]
    )

    assert len(result.errors) > 0
    assert "Phase 1" in result.errors[0]


def test_pipeline_handles_phase_2_errors():
    """Test error handling when Phase 2 fails"""
    mock_embedding = MagicMock()
    mock_embedding.generate_question_embedding.return_value = [0.1] * 768

    mock_clustering = MagicMock()
    mock_clustering.cluster_embeddings.return_value = ClusterResult(
        cluster_labels=[0], n_clusters=1, cluster_sizes={0: 1}, centroids={}, noise_count=0
    )

    mock_map = MagicMock()
    mock_map.create_chunks.side_effect = Exception("Map failed")

    pipeline = AnalysisPipeline(
        embedding_generator=mock_embedding,
        clustering_service=mock_clustering,
        map_service=mock_map,
        reduce_service=MagicMock(),
        cove_service=MagicMock(),
    )

    result = pipeline.run(
        questoes=[{"id": "q1"}], disciplina="Test", banca="Test", anos=[2023]
    )

    # Phase 1 should complete, Phase 2 should fail
    assert "Phase 1" in result.phases_completed[0]
    assert any("Phase 2" in err for err in result.errors)


def test_pipeline_phase_3_skipped_without_chunk_digests():
    """Test Phase 3 is skipped if no chunk digests available"""
    mock_embedding = MagicMock()
    mock_embedding.generate_question_embedding.return_value = [0.1] * 768

    mock_clustering = MagicMock()
    mock_clustering.cluster_embeddings.return_value = ClusterResult(
        cluster_labels=[0], n_clusters=1, cluster_sizes={0: 1}, centroids={}, noise_count=0
    )

    pipeline = AnalysisPipeline(
        embedding_generator=mock_embedding,
        clustering_service=mock_clustering,
        map_service=MagicMock(),
        reduce_service=MagicMock(),
        cove_service=MagicMock(),
    )

    # Skip Phase 2 so there are no chunk digests
    result = pipeline.run(
        questoes=[{"id": "q1"}],
        disciplina="Test",
        banca="Test",
        anos=[2023],
        skip_phases=[2],
    )

    assert "Phase 1" in result.phases_completed[0]
    # Phase 3 should have error about no chunk digests
    assert any("No chunk digests" in err for err in result.errors)


def test_pipeline_phase_4_skipped_without_analysis_report():
    """Test Phase 4 is skipped if no analysis report available"""
    mock_embedding = MagicMock()
    mock_embedding.generate_question_embedding.return_value = [0.1] * 768

    mock_clustering = MagicMock()
    mock_clustering.cluster_embeddings.return_value = ClusterResult(
        cluster_labels=[0], n_clusters=1, cluster_sizes={0: 1}, centroids={}, noise_count=0
    )

    mock_map = MagicMock()
    mock_map.create_chunks.return_value = [[{"id": "q1"}]]
    mock_map.analyze_chunk.return_value = ChunkDigest(
        chunk_id="chunk_1", summary="Test", patterns_found=[], questions_analysis=[]
    )

    pipeline = AnalysisPipeline(
        embedding_generator=mock_embedding,
        clustering_service=mock_clustering,
        map_service=mock_map,
        reduce_service=MagicMock(),
        cove_service=MagicMock(),
    )

    # Skip Phase 3 so there is no analysis report
    result = pipeline.run(
        questoes=[{"id": "q1"}],
        disciplina="Test",
        banca="Test",
        anos=[2023],
        skip_phases=[3],
    )

    assert "Phase 1" in result.phases_completed[0]
    assert "Phase 2" in result.phases_completed[1]
    # Phase 4 should have error about no analysis report
    assert any("No analysis report" in err for err in result.errors)


def test_pipeline_uses_question_ids_correctly():
    """Test pipeline extracts question IDs correctly"""
    mock_embedding = MagicMock()
    mock_embedding.generate_question_embedding.return_value = [0.1] * 768

    mock_clustering = MagicMock()
    mock_clustering.cluster_embeddings.return_value = ClusterResult(
        cluster_labels=[0, 1],
        n_clusters=2,
        cluster_sizes={0: 1, 1: 1},
        centroids={},
        noise_count=0,
    )

    pipeline = AnalysisPipeline(
        embedding_generator=mock_embedding,
        clustering_service=mock_clustering,
        map_service=MagicMock(),
        reduce_service=MagicMock(),
        cove_service=MagicMock(),
    )

    # Test with 'id' field
    questoes_with_id = [{"id": "Q001"}, {"id": "Q002"}]
    result = pipeline.run(
        questoes=questoes_with_id,
        disciplina="Test",
        banca="Test",
        anos=[2023],
        skip_phases=[2, 3, 4],
    )

    assert result.cluster_result is not None

    # Test with 'numero' field as fallback
    questoes_with_numero = [{"numero": 1}, {"numero": 2}]
    result2 = pipeline.run(
        questoes=questoes_with_numero,
        disciplina="Test",
        banca="Test",
        anos=[2023],
        skip_phases=[2, 3, 4],
    )

    assert result2.cluster_result is not None


def test_pipeline_builds_cluster_info_for_phase_2():
    """Test pipeline builds cluster info for Phase 2 context"""
    mock_embedding = MagicMock()
    mock_embedding.generate_question_embedding.return_value = [0.1] * 768

    mock_clustering = MagicMock()
    mock_clustering.cluster_embeddings.return_value = ClusterResult(
        cluster_labels=[0, 0, 1],
        n_clusters=2,
        cluster_sizes={0: 2, 1: 1},
        centroids={},
        noise_count=0,
    )
    mock_clustering.get_cluster_questions.return_value = ["q1", "q2"]

    mock_map = MagicMock()
    mock_map.create_chunks.return_value = [[{"id": "q1"}, {"id": "q2"}, {"id": "q3"}]]
    mock_map.analyze_chunk.return_value = ChunkDigest(
        chunk_id="chunk_1", summary="Test", patterns_found=[], questions_analysis=[]
    )

    pipeline = AnalysisPipeline(
        embedding_generator=mock_embedding,
        clustering_service=mock_clustering,
        map_service=mock_map,
        reduce_service=MagicMock(),
        cove_service=MagicMock(),
    )

    result = pipeline.run(
        questoes=[{"id": "q1"}, {"id": "q2"}, {"id": "q3"}],
        disciplina="Test",
        banca="Test",
        anos=[2023],
        skip_phases=[3, 4],
    )

    # Verify analyze_chunk was called with cluster_info
    mock_map.analyze_chunk.assert_called()
    call_kwargs = mock_map.analyze_chunk.call_args
    assert call_kwargs.kwargs.get("cluster_info") is not None


def test_pipeline_similarity_report_format():
    """Test pipeline formats similarity report correctly for Phase 3"""
    mock_embedding = MagicMock()
    mock_embedding.generate_question_embedding.return_value = [0.1] * 768

    mock_clustering = MagicMock()
    mock_clustering.cluster_embeddings.return_value = ClusterResult(
        cluster_labels=[0], n_clusters=1, cluster_sizes={0: 1}, centroids={}, noise_count=0
    )

    mock_map = MagicMock()
    mock_map.create_chunks.return_value = [[{"id": "q1"}]]
    mock_map.analyze_chunk.return_value = ChunkDigest(
        chunk_id="chunk_1", summary="Test", patterns_found=[], questions_analysis=[]
    )

    mock_reduce = MagicMock()
    mock_reduce.synthesize.return_value = AnalysisReport(
        disciplina="Test",
        total_questoes=1,
        temporal_patterns=[],
        similarity_patterns=[],
        difficulty_analysis={},
        trap_analysis={},
        study_recommendations=[],
        raw_text="Test",
    )

    pipeline = AnalysisPipeline(
        embedding_generator=mock_embedding,
        clustering_service=mock_clustering,
        map_service=mock_map,
        reduce_service=mock_reduce,
        cove_service=MagicMock(),
    )

    # Mock similar_pairs to be found
    with patch("src.analysis.pipeline.find_most_similar_pairs") as mock_similar:
        mock_similar.return_value = [("q1", "q2", 0.95)]

        result = pipeline.run(
            questoes=[{"id": "q1"}],
            disciplina="Test",
            banca="Test",
            anos=[2023],
            skip_phases=[4],
        )

    # Verify synthesize was called with properly formatted similarity_report
    mock_reduce.synthesize.assert_called_once()
    call_kwargs = mock_reduce.synthesize.call_args
    similarity_report = call_kwargs.kwargs.get("similarity_report")
    assert "similar_pairs" in similarity_report
    assert "clusters" in similarity_report
