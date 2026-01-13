"""
Projeto model - agrupa edital + provas + questões como unidade de trabalho
"""
import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import Integer, String, Text, JSON, ForeignKey
from sqlalchemy.types import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from src.core.database import Base

if TYPE_CHECKING:
    from src.models.edital import Edital
    from src.models.prova import Prova


class Projeto(Base):
    __tablename__ = "projetos"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    descricao: Mapped[Optional[str]] = mapped_column(Text)

    # Campos do concurso (copiados do edital para fácil acesso)
    banca: Mapped[Optional[str]] = mapped_column(String(100))
    cargo: Mapped[Optional[str]] = mapped_column(String(200))
    ano: Mapped[Optional[int]] = mapped_column(Integer)

    # Status do projeto
    status: Mapped[str] = mapped_column(
        String(50), default="configurando"
    )
    """
    Status possíveis:
    - configurando: edital/conteúdo programático ainda não definidos
    - coletando: edital definido, aguardando uploads de provas
    - pronto_analise: questões suficientes, pronto para análise profunda
    - analisando: análise LLM em andamento
    - concluido: análise completa
    """

    # Estatísticas (atualizadas ao adicionar provas)
    total_provas: Mapped[int] = mapped_column(Integer, default=0)
    total_questoes: Mapped[int] = mapped_column(Integer, default=0)
    total_questoes_validas: Mapped[int] = mapped_column(Integer, default=0)
    total_anuladas: Mapped[int] = mapped_column(Integer, default=0)

    # Configurações do projeto
    config: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    """
    Configurações como:
    - filtrar_disciplinas: bool (usar taxonomia para filtrar)
    - anos_incluidos: list[int] (quais anos de prova incluir)
    """

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    edital: Mapped[Optional["Edital"]] = relationship(
        "Edital", back_populates="projeto", uselist=False
    )
    provas: Mapped[list["Prova"]] = relationship(
        "Prova", back_populates="projeto", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Projeto(id={self.id}, nome='{self.nome}', status='{self.status}')>"

    def atualizar_estatisticas(self):
        """Recalcula estatísticas baseado nas provas e questões"""
        self.total_provas = len(self.provas) if self.provas else 0
        self.total_questoes = sum(p.total_questoes or 0 for p in self.provas) if self.provas else 0
        self.total_anuladas = sum(p.total_anuladas or 0 for p in self.provas) if self.provas else 0
        self.total_questoes_validas = self.total_questoes - self.total_anuladas
