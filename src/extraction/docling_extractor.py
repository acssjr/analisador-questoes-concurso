# src/extraction/docling_extractor.py
"""
Docling-based PDF extraction.

Replaces PyMuPDF for text extraction with superior column handling
and layout understanding via IBM's Docling library.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from loguru import logger


@dataclass
class DoclingExtractionResult:
    """Result of Docling extraction."""

    text: str  # Plain text content
    markdown: str  # Markdown-formatted content
    page_count: int
    tables: list[dict] = field(default_factory=list)  # Extracted tables
    success: bool = True
    error: Optional[str] = None

    @property
    def has_tables(self) -> bool:
        """Check if any tables were extracted."""
        return len(self.tables) > 0


def extract_with_docling(
    pdf_path: str | Path,
    extract_tables: bool = True,
    force_ocr: bool = False,
) -> DoclingExtractionResult:
    """
    Extract text from PDF using Docling.

    Docling's docling-parse backend handles:
    - Multi-column layouts (left-to-right, then next row)
    - Complex table structures
    - Mixed text/image regions

    Args:
        pdf_path: Path to PDF file
        extract_tables: Whether to extract table structures
        force_ocr: Force OCR on all pages (useful for multi-column PDFs
                   where embedded text layer has column bleeding issues)

    Returns:
        DoclingExtractionResult with text, markdown, and tables
    """
    pdf_path = Path(pdf_path)

    if not pdf_path.exists():
        return DoclingExtractionResult(
            text="",
            markdown="",
            page_count=0,
            success=False,
            error=f"File not found: {pdf_path}",
        )

    try:
        # Import here to avoid startup cost if not used
        import platform
        from docling.document_converter import DocumentConverter
        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import PdfPipelineOptions
        from docling.document_converter import PdfFormatOption

        logger.info(f"Extracting with Docling: {pdf_path.name}")

        # Configure pipeline for exam documents
        pipeline_options = PdfPipelineOptions()
        pipeline_options.do_table_structure = extract_tables

        # Configure OCR if forced (for multi-column PDFs with text layer issues)
        if force_ocr:
            try:
                from docling.datamodel.pipeline_options import RapidOcrOptions

                ocr_options = RapidOcrOptions(
                    lang=["por"],  # Portuguese
                    force_full_page_ocr=True,  # Force OCR on ALL pages
                )
                pipeline_options.do_ocr = True
                pipeline_options.ocr_options = ocr_options
                logger.info("Forced OCR enabled (RapidOCR with Portuguese)")
            except ImportError:
                logger.warning("RapidOCR not available, OCR disabled")
                pipeline_options.do_ocr = False
        else:
            pipeline_options.do_ocr = False

        # Select backend - use pypdfium2 on Windows due to docling-parse path bug
        # See: https://github.com/DS4SD/docling-parse/issues/XXX (double slash in paths)
        backend = None  # Use default
        if platform.system() == "Windows":
            try:
                from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend
                backend = PyPdfiumDocumentBackend
                logger.debug("Using PyPdfium backend (Windows workaround)")
            except ImportError:
                logger.warning("pypdfium2 backend not available, using default")

        # Create converter with options
        pdf_options = PdfFormatOption(
            pipeline_options=pipeline_options,
        )
        if backend:
            pdf_options = PdfFormatOption(
                pipeline_options=pipeline_options,
                backend=backend,
            )

        converter = DocumentConverter(
            format_options={
                InputFormat.PDF: pdf_options,
            }
        )

        # Convert document
        result = converter.convert(str(pdf_path))
        doc = result.document

        # Export to different formats
        markdown_text = doc.export_to_markdown()
        plain_text = doc.export_to_text()

        # Extract tables if present
        tables = []
        if extract_tables and hasattr(doc, 'tables'):
            for table in doc.tables:
                try:
                    tables.append({
                        "header": table.header if hasattr(table, 'header') else [],
                        "rows": table.rows if hasattr(table, 'rows') else [],
                        "page": table.page if hasattr(table, 'page') else None,
                    })
                except Exception as e:
                    logger.warning(f"Failed to extract table: {e}")

        # Count pages (from markdown page markers or estimate)
        page_count = markdown_text.count("<!-- page") or len(plain_text) // 3000 + 1

        logger.info(
            f"Docling extraction complete: {len(plain_text)} chars, "
            f"~{page_count} pages, {len(tables)} tables"
        )

        return DoclingExtractionResult(
            text=plain_text,
            markdown=markdown_text,
            page_count=page_count,
            tables=tables,
            success=True,
        )

    except ImportError as e:
        logger.error(f"Docling not installed: {e}")
        return DoclingExtractionResult(
            text="",
            markdown="",
            page_count=0,
            success=False,
            error=f"Docling not installed: {e}",
        )
    except Exception as e:
        logger.error(f"Docling extraction failed: {e}")
        return DoclingExtractionResult(
            text="",
            markdown="",
            page_count=0,
            success=False,
            error=str(e),
        )


def extract_page_with_docling(
    pdf_path: str | Path,
    page_number: int,
) -> DoclingExtractionResult:
    """
    Extract a single page from PDF using Docling.

    Note: Docling processes entire documents, so this extracts all
    and returns only the requested page content.

    Args:
        pdf_path: Path to PDF file
        page_number: 0-indexed page number

    Returns:
        DoclingExtractionResult for the specific page
    """
    # For single page, we could use PyMuPDF to extract just that page
    # to a temp file, but Docling works best on full documents.
    # Instead, extract full doc and split by page markers.

    full_result = extract_with_docling(pdf_path)

    if not full_result.success:
        return full_result

    # Try to split by page markers in markdown
    # Docling uses <!-- page N --> markers
    import re

    pages = re.split(r'<!-- page \d+ -->', full_result.markdown)

    if page_number < len(pages):
        page_content = pages[page_number]
        # Convert markdown back to plain text (simple strip)
        plain_text = re.sub(r'[#*_`]', '', page_content).strip()

        return DoclingExtractionResult(
            text=plain_text,
            markdown=page_content,
            page_count=1,
            tables=[],  # Tables not split by page currently
            success=True,
        )

    return DoclingExtractionResult(
        text=full_result.text,
        markdown=full_result.markdown,
        page_count=full_result.page_count,
        success=True,
        error=f"Could not isolate page {page_number}, returning full document",
    )
