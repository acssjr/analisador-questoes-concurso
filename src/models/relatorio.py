"""
Relatorio model (relatórios gerados)
"""

import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import JSON, Date, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import Uuid

from src.core.database import Base


class Relatorio(Base):
    __tablename__ = "relatorios"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)

    tipo: Mapped[Optional[str]] = mapped_column(String(50))  # 'disciplina', 'assunto', 'completo'
    titulo: Mapped[str] = mapped_column(String(255), nullable=False)

    disciplina: Mapped[Optional[str]] = mapped_column(String(100))
    assunto: Mapped[Optional[str]] = mapped_column(String(200))

    # Escopo do relatório
    provas_analisadas: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    total_questoes: Mapped[Optional[int]] = mapped_column(Integer)
    periodo_inicio: Mapped[Optional[date]] = mapped_column(Date)
    periodo_fim: Mapped[Optional[date]] = mapped_column(Date)

    # Conteúdo
    conteudo_markdown: Mapped[Optional[str]] = mapped_column(Text)
    conteudo_html: Mapped[Optional[str]] = mapped_column(Text)
    arquivo_pdf: Mapped[Optional[str]] = mapped_column(String(500))
    visualizacoes: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)

    # Metadados
    versao: Mapped[int] = mapped_column(Integer, default=1)
    gerado_por: Mapped[Optional[str]] = mapped_column(String(50))
    tempo_geracao: Mapped[Optional[int]] = mapped_column(Integer)  # segundos

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    def __repr__(self) -> str:
        return f"<Relatorio(id={self.id}, titulo='{self.titulo}', tipo='{self.tipo}')>"
