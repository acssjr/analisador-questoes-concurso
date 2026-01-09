"""
Classificacao Pydantic schemas
"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ClassificacaoBase(BaseModel):
    disciplina: str = Field(..., min_length=1)
    assunto: Optional[str] = None
    topico: Optional[str] = None
    subtopico: Optional[str] = None
    conceito_especifico: Optional[str] = None

    confianca_disciplina: Optional[float] = Field(None, ge=0.0, le=1.0)
    confianca_assunto: Optional[float] = Field(None, ge=0.0, le=1.0)
    confianca_topico: Optional[float] = Field(None, ge=0.0, le=1.0)
    confianca_subtopico: Optional[float] = Field(None, ge=0.0, le=1.0)

    conceito_testado: Optional[str] = None
    habilidade_bloom: Optional[str] = None
    nivel_dificuldade: Optional[str] = None


class ClassificacaoCreate(ClassificacaoBase):
    """Schema for creating a Classificacao"""

    questao_id: UUID
    edital_id: Optional[UUID] = None
    item_edital_path: Optional[str] = None
    conceitos_adjacentes: Optional[list[str]] = None
    analise_alternativas: Optional[dict] = None
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    prompt_usado: Optional[str] = None
    raw_response: Optional[dict] = None


class ClassificacaoRead(ClassificacaoBase):
    """Schema for reading a Classificacao"""

    id: UUID
    questao_id: UUID
    edital_id: Optional[UUID] = None
    item_edital_path: Optional[str] = None
    conceitos_adjacentes: list[str] = []
    analise_alternativas: dict = {}
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
