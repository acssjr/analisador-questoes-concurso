"""
Classificacao model (classificação hierárquica de questões)
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Float, ForeignKey, String, Text, JSON
from sqlalchemy.types import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from src.core.database import Base


class Classificacao(Base):
    __tablename__ = "classificacoes"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    questao_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("questoes.id", ondelete="CASCADE"), nullable=False
    )

    # Classificação hierárquica
    disciplina: Mapped[str] = mapped_column(String(100), nullable=False)
    assunto: Mapped[Optional[str]] = mapped_column(String(200))
    topico: Mapped[Optional[str]] = mapped_column(String(200))
    subtopico: Mapped[Optional[str]] = mapped_column(String(200))
    conceito_especifico: Mapped[Optional[str]] = mapped_column(String(300))

    # Scores de confiança (0.0 - 1.0)
    confianca_disciplina: Mapped[Optional[float]] = mapped_column(Float)
    confianca_assunto: Mapped[Optional[float]] = mapped_column(Float)
    confianca_topico: Mapped[Optional[float]] = mapped_column(Float)
    confianca_subtopico: Mapped[Optional[float]] = mapped_column(Float)

    # Mapeamento para edital
    edital_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("editais.id")
    )
    item_edital_path: Mapped[Optional[str]] = mapped_column(
        String(500)
    )  # "Português > Sintaxe > Período Composto"

    # Análise conceitual
    conceito_testado: Mapped[Optional[str]] = mapped_column(Text)
    habilidade_bloom: Mapped[Optional[str]] = mapped_column(
        String(50)
    )  # 'lembrar', 'entender', 'aplicar', etc
    nivel_dificuldade: Mapped[Optional[str]] = mapped_column(
        String(20)
    )  # 'basico', 'intermediario', 'avancado'
    conceitos_adjacentes: Mapped[Optional[list]] = mapped_column(JSON, default=list)

    # Análise de alternativas
    analise_alternativas: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    """
    {
        "A": {"correta": false, "motivo_erro": "..."},
        "B": {"correta": true, "justificativa": "..."},
        ...
    }
    """

    # Metadados LLM
    llm_provider: Mapped[Optional[str]] = mapped_column(String(50))  # 'groq', 'huggingface'
    llm_model: Mapped[Optional[str]] = mapped_column(String(100))
    prompt_usado: Mapped[Optional[str]] = mapped_column(Text)
    raw_response: Mapped[Optional[dict]] = mapped_column(JSON)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationships
    questao: Mapped["Questao"] = relationship("Questao", back_populates="classificacoes")

    def __repr__(self) -> str:
        return f"<Classificacao(id={self.id}, disciplina='{self.disciplina}', assunto='{self.assunto}')>"
