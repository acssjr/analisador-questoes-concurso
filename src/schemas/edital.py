"""
Edital Pydantic schemas
"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class EditalBase(BaseModel):
    nome: str = Field(..., min_length=1)
    banca: Optional[str] = None
    cargo: Optional[str] = None
    ano: Optional[int] = Field(None, ge=1900, le=2100)


class EditalCreate(EditalBase):
    """Schema for creating an Edital"""

    arquivo_original: Optional[str] = None
    taxonomia: dict = Field(default_factory=dict)


class EditalRead(EditalBase):
    """Schema for reading an Edital"""

    id: UUID
    arquivo_original: Optional[str] = None
    taxonomia: dict
    created_at: datetime

    class Config:
        from_attributes = True


class EditalUpdate(BaseModel):
    """Schema for updating an Edital"""

    nome: Optional[str] = None
    banca: Optional[str] = None
    cargo: Optional[str] = None
    ano: Optional[int] = Field(None, ge=1900, le=2100)
    taxonomia: Optional[dict] = None


class EditalUploadResponse(BaseModel):
    """Response for edital upload"""

    success: bool
    edital_id: UUID
    nome: str
    banca: Optional[str]
    cargos: list[str] = Field(default_factory=list)  # Lista de todos os cargos
    ano: Optional[int]
    disciplinas: list[str] = Field(default_factory=list)


class ConteudoProgramaticoResponse(BaseModel):
    """Response for conteudo programático upload"""

    success: bool
    edital_id: UUID
    total_disciplinas: int
    total_assuntos: int
    total_topicos: int
    taxonomia: dict = Field(default_factory=dict)  # Full hierarchical taxonomy
