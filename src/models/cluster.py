"""
Cluster models (agrupamento de questões similares)
"""

import uuid
from datetime import datetime
from typing import Optional

try:
    from pgvector.sqlalchemy import Vector

    HAS_PGVECTOR = True
except ImportError:
    HAS_PGVECTOR = False
    from sqlalchemy import JSON as Vector

from sqlalchemy import JSON, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from sqlalchemy.types import Uuid

from src.core.database import Base


class Cluster(Base):
    __tablename__ = "clusters"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[Optional[str]] = mapped_column(String(255))
    disciplina: Mapped[Optional[str]] = mapped_column(String(100))

    algoritmo: Mapped[Optional[str]] = mapped_column(
        String(50)
    )  # 'kmeans', 'dbscan', 'hierarchical'
    parametros: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)

    # Centroide do cluster
    if HAS_PGVECTOR:
        centroide: Mapped[Optional[list[float]]] = mapped_column(Vector(768))
    else:
        centroide: Mapped[Optional[list]] = mapped_column(JSON)

    tamanho: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    descricao_automatica: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    questoes: Mapped[list["ClusterQuestao"]] = relationship(
        "ClusterQuestao", back_populates="cluster", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Cluster(id={self.id}, nome='{self.nome}', tamanho={self.tamanho})>"


class ClusterQuestao(Base):
    """Many-to-many relationship between Cluster and Questao"""

    __tablename__ = "cluster_questoes"

    cluster_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clusters.id", ondelete="CASCADE"),
        primary_key=True,
    )
    questao_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("questoes.id", ondelete="CASCADE"),
        primary_key=True,
    )

    distancia_centroide: Mapped[Optional[float]] = mapped_column(Float)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    cluster: Mapped["Cluster"] = relationship("Cluster", back_populates="questoes")
    questao: Mapped["Questao"] = relationship("Questao")

    def __repr__(self) -> str:
        return f"<ClusterQuestao(cluster_id={self.cluster_id}, questao_id={self.questao_id})>"


class Similaridade(Base):
    """Pré-computed similarity scores between questions"""

    __tablename__ = "similaridades"

    questao_1_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("questoes.id", ondelete="CASCADE"),
        primary_key=True,
    )
    questao_2_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("questoes.id", ondelete="CASCADE"),
        primary_key=True,
    )

    score_similaridade: Mapped[float] = mapped_column(Float, nullable=False)
    tipo: Mapped[Optional[str]] = mapped_column(String(50))  # 'semantica', 'estrutural', 'visual'

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    def __repr__(self) -> str:
        return f"<Similaridade(q1={self.questao_1_id}, q2={self.questao_2_id}, score={self.score_similaridade})>"
