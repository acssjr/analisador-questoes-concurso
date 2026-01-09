"""
Prova Pydantic schemas
"""
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ProvaBase(BaseModel):
    nome: str = Field(..., min_length=1, max_length=255)
    banca: Optional[str] = Field(None, max_length=100)
    cargo: Optional[str] = Field(None, max_length=200)
    ano: Optional[int] = Field(None, ge=1900, le=2100)
    data_prova: Optional[date] = None
    fonte: Optional[str] = Field(None, max_length=50)
    arquivo_original: Optional[str] = None


class ProvaCreate(ProvaBase):
    """Schema for creating a Prova"""

    pass


class ProvaUpdate(BaseModel):
    """Schema for updating a Prova"""

    nome: Optional[str] = Field(None, min_length=1, max_length=255)
    banca: Optional[str] = None
    cargo: Optional[str] = None
    ano: Optional[int] = Field(None, ge=1900, le=2100)
    status: Optional[str] = None
    total_questoes: Optional[int] = None
    total_anuladas: Optional[int] = None


class Prova(ProvaBase):
    """Schema for reading a Prova"""

    id: UUID
    total_questoes: int = 0
    total_anuladas: int = 0
    status: str = "extraido"
    metadados: dict = {}
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProvaWithQuestoes(Prova):
    """Prova with questões"""

    from src.schemas.questao import QuestaoList

    questoes: list[QuestaoList] = []
