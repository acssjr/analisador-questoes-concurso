"""
Edital model (taxonomia hierárquica)
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import JSON, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from sqlalchemy.types import Uuid

from src.core.database import Base

if TYPE_CHECKING:
    from src.models.projeto import Projeto


class Edital(Base):
    __tablename__ = "editais"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    banca: Mapped[Optional[str]] = mapped_column(String(100))
    cargo: Mapped[Optional[str]] = mapped_column(String(200))
    ano: Mapped[Optional[int]] = mapped_column(Integer)

    arquivo_original: Mapped[Optional[str]] = mapped_column(String(500))

    # Foreign key to Projeto (optional for backward compatibility)
    projeto_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("projetos.id"), nullable=True
    )

    taxonomia: Mapped[dict] = mapped_column(JSON, nullable=False)
    """
    Estrutura da taxonomia:
    {
        "disciplinas": [
            {
                "nome": "Língua Portuguesa",
                "assuntos": [
                    {
                        "nome": "Sintaxe",
                        "topicos": [
                            {
                                "nome": "Período Composto",
                                "subtopicos": ["Orações Subordinadas", ...]
                            }
                        ]
                    }
                ]
            }
        ]
    }
    """

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Relationship back to Projeto
    projeto: Mapped[Optional["Projeto"]] = relationship("Projeto", back_populates="edital")

    def __repr__(self) -> str:
        return f"<Edital(id={self.id}, nome='{self.nome}', banca='{self.banca}')>"
