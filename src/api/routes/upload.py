"""
Upload routes - for PDF upload and extraction
"""
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, File, Query, UploadFile
from loguru import logger
from sqlalchemy import select

from src.core.config import get_settings
from src.core.database import get_db
from src.extraction.pci_parser import parse_pci_pdf
from src.extraction.pdf_detector import detect_pdf_format
from src.models.edital import Edital

settings = get_settings()
router = APIRouter()


@router.post("/pdf")
async def upload_pdf(
    files: List[UploadFile] = File(...), edital_id: Optional[uuid.UUID] = Query(None)
):
    """
    Upload and extract questions from multiple PDFs

    Args:
        files: PDF files
        edital_id: Optional UUID of edital to link questions to

    Returns:
        dict with extraction results for all files
    """
    try:
        # Get edital taxonomy if provided
        edital_taxonomia = None
        edital_info = None

        if edital_id:
            async for db in get_db():
                stmt = select(Edital).where(Edital.id == edital_id)
                result = await db.execute(stmt)
                edital = result.scalar_one_or_none()

                if edital:
                    edital_taxonomia = edital.taxonomia
                    edital_info = {
                        "id": str(edital.id),
                        "nome": edital.nome,
                        "banca": edital.banca,
                        "cargo": edital.cargo,
                        "ano": edital.ano,
                    }
                    logger.info(f"Linking upload to edital: {edital.nome}")
                else:
                    logger.warning(f"Edital {edital_id} not found, proceeding without taxonomy")

        # Process all files
        upload_dir = settings.raw_data_dir / "provas"
        upload_dir.mkdir(parents=True, exist_ok=True)

        results = []
        for file in files:
            try:
                # Save uploaded file
                file_path = upload_dir / file.filename
                with open(file_path, "wb") as f:
                    content = await file.read()
                    f.write(content)

                logger.info(f"File uploaded: {file_path}")

                # Detect format
                format_type = detect_pdf_format(file_path)

                # Extract based on format (PCI and GABARITO use same parser)
                if format_type in ["PCI", "GABARITO"]:
                    extraction_result = parse_pci_pdf(file_path)

                    file_result = {
                        "success": True,
                        "filename": file.filename,
                        "format": format_type,
                        "arquivo": str(file_path),
                        "total_questoes": len(extraction_result["questoes"]),
                        "metadados": extraction_result["metadados"],
                        "questoes": extraction_result["questoes"],
                    }
                else:
                    file_result = {
                        "success": False,
                        "filename": file.filename,
                        "error": f"Format {format_type} not supported yet. Only PCI/GABARITO formats are supported.",
                        "format": format_type,
                    }

                results.append(file_result)

            except Exception as file_error:
                logger.error(f"Failed to process {file.filename}: {file_error}")
                results.append({
                    "success": False,
                    "filename": file.filename,
                    "error": str(file_error),
                })

        # Build response
        total_questoes = sum(r.get("total_questoes", 0) for r in results if r["success"])
        successful_files = sum(1 for r in results if r["success"])

        response = {
            "success": successful_files > 0,
            "total_files": len(files),
            "successful_files": successful_files,
            "failed_files": len(files) - successful_files,
            "total_questoes": total_questoes,
            "results": results,
        }

        # Add edital info if linked
        if edital_info:
            response["edital"] = edital_info
            response["vinculado_edital"] = True
        else:
            response["vinculado_edital"] = False

        return response

    except Exception as e:
        logger.error(f"Upload failed: {e}")
        return {"success": False, "error": str(e)}
