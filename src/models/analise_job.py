"""
AnaliseJob model - tracks deep analysis jobs per project/discipline
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from sqlalchemy.types import Uuid

from src.core.database import Base


class AnaliseJob(Base):
    """
    Tracks deep analysis jobs for a projeto/disciplina.

    Each analysis job corresponds to running the 4-phase pipeline
    for a specific discipline within a project.
    """

    __tablename__ = "analise_jobs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Link to projeto
    projeto_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("projetos.id", ondelete="CASCADE"), nullable=False
    )

    # Discipline being analyzed (or "all" for complete project analysis)
    disciplina: Mapped[str] = mapped_column(String(100), nullable=False)

    # Status tracking
    status: Mapped[str] = mapped_column(String(50), default="pending")
    """
    Status values:
    - pending: job created, not started
    - running: analysis in progress
    - completed: analysis finished successfully
    - failed: analysis failed with error
    - cancelled: job was cancelled
    """

    # Phase tracking (1-4)
    current_phase: Mapped[Optional[int]] = mapped_column(Integer)
    phases_completed: Mapped[list] = mapped_column(JSON, default=list)
    """List of completed phase names, e.g. ["Phase 1: Vetorizacao", "Phase 2: Map"]"""

    # Progress within current phase (0-100)
    phase_progress: Mapped[Optional[int]] = mapped_column(Integer, default=0)

    # Input metadata
    total_questoes: Mapped[int] = mapped_column(Integer, default=0)
    banca: Mapped[Optional[str]] = mapped_column(String(100))
    anos: Mapped[Optional[list]] = mapped_column(JSON)  # [2020, 2021, 2022]

    # Results (stored as JSON for flexibility)
    # Phase 1: Vetorizacao results
    cluster_result: Mapped[Optional[dict]] = mapped_column(JSON)
    similar_pairs: Mapped[Optional[list]] = mapped_column(JSON)

    # Phase 2: Map results
    chunk_digests: Mapped[Optional[list]] = mapped_column(JSON)

    # Phase 3: Reduce results
    analysis_report: Mapped[Optional[dict]] = mapped_column(JSON)
    """
    Includes:
    - temporal_patterns: list of pattern findings
    - similarity_patterns: list of pattern findings
    - difficulty_analysis: dict
    - trap_analysis: dict
    - study_recommendations: list[str]
    - raw_text: full report text
    """

    # Phase 4: CoVe results
    verified_report: Mapped[Optional[dict]] = mapped_column(JSON)
    """
    Includes:
    - original_claims: int
    - verified_claims: int
    - rejected_claims: int
    - verification_results: list
    - cleaned_report: str
    """

    # Error tracking
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    errors: Mapped[list] = mapped_column(JSON, default=list)  # List of phase errors

    # Timing
    started_at: Mapped[Optional[datetime]] = mapped_column()
    completed_at: Mapped[Optional[datetime]] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    # Relationships
    projeto: Mapped["Projeto"] = relationship("Projeto", backref="analise_jobs")

    def __repr__(self) -> str:
        return (
            f"<AnaliseJob(id={self.id}, projeto_id={self.projeto_id}, "
            f"disciplina='{self.disciplina}', status='{self.status}')>"
        )

    @property
    def duration_seconds(self) -> Optional[int]:
        """Calculate duration in seconds if completed"""
        if self.started_at and self.completed_at:
            return int((self.completed_at - self.started_at).total_seconds())
        return None

    @property
    def is_running(self) -> bool:
        return self.status == "running"

    @property
    def is_completed(self) -> bool:
        return self.status == "completed"

    @property
    def is_failed(self) -> bool:
        return self.status == "failed"
