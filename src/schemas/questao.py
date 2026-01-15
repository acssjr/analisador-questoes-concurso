"""
Questao Pydantic schemas
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class QuestaoBase(BaseModel):
    numero: int = Field(..., ge=1)
    disciplina: Optional[str] = None
    enunciado: str = Field(..., min_length=1)
    alternativas: dict[str, str] = Field(..., description="Alternativas A-E")
    gabarito: Optional[str] = Field(None, pattern="^[A-E]$")
    anulada: bool = False
    motivo_anulacao: Optional[str] = None
    tem_imagem: bool = False
    assunto_pci: Optional[str] = None


class QuestaoCreate(QuestaoBase):
    """Schema for creating a Questao"""

    prova_id: UUID
    imagens: Optional[list[dict]] = None
    texto_imagem_ocr: Optional[str] = None
    metadados: Optional[dict] = None


class QuestaoUpdate(BaseModel):
    """Schema for updating a Questao"""

    disciplina: Optional[str] = None
    gabarito: Optional[str] = Field(None, pattern="^[A-E]$")
    anulada: Optional[bool] = None
    motivo_anulacao: Optional[str] = None
    status_extracao: Optional[str] = None


class QuestaoList(QuestaoBase):
    """Schema for listing questões (minimal info)"""

    id: UUID
    prova_id: UUID
    status_extracao: str = "ok"

    class Config:
        from_attributes = True


class Questao(QuestaoBase):
    """Schema for reading a Questao (full info)"""

    id: UUID
    prova_id: UUID
    imagens: Optional[list[dict]] = None
    texto_imagem_ocr: Optional[str] = None
    metadados: dict = {}
    status_extracao: str = "ok"
    alertas: list = []
    created_at: datetime

    class Config:
        from_attributes = True


class QuestaoWithClassificacao(Questao):
    """Questao with classificação"""

    from src.schemas.classificacao import ClassificacaoRead

    classificacoes: list[ClassificacaoRead] = []
