"""
Tests for the deep analysis API endpoints
"""
import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.api.routes.analise import router, MIN_QUESTOES_PARA_ANALISE


# Create test app
app = FastAPI()
app.include_router(router, prefix="/api/analise")


@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)


@pytest.fixture
def mock_db_session():
    """Mock database session"""
    session = AsyncMock()
    return session


@pytest.fixture
def sample_projeto():
    """Sample project for testing"""
    projeto = MagicMock()
    projeto.id = uuid.uuid4()
    projeto.nome = "Test Project"
    projeto.banca = "CEBRASPE"
    projeto.provas = []
    return projeto


@pytest.fixture
def sample_prova(sample_projeto):
    """Sample prova for testing"""
    prova = MagicMock()
    prova.id = uuid.uuid4()
    prova.projeto_id = sample_projeto.id
    prova.ano = 2023
    prova.nome = "Prova 2023"
    return prova


@pytest.fixture
def sample_questoes(sample_prova):
    """Sample questions for testing"""
    questoes = []
    for i in range(10):
        q = MagicMock()
        q.id = uuid.uuid4()
        q.prova_id = sample_prova.id
        q.numero = i + 1
        q.disciplina = "Portugues"
        q.enunciado = f"Questao {i + 1}"
        q.alternativas = {"A": "a", "B": "b", "C": "c", "D": "d", "E": "e"}
        q.gabarito = "A"
        q.anulada = False
        q.assunto_pci = "Sintaxe"
        questoes.append(q)
    return questoes


@pytest.fixture
def sample_analise_job(sample_projeto):
    """Sample analysis job for testing"""
    job = MagicMock()
    job.id = uuid.uuid4()
    job.projeto_id = sample_projeto.id
    job.disciplina = "Portugues"
    job.status = "completed"
    job.current_phase = None
    job.phase_progress = 100
    job.phases_completed = [
        "Phase 1: Vetorizacao",
        "Phase 2: Map",
        "Phase 3: Reduce",
        "Phase 4: CoVe",
    ]
    job.total_questoes = 10
    job.banca = "CEBRASPE"
    job.anos = [2023]
    job.cluster_result = {
        "n_clusters": 3,
        "cluster_sizes": {"0": 4, "1": 3, "2": 3},
        "silhouette_score": 0.65,
    }
    job.similar_pairs = [
        {"q1": "1", "q2": "2", "score": 0.92},
    ]
    job.chunk_digests = [
        {"chunk_id": "chunk_1", "summary": "Test", "patterns_found": [], "questions_count": 10}
    ]
    job.analysis_report = {
        "disciplina": "Portugues",
        "total_questoes": 10,
        "temporal_patterns": [
            {
                "pattern_type": "temporal",
                "description": "Sintaxe aumentou em 2023",
                "evidence_ids": ["Q1", "Q2"],
                "confidence": "high",
                "votes": 4,
            }
        ],
        "similarity_patterns": [],
        "difficulty_analysis": {"easy": 3, "medium": 5, "hard": 2},
        "trap_analysis": {},
        "study_recommendations": ["Foque em sintaxe"],
        "raw_text": "Relatorio completo...",
    }
    job.verified_report = {
        "original_claims": 5,
        "verified_claims": 4,
        "rejected_claims": 1,
        "verification_results": [],
        "cleaned_report": "Relatorio verificado...",
    }
    job.errors = []
    job.error_message = None
    job.started_at = datetime(2023, 1, 1, 10, 0, 0)
    job.completed_at = datetime(2023, 1, 1, 10, 5, 0)
    job.created_at = datetime(2023, 1, 1, 9, 59, 0)
    job.updated_at = datetime(2023, 1, 1, 10, 5, 0)
    job.duration_seconds = 300
    return job


class TestIniciarAnalise:
    """Tests for POST /api/analise/{projeto_id}/iniciar"""

    @patch("src.api.routes.analise.get_db")
    async def test_iniciar_analise_projeto_not_found(self, mock_get_db, client):
        """Should return 404 when project not found"""
        # Setup mock
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        async def mock_db_gen():
            yield mock_session

        mock_get_db.return_value = mock_db_gen()

        response = client.post(
            f"/api/analise/{uuid.uuid4()}/iniciar",
            json={"disciplina": "Portugues"}
        )

        assert response.status_code == 404
        assert "Projeto not found" in response.json()["detail"]

    @patch("src.api.routes.analise.get_db")
    async def test_iniciar_analise_no_provas(self, mock_get_db, client, sample_projeto):
        """Should return 400 when project has no provas"""
        # Setup mock
        sample_projeto.provas = []  # No provas

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_projeto
        mock_session.execute.return_value = mock_result

        async def mock_db_gen():
            yield mock_session

        mock_get_db.return_value = mock_db_gen()

        response = client.post(
            f"/api/analise/{sample_projeto.id}/iniciar",
            json={"disciplina": "Portugues"}
        )

        assert response.status_code == 400
        assert "no provas" in response.json()["detail"].lower()


class TestGetAnaliseStatus:
    """Tests for GET /api/analise/{projeto_id}/status"""

    @patch("src.api.routes.analise.get_db")
    async def test_get_status_projeto_not_found(self, mock_get_db, client):
        """Should return 404 when project not found"""
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        async def mock_db_gen():
            yield mock_session

        mock_get_db.return_value = mock_db_gen()

        response = client.get(f"/api/analise/{uuid.uuid4()}/status")

        assert response.status_code == 404

    @patch("src.api.routes.analise.get_db")
    async def test_get_status_no_jobs(self, mock_get_db, client, sample_projeto):
        """Should return 404 when no jobs found"""
        mock_session = AsyncMock()

        # First call returns projeto, second returns None (no jobs)
        mock_result_projeto = MagicMock()
        mock_result_projeto.scalar_one_or_none.return_value = sample_projeto

        mock_result_job = MagicMock()
        mock_result_job.scalar_one_or_none.return_value = None

        mock_session.execute.side_effect = [mock_result_projeto, mock_result_job]

        async def mock_db_gen():
            yield mock_session

        mock_get_db.return_value = mock_db_gen()

        response = client.get(f"/api/analise/{sample_projeto.id}/status")

        assert response.status_code == 404
        assert "No analysis job found" in response.json()["detail"]


class TestGetAnaliseResultado:
    """Tests for GET /api/analise/{projeto_id}/resultado"""

    @patch("src.api.routes.analise.get_db")
    async def test_get_resultado_projeto_not_found(self, mock_get_db, client):
        """Should return 404 when project not found"""
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        async def mock_db_gen():
            yield mock_session

        mock_get_db.return_value = mock_db_gen()

        response = client.get(f"/api/analise/{uuid.uuid4()}/resultado")

        assert response.status_code == 404

    @patch("src.api.routes.analise.get_db")
    async def test_get_resultado_no_jobs(self, mock_get_db, client, sample_projeto):
        """Should return 404 when no jobs exist"""
        mock_session = AsyncMock()

        mock_result_projeto = MagicMock()
        mock_result_projeto.scalar_one_or_none.return_value = sample_projeto

        mock_result_jobs = MagicMock()
        mock_result_jobs.scalars.return_value.all.return_value = []

        mock_session.execute.side_effect = [mock_result_projeto, mock_result_jobs]

        async def mock_db_gen():
            yield mock_session

        mock_get_db.return_value = mock_db_gen()

        response = client.get(f"/api/analise/{sample_projeto.id}/resultado")

        assert response.status_code == 404
        assert "No analysis results found" in response.json()["detail"]


class TestGetAnaliseResultadoDisciplina:
    """Tests for GET /api/analise/{projeto_id}/resultado/{disciplina}"""

    @patch("src.api.routes.analise.get_db")
    async def test_get_resultado_disciplina_not_found(
        self, mock_get_db, client, sample_projeto
    ):
        """Should return 404 when discipline analysis not found"""
        mock_session = AsyncMock()

        mock_result_projeto = MagicMock()
        mock_result_projeto.scalar_one_or_none.return_value = sample_projeto

        mock_result_job = MagicMock()
        mock_result_job.scalar_one_or_none.return_value = None

        mock_session.execute.side_effect = [mock_result_projeto, mock_result_job]

        async def mock_db_gen():
            yield mock_session

        mock_get_db.return_value = mock_db_gen()

        response = client.get(
            f"/api/analise/{sample_projeto.id}/resultado/Matematica"
        )

        assert response.status_code == 404
        assert "No analysis found for discipline" in response.json()["detail"]


class TestCancelAnaliseJob:
    """Tests for DELETE /api/analise/{projeto_id}/jobs/{job_id}"""

    @patch("src.api.routes.analise.get_db")
    async def test_cancel_job_not_found(self, mock_get_db, client, sample_projeto):
        """Should return 404 when job not found"""
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        async def mock_db_gen():
            yield mock_session

        mock_get_db.return_value = mock_db_gen()

        response = client.delete(
            f"/api/analise/{sample_projeto.id}/jobs/{uuid.uuid4()}"
        )

        assert response.status_code == 404

    @patch("src.api.routes.analise.get_db")
    async def test_cancel_job_wrong_status(
        self, mock_get_db, client, sample_projeto, sample_analise_job
    ):
        """Should return 400 when trying to cancel completed job"""
        sample_analise_job.status = "completed"

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_analise_job
        mock_session.execute.return_value = mock_result

        async def mock_db_gen():
            yield mock_session

        mock_get_db.return_value = mock_db_gen()

        response = client.delete(
            f"/api/analise/{sample_projeto.id}/jobs/{sample_analise_job.id}"
        )

        assert response.status_code == 400
        assert "Cannot cancel job" in response.json()["detail"]


class TestBuildDisciplinaResult:
    """Tests for the _build_disciplina_result helper function"""

    def test_build_result_with_all_data(self, sample_analise_job):
        """Should correctly build response with all phase results"""
        from src.api.routes.analise import _build_disciplina_result

        result = _build_disciplina_result(sample_analise_job)

        assert result.job_id == sample_analise_job.id
        assert result.disciplina == "Portugues"
        assert result.status == "completed"
        assert result.total_questoes == 10
        assert result.banca == "CEBRASPE"
        assert result.anos == [2023]

        # Phase 1
        assert result.cluster_result is not None
        assert result.cluster_result.n_clusters == 3
        assert result.similar_pairs_count == 1

        # Phase 2
        assert result.chunk_digests_count == 1

        # Phase 3
        assert result.analysis_report is not None
        assert len(result.analysis_report.temporal_patterns) == 1
        assert result.analysis_report.study_recommendations == ["Foque em sintaxe"]

        # Phase 4
        assert result.verified_report is not None
        assert result.verified_report.original_claims == 5
        assert result.verified_report.verified_claims == 4

    def test_build_result_with_partial_data(self, sample_analise_job):
        """Should handle missing phase results gracefully"""
        from src.api.routes.analise import _build_disciplina_result

        # Remove some data
        sample_analise_job.cluster_result = None
        sample_analise_job.verified_report = None

        result = _build_disciplina_result(sample_analise_job)

        assert result.cluster_result is None
        assert result.verified_report is None
        assert result.analysis_report is not None


class TestMinQuestoesValidation:
    """Tests for minimum questions validation"""

    def test_min_questoes_constant(self):
        """MIN_QUESTOES_PARA_ANALISE should be reasonable"""
        assert MIN_QUESTOES_PARA_ANALISE >= 1
        assert MIN_QUESTOES_PARA_ANALISE <= 20


class TestSchemaValidation:
    """Tests for Pydantic schema validation"""

    def test_analise_iniciar_request_defaults(self):
        """Request should have sensible defaults"""
        from src.schemas.analise import AnaliseIniciarRequest

        request = AnaliseIniciarRequest()
        assert request.disciplina is None
        assert request.skip_phases is None

    def test_analise_iniciar_request_with_values(self):
        """Request should accept valid values"""
        from src.schemas.analise import AnaliseIniciarRequest

        request = AnaliseIniciarRequest(
            disciplina="Portugues",
            skip_phases=[1, 2]
        )
        assert request.disciplina == "Portugues"
        assert request.skip_phases == [1, 2]

    def test_pattern_finding_schema(self):
        """PatternFindingSchema should validate correctly"""
        from src.schemas.analise import PatternFindingSchema

        pattern = PatternFindingSchema(
            pattern_type="temporal",
            description="Test pattern",
            evidence_ids=["Q1", "Q2"],
            confidence="high",
            votes=3
        )
        assert pattern.pattern_type == "temporal"
        assert pattern.confidence == "high"
        assert pattern.votes == 3

    def test_analysis_report_schema_defaults(self):
        """AnalysisReportSchema should have sensible defaults"""
        from src.schemas.analise import AnalysisReportSchema

        report = AnalysisReportSchema(
            disciplina="Portugues",
            total_questoes=10
        )
        assert report.temporal_patterns == []
        assert report.similarity_patterns == []
        assert report.difficulty_analysis == {}
        assert report.trap_analysis == {}
        assert report.study_recommendations == []

    def test_verified_report_schema(self):
        """VerifiedReportSchema should validate correctly"""
        from src.schemas.analise import VerifiedReportSchema

        report = VerifiedReportSchema(
            original_claims=10,
            verified_claims=8,
            rejected_claims=2
        )
        assert report.original_claims == 10
        assert report.verified_claims == 8
        assert report.rejected_claims == 2

    def test_cluster_result_schema(self):
        """ClusterResultSchema should validate correctly"""
        from src.schemas.analise import ClusterResultSchema

        result = ClusterResultSchema(
            n_clusters=5,
            cluster_sizes={"0": 10, "1": 15, "2": 8, "3": 12, "4": 5},
            silhouette_score=0.72
        )
        assert result.n_clusters == 5
        assert len(result.cluster_sizes) == 5
        assert result.silhouette_score == 0.72


class TestAnaliseJobModel:
    """Tests for the AnaliseJob model"""

    def test_analise_job_duration_seconds(self, sample_analise_job):
        """duration_seconds property should calculate correctly"""
        # Already set in fixture
        assert sample_analise_job.duration_seconds == 300

    def test_analise_job_duration_none(self, sample_analise_job):
        """duration_seconds should be None if not completed"""
        sample_analise_job.started_at = None
        sample_analise_job.completed_at = None
        sample_analise_job.duration_seconds = None

        assert sample_analise_job.duration_seconds is None

    def test_analise_job_status_properties(self):
        """Status properties should work correctly using actual model"""
        from src.models.analise_job import AnaliseJob

        job = AnaliseJob()
        job.status = "running"
        assert job.is_running is True
        assert job.is_completed is False
        assert job.is_failed is False

        job.status = "completed"
        assert job.is_running is False
        assert job.is_completed is True
        assert job.is_failed is False

        job.status = "failed"
        assert job.is_running is False
        assert job.is_completed is False
        assert job.is_failed is True
