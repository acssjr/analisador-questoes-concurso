"""
Projeto Pydantic schemas
"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ProjetoBase(BaseModel):
    nome: str = Field(..., min_length=1, description="Nome do projeto")
    descricao: Optional[str] = Field(None, description="Descrição do projeto")
    banca: Optional[str] = None
    cargo: Optional[str] = None
    ano: Optional[int] = Field(None, ge=1900, le=2100)


class ProjetoCreate(ProjetoBase):
    """Schema for creating a Projeto"""
    pass


class ProjetoRead(ProjetoBase):
    """Schema for reading a Projeto"""
    id: UUID
    status: str
    total_provas: int
    total_questoes: int
    total_questoes_validas: int
    total_anuladas: int
    config: Optional[dict] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjetoReadWithEdital(ProjetoRead):
    """Schema for reading a Projeto with its Edital"""
    edital_id: Optional[UUID] = None
    edital_nome: Optional[str] = None
    has_taxonomia: bool = False

    class Config:
        from_attributes = True


class ProjetoUpdate(BaseModel):
    """Schema for updating a Projeto"""
    nome: Optional[str] = None
    descricao: Optional[str] = None
    banca: Optional[str] = None
    cargo: Optional[str] = None
    ano: Optional[int] = Field(None, ge=1900, le=2100)
    status: Optional[str] = None
    config: Optional[dict] = None


class ProjetoStats(BaseModel):
    """Estatísticas detalhadas do projeto"""
    total_provas: int
    total_questoes: int
    total_questoes_validas: int
    total_anuladas: int
    provas_por_ano: dict[int, int] = Field(default_factory=dict)
    questoes_por_disciplina: dict[str, int] = Field(default_factory=dict)
    status: str
    pronto_para_analise: bool


class ProjetoListResponse(BaseModel):
    """Response for listing projects"""
    projetos: list[ProjetoReadWithEdital]
    total: int
