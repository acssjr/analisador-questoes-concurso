"""
Analise Pydantic schemas for the deep analysis API
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

# =============================================================================
# Request Schemas
# =============================================================================


class AnaliseIniciarRequest(BaseModel):
    """Request body for starting an analysis job"""

    disciplina: Optional[str] = Field(
        None, description="Discipline to analyze. If None, analyzes all disciplines"
    )
    skip_phases: Optional[list[int]] = Field(
        None,
        description="List of phase numbers to skip (1-4). E.g., [1] skips Phase 1 (Vetorizacao)",
    )


# =============================================================================
# Response Schemas
# =============================================================================


class PatternFindingSchema(BaseModel):
    """A pattern finding from the analysis"""

    pattern_type: str = Field(
        ..., description="Type: temporal, similaridade, dificuldade, estilo, pegadinha"
    )
    description: str
    evidence_ids: list[str] = Field(default_factory=list)
    confidence: str = Field(..., description="Confidence: high, medium, low")
    votes: int = Field(default=0, description="Number of passes that found this pattern")


class VerificationResultSchema(BaseModel):
    """Result of verifying a single claim"""

    claim: str
    verification_question: str
    evidence_ids: list[str]
    evidence_summary: str
    is_verified: bool
    confidence: str
    notes: Optional[str] = None


class AnalysisReportSchema(BaseModel):
    """Analysis report from Phase 3 (Reduce)"""

    disciplina: str
    total_questoes: int
    temporal_patterns: list[PatternFindingSchema] = Field(default_factory=list)
    similarity_patterns: list[PatternFindingSchema] = Field(default_factory=list)
    difficulty_analysis: dict = Field(default_factory=dict)
    trap_analysis: dict = Field(default_factory=dict)
    study_recommendations: list[str] = Field(default_factory=list)
    raw_text: Optional[str] = None


class VerifiedReportSchema(BaseModel):
    """Verified report from Phase 4 (CoVe)"""

    original_claims: int
    verified_claims: int
    rejected_claims: int
    verification_results: list[VerificationResultSchema] = Field(default_factory=list)
    cleaned_report: Optional[str] = None


class ClusterResultSchema(BaseModel):
    """Clustering result from Phase 1"""

    n_clusters: int
    cluster_sizes: dict[str, int]
    silhouette_score: Optional[float] = None


class AnaliseIniciarResponse(BaseModel):
    """Response after starting an analysis job"""

    job_id: UUID
    projeto_id: UUID
    disciplina: str
    status: str
    message: str


class AnaliseStatusResponse(BaseModel):
    """Response for analysis job status"""

    job_id: UUID
    projeto_id: UUID
    disciplina: str
    status: str
    current_phase: Optional[int] = None
    phase_progress: Optional[int] = None
    phases_completed: list[str] = Field(default_factory=list)
    total_questoes: int = 0
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    error_message: Optional[str] = None


class AnaliseResultadoResponse(BaseModel):
    """Complete analysis results for a project"""

    projeto_id: UUID
    disciplinas: list[str] = Field(default_factory=list)
    total_jobs: int = 0
    completed_jobs: int = 0
    results: dict[str, "AnaliseResultadoDisciplinaResponse"] = Field(default_factory=dict)


class AnaliseResultadoDisciplinaResponse(BaseModel):
    """Analysis results for a specific discipline"""

    job_id: UUID
    disciplina: str
    status: str
    total_questoes: int = 0
    banca: Optional[str] = None
    anos: list[int] = Field(default_factory=list)

    # Phase 1 results
    cluster_result: Optional[ClusterResultSchema] = None
    similar_pairs_count: int = 0

    # Phase 2 results
    chunk_digests_count: int = 0

    # Phase 3 results (main output)
    analysis_report: Optional[AnalysisReportSchema] = None

    # Phase 4 results
    verified_report: Optional[VerifiedReportSchema] = None

    # Metadata
    phases_completed: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None


class AnaliseJobListResponse(BaseModel):
    """Response for listing analysis jobs"""

    jobs: list[AnaliseStatusResponse]
    total: int


# =============================================================================
# Summary Schemas (for frontend UI)
# =============================================================================


class AnaliseResumoResponse(BaseModel):
    """Summary of analysis for a project (for dashboard)"""

    projeto_id: UUID
    status: str = Field(
        ..., description="Overall status: pending, running, partial, completed, failed"
    )
    disciplinas_analisadas: int = 0
    disciplinas_total: int = 0
    questoes_analisadas: int = 0
    padroes_encontrados: int = 0
    recomendacoes: int = 0
    last_updated: Optional[datetime] = None


# Enable forward references
AnaliseResultadoResponse.model_rebuild()
