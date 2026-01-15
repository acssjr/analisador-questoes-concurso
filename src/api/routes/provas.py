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
from src.models.questao import Questao

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


@router.delete("/{prova_id}")
async def delete_prova(prova_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    Delete a prova and all its associated questions.

    This allows re-uploading and re-extracting the PDF.
    """
    try:
        # Get the prova
        stmt = select(Prova).where(Prova.id == prova_id)
        result = await db.execute(stmt)
        prova = result.scalar_one_or_none()

        if not prova:
            raise HTTPException(status_code=404, detail="Prova not found")

        prova_nome = prova.nome

        # Delete all questions associated with this prova
        questoes_stmt = select(Questao).where(Questao.prova_id == prova_id)
        questoes_result = await db.execute(questoes_stmt)
        questoes = questoes_result.scalars().all()

        questoes_deleted = len(questoes)
        for q in questoes:
            await db.delete(q)

        # Delete the prova
        await db.delete(prova)
        await db.commit()

        logger.info(f"Deleted prova '{prova_nome}' with {questoes_deleted} questions")

        return {
            "success": True,
            "message": f"Prova '{prova_nome}' deleted with {questoes_deleted} questions",
            "prova_id": str(prova_id),
            "questoes_deleted": questoes_deleted,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete prova: {e}")
        raise HTTPException(status_code=500, detail=str(e))
