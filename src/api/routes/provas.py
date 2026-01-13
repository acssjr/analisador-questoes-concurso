"""
Provas routes - CRUD operations
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.models.prova import Prova

router = APIRouter()


@router.get("/queue-status")
async def get_queue_status(
    projeto_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Get queue processing status for provas.

    Returns list of provas with their queue_status for real-time updates.
    """
    try:
        stmt = select(Prova)

        if projeto_id:
            stmt = stmt.where(Prova.projeto_id == projeto_id)

        stmt = stmt.order_by(Prova.created_at.desc())

        result = await db.execute(stmt)
        provas = result.scalars().all()

        return {
            "items": [
                {
                    "id": str(p.id),
                    "nome": p.nome,
                    "queue_status": p.queue_status or "pending",
                    "queue_error": p.queue_error,
                    "queue_checkpoint": p.queue_checkpoint,
                    "queue_retry_count": p.queue_retry_count or 0,
                    "confianca_media": p.confianca_media,
                    "total_questoes": p.total_questoes or 0,
                }
                for p in provas
            ]
        }
    except Exception as e:
        logger.error(f"Failed to get queue status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
