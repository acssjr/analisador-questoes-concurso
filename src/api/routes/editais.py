"""
Editais routes - for edital upload, conteúdo programático, and management
"""
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import get_settings
from src.core.database import get_db
from src.extraction.edital_extractor import (
    extract_conteudo_programatico,
    extract_edital_metadata,
)
from src.models.edital import Edital
from src.schemas.edital import (
    ConteudoProgramaticoResponse,
    EditalRead,
    EditalUploadResponse,
)

settings = get_settings()
router = APIRouter()


@router.post("/upload", response_model=EditalUploadResponse)
async def upload_edital(file: UploadFile = File(...)):
    """
    Upload and extract edital metadata

    Args:
        file: Edital PDF file

    Returns:
        EditalUploadResponse with extracted metadata
    """
    try:
        # Validate file type
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are accepted")

        # Save uploaded file
        upload_dir = settings.raw_data_dir / "editais"
        upload_dir.mkdir(parents=True, exist_ok=True)

        # Generate unique filename
        file_id = str(uuid.uuid4())[:8]
        safe_filename = f"{file_id}_{file.filename}"
        file_path = upload_dir / safe_filename

        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)

        logger.info(f"Edital uploaded: {file_path}")

        # Extract metadata using LLM
        metadata = extract_edital_metadata(file_path)
        logger.info(f"[DEBUG] Metadata extracted: {metadata}")

        # Get disciplinas from metadata (ensure it's always a list)
        disciplinas = metadata.get("disciplinas") or []
        logger.info(f"[DEBUG] Disciplinas extracted: {disciplinas} (type: {type(disciplinas)})")

        # Create edital in database
        async for db in get_db():
            edital = Edital(
                nome=metadata.get("nome", file.filename),
                banca=metadata.get("banca"),
                cargo=metadata.get("cargo"),
                ano=metadata.get("ano"),
                arquivo_original=str(file_path),
                taxonomia={"disciplinas": []},  # Will be populated with conteúdo programático
            )

            db.add(edital)
            await db.commit()
            await db.refresh(edital)

            logger.info(f"Edital created: {edital.id}")

            logger.info(f"[DEBUG] About to create response with disciplinas={disciplinas}")
            return EditalUploadResponse(
                success=True,
                edital_id=edital.id,
                nome=edital.nome,
                banca=edital.banca,
                cargo=edital.cargo,
                ano=edital.ano,
                disciplinas=disciplinas,
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Edital upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Edital upload failed: {str(e)}")


@router.post("/{edital_id}/conteudo-programatico", response_model=ConteudoProgramaticoResponse)
async def upload_conteudo_programatico(edital_id: uuid.UUID, file: UploadFile = File(...)):
    """
    Upload and extract conteúdo programático taxonomy

    Args:
        edital_id: UUID of the edital
        file: Conteúdo programático PDF file

    Returns:
        ConteudoProgramaticoResponse with taxonomy stats
    """
    try:
        # Validate file type
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are accepted")

        # Check if edital exists
        async for db in get_db():
            stmt = select(Edital).where(Edital.id == edital_id)
            result = await db.execute(stmt)
            edital = result.scalar_one_or_none()

            if not edital:
                raise HTTPException(status_code=404, detail="Edital not found")

            # Save uploaded file
            upload_dir = settings.raw_data_dir / "editais" / str(edital_id)
            upload_dir.mkdir(parents=True, exist_ok=True)

            file_path = upload_dir / f"conteudo_programatico_{file.filename}"

            with open(file_path, "wb") as f:
                content = await file.read()
                f.write(content)

            logger.info(f"Conteúdo programático uploaded: {file_path}")

            # Extract taxonomy using LLM
            taxonomia = extract_conteudo_programatico(file_path)

            # Update edital with taxonomy
            edital.taxonomia = taxonomia
            await db.commit()

            # Calculate stats
            total_disciplinas = len(taxonomia.get("disciplinas", []))
            total_assuntos = sum(
                len(d.get("assuntos", [])) for d in taxonomia.get("disciplinas", [])
            )
            total_topicos = sum(
                len(a.get("topicos", []))
                for d in taxonomia.get("disciplinas", [])
                for a in d.get("assuntos", [])
            )

            logger.info(
                f"Taxonomy extracted: {total_disciplinas} disciplinas, {total_assuntos} assuntos, {total_topicos} tópicos"
            )

            return ConteudoProgramaticoResponse(
                success=True,
                edital_id=edital_id,
                total_disciplinas=total_disciplinas,
                total_assuntos=total_assuntos,
                total_topicos=total_topicos,
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Conteúdo programático upload failed: {e}")
        raise HTTPException(
            status_code=500, detail=f"Conteúdo programático upload failed: {str(e)}"
        )


@router.get("/", response_model=list[EditalRead])
async def list_editais():
    """
    List all editais

    Returns:
        List of editais
    """
    try:
        async for db in get_db():
            stmt = select(Edital).order_by(Edital.created_at.desc())
            result = await db.execute(stmt)
            editais = result.scalars().all()

            return [EditalRead.model_validate(e) for e in editais]

    except Exception as e:
        logger.error(f"Failed to list editais: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list editais: {str(e)}")


@router.get("/{edital_id}", response_model=EditalRead)
async def get_edital(edital_id: uuid.UUID):
    """
    Get edital by ID

    Args:
        edital_id: UUID of the edital

    Returns:
        Edital details
    """
    try:
        async for db in get_db():
            stmt = select(Edital).where(Edital.id == edital_id)
            result = await db.execute(stmt)
            edital = result.scalar_one_or_none()

            if not edital:
                raise HTTPException(status_code=404, detail="Edital not found")

            return EditalRead.model_validate(edital)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get edital: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get edital: {str(e)}")
