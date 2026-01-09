"""
Provas routes - CRUD operations
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db

router = APIRouter()


@router.get("/")
async def list_provas(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    """List all provas"""
    # TODO: Implement
    return {"message": "List provas - TODO"}


@router.get("/{prova_id}")
async def get_prova(prova_id: str, db: AsyncSession = Depends(get_db)):
    """Get prova by ID"""
    # TODO: Implement
    return {"message": f"Get prova {prova_id} - TODO"}
