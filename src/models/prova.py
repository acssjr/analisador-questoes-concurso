"""
Prova model
"""

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import JSON, Date, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from sqlalchemy.types import Uuid

from src.core.database import Base

if TYPE_CHECKING:
    from src.models.projeto import Projeto


class Prova(Base):
    __tablename__ = "provas"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    banca: Mapped[Optional[str]] = mapped_column(String(100))
    cargo: Mapped[Optional[str]] = mapped_column(String(200))
    ano: Mapped[Optional[int]] = mapped_column(Integer)
    data_prova: Mapped[Optional[date]] = mapped_column(Date)

    fonte: Mapped[Optional[str]] = mapped_column(String(50))  # 'PCI', 'PROVA_ORIGINAL'
    arquivo_original: Mapped[Optional[str]] = mapped_column(String(500))

    # Foreign key to Projeto (optional for backward compatibility)
    projeto_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("projetos.id"), nullable=True
    )

    total_questoes: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    total_anuladas: Mapped[Optional[int]] = mapped_column(Integer, default=0)

    status: Mapped[Optional[str]] = mapped_column(
        String(50), default="extraido"
    )  # 'extraido', 'classificado', 'analisado'

    # Queue processing status
    queue_status: Mapped[str] = mapped_column(String(50), default="pending")
    """
    Queue status:
    - pending: Aguardando processamento
    - validating: Validando PDF (não corrompido, tem texto, etc.)
    - processing: Extraindo questões com LLM
    - completed: Sucesso total
    - partial: Sucesso parcial (algumas questões com baixa confiança)
    - failed: Falhou (motivo em queue_error)
    - retry: Aguardando retry após rate limit
    """

    queue_error: Mapped[Optional[str]] = mapped_column(Text)
    queue_retry_count: Mapped[int] = mapped_column(Integer, default=0)
    queue_checkpoint: Mapped[Optional[str]] = mapped_column(
        String(50)
    )  # 'validated', 'text_extracted', 'questions_extracted', 'classified'

    # Confidence score (0-100)
    confianca_media: Mapped[Optional[float]] = mapped_column(Float, default=None)

    metadados: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    # Relationships
    projeto: Mapped[Optional["Projeto"]] = relationship("Projeto", back_populates="provas")
    questoes: Mapped[list["Questao"]] = relationship(
        "Questao", back_populates="prova", cascade="all, delete-orphan"
    )

    def __init__(self, **kwargs):
        """Initialize Prova with column defaults applied at instantiation time."""
        # Apply column defaults if not provided in kwargs
        defaults = {
            "queue_status": "pending",
            "queue_retry_count": 0,
            "total_questoes": 0,
            "total_anuladas": 0,
            "status": "extraido",
        }
        for key, value in defaults.items():
            if key not in kwargs:
                kwargs[key] = value
        super().__init__(**kwargs)

    def __repr__(self) -> str:
        return f"<Prova(id={self.id}, nome='{self.nome}', banca='{self.banca}', ano={self.ano})>"
