"""
Embedding model (vetores para similaridade semântica)
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, String, UniqueConstraint, JSON
from sqlalchemy.types import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

try:
    from pgvector.sqlalchemy import Vector

    HAS_PGVECTOR = True
except ImportError:
    HAS_PGVECTOR = False
    # Fallback for SQLite - store as JSON
    from sqlalchemy import JSON as Vector

from src.core.database import Base


class Embedding(Base):
    __tablename__ = "embeddings"
    __table_args__ = (
        UniqueConstraint("questao_id", "tipo", "modelo", name="uq_questao_tipo_modelo"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    questao_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("questoes.id", ondelete="CASCADE"), nullable=False
    )

    tipo: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # 'enunciado', 'enunciado_completo', 'imagem'
    modelo: Mapped[str] = mapped_column(String(100), nullable=False)

    # Vector column (pgvector) or JSON fallback
    if HAS_PGVECTOR:
        vetor: Mapped[list[float]] = mapped_column(Vector(768))  # dimensão padrão 768
    else:
        vetor: Mapped[list] = mapped_column(JSON)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    questao: Mapped["Questao"] = relationship("Questao", back_populates="embeddings")

    def __repr__(self) -> str:
        return f"<Embedding(id={self.id}, questao_id={self.questao_id}, tipo='{self.tipo}')>"
