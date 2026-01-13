"""
Questao model
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint, JSON
from sqlalchemy.types import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from src.core.database import Base


class Questao(Base):
    __tablename__ = "questoes"
    __table_args__ = (UniqueConstraint("prova_id", "numero", name="uq_prova_numero"),)

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    prova_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("provas.id", ondelete="CASCADE"), nullable=False
    )
    numero: Mapped[int] = mapped_column(Integer, nullable=False)

    disciplina: Mapped[Optional[str]] = mapped_column(String(100))
    enunciado: Mapped[str] = mapped_column(Text, nullable=False)
    alternativas: Mapped[dict] = mapped_column(JSON, nullable=False)  # {"A": "...", "B": ...}

    gabarito: Mapped[Optional[str]] = mapped_column(String(1))  # 'A', 'B', 'C', 'D', 'E'
    anulada: Mapped[bool] = mapped_column(Boolean, default=False)
    motivo_anulacao: Mapped[Optional[str]] = mapped_column(Text)

    tem_imagem: Mapped[bool] = mapped_column(Boolean, default=False)
    imagens: Mapped[Optional[list]] = mapped_column(JSON)  # [{"arquivo": "...", "tipo": ...}]
    texto_imagem_ocr: Mapped[Optional[str]] = mapped_column(Text)

    assunto_pci: Mapped[Optional[str]] = mapped_column(String(200))  # Se vier do PCI
    metadados: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)

    status_extracao: Mapped[Optional[str]] = mapped_column(
        String(50), default="ok"
    )  # 'ok', 'revisar_manual'
    alertas: Mapped[Optional[list]] = mapped_column(JSON, default=list)

    # Confidence scoring (0-100)
    confianca_score: Mapped[Optional[int]] = mapped_column(Integer)
    confianca_detalhes: Mapped[Optional[dict]] = mapped_column(JSON)
    """
    Detalhes do score:
    {
        "enunciado_tamanho": 25,  # +25 se 50-2000 chars
        "alternativas_validas": 25,  # +25 se 4-5 alternativas A-E
        "gabarito_claro": 20,  # +20 se gabarito identificado
        "disciplina_match": 15,  # +15 se disciplina do edital
        "formato_consistente": 15  # +15 se formato similar às outras
    }
    """

    # Analysis fields (populated in Phase 4 - Deep Analysis)
    dificuldade: Mapped[Optional[str]] = mapped_column(
        String(20)
    )  # 'easy', 'medium', 'hard', 'very_hard'
    bloom_level: Mapped[Optional[str]] = mapped_column(
        String(20)
    )  # 'remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'
    tem_pegadinha: Mapped[bool] = mapped_column(Boolean, default=False)
    pegadinha_descricao: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    prova: Mapped["Prova"] = relationship("Prova", back_populates="questoes")
    classificacoes: Mapped[list["Classificacao"]] = relationship(
        "Classificacao", back_populates="questao", cascade="all, delete-orphan"
    )
    embeddings: Mapped[list["Embedding"]] = relationship(
        "Embedding", back_populates="questao", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Questao(id={self.id}, numero={self.numero}, disciplina='{self.disciplina}')>"
