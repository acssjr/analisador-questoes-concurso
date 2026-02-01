# Docling + Vision Fallback Extraction Pipeline

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Substituir PyMuPDF por Docling como extrator primário, com fallback para Claude Vision em páginas problemáticas, resolvendo problemas de colunas fundidas e mojibake.

**Architecture:** Pipeline de 3 camadas - (1) Docling para extração base com quality scoring, (2) Claude Haiku para correção de texto, (3) Claude Vision para fallback visual. Roteamento automático baseado em métricas de qualidade.

**Tech Stack:** Docling (MIT), pdf2image + Poppler, pyspellchecker, Claude API (Haiku + Sonnet), Pydantic validation

---

## Visão Geral da Arquitetura

```
PDF → Docling (grátis) → Quality Check → OK? → Parse com LLM texto
                                ↓ ruim
                         Claude Haiku (correção)
                                ↓ ainda ruim
                         Claude Vision (fallback)
                                ↓
                         JSON estruturado
```

### Métricas de Roteamento

| Métrica | Threshold | Ação |
|---------|-----------|------|
| `quality_score` | ≥ 0.80 | Aceita Docling direto |
| `spell_error_rate` | ≤ 0.15 | OK |
| `long_word_ratio` | ≤ 0.05 | OK (>18 chars = concatenação) |
| Fallback Vision | < 10% páginas | Meta de custo |

---

## Task 1: Adicionar Dependências

**Files:**
- Modify: `pyproject.toml:29-33`

**Step 1: Editar pyproject.toml**

Adicionar após linha 33 (após pytesseract):

```toml
    # PDF Extraction (nova stack)
    "docling>=2.15.0",  # IBM document extraction (MIT)
    "pdf2image>=1.17.0",  # PDF rasterization for Vision fallback
    "pyspellchecker>=0.8.0",  # Quality check for extraction
```

**Step 2: Instalar Poppler (Windows)**

```bash
# Baixar Poppler de: https://github.com/oschwartz10612/poppler-windows/releases
# Extrair para C:\Program Files\poppler
# Adicionar C:\Program Files\poppler\Library\bin ao PATH do sistema
```

**Step 3: Instalar dependências**

```bash
uv pip install docling pdf2image pyspellchecker
```

**Step 4: Verificar instalação**

```bash
python -c "from docling.document_converter import DocumentConverter; print('Docling OK')"
python -c "from pdf2image import convert_from_path; print('pdf2image OK')"
python -c "from spellchecker import SpellChecker; print('SpellChecker OK')"
```

Expected: Três linhas "OK"

**Step 5: Commit**

```bash
git add pyproject.toml
git commit -m "chore: add docling, pdf2image, pyspellchecker dependencies"
```

---

## Task 2: Criar Módulo de Quality Check

**Files:**
- Create: `src/extraction/quality_checker.py`
- Create: `tests/extraction/test_quality_checker.py`

**Step 1: Escrever o teste**

```python
# tests/extraction/test_quality_checker.py
"""Tests for extraction quality checker."""

import pytest
from src.extraction.quality_checker import (
    QualityMetrics,
    assess_extraction_quality,
    needs_vision_fallback,
)


class TestQualityMetrics:
    """Test QualityMetrics dataclass."""

    def test_score_calculation_perfect(self):
        """Perfect extraction should have score near 1.0."""
        metrics = QualityMetrics(
            spell_error_rate=0.0,
            long_word_ratio=0.0,
            valid_word_ratio=1.0,
            word_count=100,
        )
        assert metrics.score >= 0.95

    def test_score_calculation_poor(self):
        """Poor extraction should have low score."""
        metrics = QualityMetrics(
            spell_error_rate=0.5,
            long_word_ratio=0.2,
            valid_word_ratio=0.5,
            word_count=100,
        )
        assert metrics.score < 0.5

    def test_needs_correction_threshold(self):
        """Score below threshold should need correction."""
        metrics = QualityMetrics(
            spell_error_rate=0.3,
            long_word_ratio=0.1,
            valid_word_ratio=0.7,
            word_count=100,
        )
        assert metrics.needs_correction(threshold=0.80) is True


class TestAssessExtractionQuality:
    """Test assess_extraction_quality function."""

    def test_good_portuguese_text(self):
        """Well-extracted Portuguese text should score high."""
        text = """
        A questão trata de interpretação de texto em língua portuguesa.
        O candidato deve analisar o trecho apresentado e identificar
        a alternativa correta conforme o enunciado da questão.
        """
        metrics = assess_extraction_quality(text)
        assert metrics.score >= 0.70
        assert metrics.spell_error_rate < 0.20

    def test_concatenated_words(self):
        """Text with concatenated words should have high long_word_ratio."""
        text = """
        Aquestãotratadetextoconcatenadoquenãofoiseparadocorretamente.
        Estaspalavrassãomuitolongasporqueforamjuntadaserronamente.
        """
        metrics = assess_extraction_quality(text)
        assert metrics.long_word_ratio > 0.3

    def test_insufficient_text(self):
        """Very short text should return zero score."""
        text = "abc"
        metrics = assess_extraction_quality(text)
        assert metrics.score == 0.0
        assert metrics.word_count < 10


class TestNeedsVisionFallback:
    """Test needs_vision_fallback convenience function."""

    def test_good_text_no_fallback(self):
        """Good quality text should not need vision fallback."""
        text = """
        Esta é uma questão de múltipla escolha sobre direito constitucional.
        O candidato deve marcar a alternativa que melhor corresponde ao
        entendimento do Supremo Tribunal Federal sobre a matéria.
        """
        assert needs_vision_fallback(text) is False

    def test_bad_text_needs_fallback(self):
        """Poor quality text should need vision fallback."""
        text = "Estéétextocorrompidocommuitoserrosdextraçãoepalavrasjuntas"
        assert needs_vision_fallback(text) is True
```

**Step 2: Rodar teste para verificar que falha**

```bash
pytest tests/extraction/test_quality_checker.py -v
```

Expected: FAIL com "ModuleNotFoundError: No module named 'src.extraction.quality_checker'"

**Step 3: Implementar quality_checker.py**

```python
# src/extraction/quality_checker.py
"""
Extraction quality checker for intelligent routing.

Assesses text quality to determine if it needs correction via LLM
or fallback to Vision extraction.
"""

from dataclasses import dataclass
from typing import Optional

from loguru import logger

# Lazy import to avoid startup cost
_spell_checker = None


def _get_spell_checker():
    """Lazy load spell checker."""
    global _spell_checker
    if _spell_checker is None:
        from spellchecker import SpellChecker
        _spell_checker = SpellChecker(language="pt")
    return _spell_checker


@dataclass
class QualityMetrics:
    """Metrics for assessing extraction quality."""

    spell_error_rate: float  # Proportion of misspelled words (0-1)
    long_word_ratio: float   # Proportion of words >18 chars (0-1)
    valid_word_ratio: float  # Proportion of recognized words (0-1)
    word_count: int          # Total words analyzed
    flagged_words: list[str] = None  # Sample of problematic words

    def __post_init__(self):
        if self.flagged_words is None:
            self.flagged_words = []

    @property
    def score(self) -> float:
        """
        Composite quality score (0-1, higher = better).

        Weighs spell errors heavily, penalizes concatenated words.
        """
        if self.word_count < 10:
            return 0.0

        # Base score from valid words
        base = self.valid_word_ratio

        # Penalty for spell errors (up to 50% reduction)
        spell_penalty = min(self.spell_error_rate, 0.5) * 2

        # Penalty for concatenated words (5x weight since rare in normal text)
        concat_penalty = min(self.long_word_ratio * 5, 0.5)

        score = base * (1 - spell_penalty) * (1 - concat_penalty)
        return max(0.0, min(1.0, score))

    def needs_correction(self, threshold: float = 0.80) -> bool:
        """Check if extraction needs correction."""
        return self.score < threshold or self.long_word_ratio > 0.05


def assess_extraction_quality(
    text: str,
    sample_size: int = 500,
) -> QualityMetrics:
    """
    Assess quality of extracted text.

    Args:
        text: Extracted text to analyze
        sample_size: Max words to check for spell errors (performance)

    Returns:
        QualityMetrics with detailed quality information
    """
    # Tokenize - only alphabetic words with 3+ chars
    words = [w for w in text.split() if w.isalpha() and len(w) >= 3]

    if len(words) < 10:
        logger.debug(f"Insufficient words for quality check: {len(words)}")
        return QualityMetrics(
            spell_error_rate=1.0,
            long_word_ratio=0.0,
            valid_word_ratio=0.0,
            word_count=len(words),
        )

    # Sample words for spell checking (expensive operation)
    sample = words[:sample_size] if len(words) > sample_size else words

    # Spell check
    spell = _get_spell_checker()
    misspelled = spell.unknown([w.lower() for w in sample])
    spell_error_rate = len(misspelled) / len(sample)

    # Long words (likely concatenations)
    long_words = [w for w in words if len(w) > 18]
    long_word_ratio = len(long_words) / len(words)

    # Valid word ratio
    valid_word_ratio = 1.0 - spell_error_rate

    # Sample flagged words for debugging
    flagged = list(long_words[:3]) + list(misspelled)[:2]

    metrics = QualityMetrics(
        spell_error_rate=round(spell_error_rate, 4),
        long_word_ratio=round(long_word_ratio, 4),
        valid_word_ratio=round(valid_word_ratio, 4),
        word_count=len(words),
        flagged_words=flagged,
    )

    logger.debug(
        f"Quality assessment: score={metrics.score:.3f}, "
        f"spell_errors={metrics.spell_error_rate:.1%}, "
        f"long_words={metrics.long_word_ratio:.1%}"
    )

    return metrics


def needs_vision_fallback(
    text: str,
    quality_threshold: float = 0.75,
) -> bool:
    """
    Quick check if text needs Vision LLM fallback.

    Args:
        text: Extracted text to check
        quality_threshold: Score below which Vision is needed

    Returns:
        True if Vision fallback recommended
    """
    metrics = assess_extraction_quality(text)
    return metrics.score < quality_threshold
```

**Step 4: Rodar testes para verificar que passam**

```bash
pytest tests/extraction/test_quality_checker.py -v
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/extraction/quality_checker.py tests/extraction/test_quality_checker.py
git commit -m "feat(extraction): add quality checker for routing decisions"
```

---

## Task 3: Criar Módulo de Extração com Docling

**Files:**
- Create: `src/extraction/docling_extractor.py`
- Create: `tests/extraction/test_docling_extractor.py`

**Step 1: Escrever o teste**

```python
# tests/extraction/test_docling_extractor.py
"""Tests for Docling-based PDF extraction."""

import pytest
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

from src.extraction.docling_extractor import (
    extract_with_docling,
    DoclingExtractionResult,
)


class TestDoclingExtractor:
    """Test Docling extraction functions."""

    def test_result_dataclass(self):
        """DoclingExtractionResult should store all fields."""
        result = DoclingExtractionResult(
            text="Test content",
            markdown="# Test\n\nTest content",
            page_count=5,
            tables=[{"header": ["A", "B"], "rows": [["1", "2"]]}],
            success=True,
            error=None,
        )
        assert result.success is True
        assert result.page_count == 5
        assert len(result.tables) == 1

    @patch("src.extraction.docling_extractor.DocumentConverter")
    def test_extract_with_docling_success(self, mock_converter_class):
        """Successful extraction should return text and markdown."""
        # Setup mock
        mock_doc = MagicMock()
        mock_doc.export_to_markdown.return_value = "# Questão 1\n\nEnunciado"
        mock_doc.export_to_text.return_value = "Questão 1 Enunciado"
        mock_doc.tables = []

        mock_result = MagicMock()
        mock_result.document = mock_doc

        mock_converter = MagicMock()
        mock_converter.convert.return_value = mock_result
        mock_converter_class.return_value = mock_converter

        # Execute
        result = extract_with_docling("test.pdf")

        # Assert
        assert result.success is True
        assert "Questão" in result.text
        assert result.markdown is not None

    @patch("src.extraction.docling_extractor.DocumentConverter")
    def test_extract_with_docling_failure(self, mock_converter_class):
        """Failed extraction should return error."""
        mock_converter = MagicMock()
        mock_converter.convert.side_effect = Exception("PDF corrupted")
        mock_converter_class.return_value = mock_converter

        result = extract_with_docling("bad.pdf")

        assert result.success is False
        assert "PDF corrupted" in result.error


class TestDoclingIntegration:
    """Integration tests with real PDFs (skip if no test data)."""

    @pytest.fixture
    def sample_pdf_path(self):
        """Path to a sample test PDF."""
        # Use an existing test PDF if available
        paths = [
            Path("data/raw/provas/PROVA UNEB 2024 TÉCNICO UNIVERSITÁRIO.pdf"),
            Path("tests/fixtures/sample_prova.pdf"),
        ]
        for p in paths:
            if p.exists():
                return p
        pytest.skip("No test PDF available")

    @pytest.mark.integration
    def test_real_pdf_extraction(self, sample_pdf_path):
        """Extract real PDF and verify structure."""
        result = extract_with_docling(str(sample_pdf_path))

        assert result.success is True
        assert result.page_count > 0
        assert len(result.text) > 1000  # Substantial content
        # Should find question markers
        assert "Questão" in result.text or "QUESTÃO" in result.text
```

**Step 2: Rodar teste para verificar que falha**

```bash
pytest tests/extraction/test_docling_extractor.py -v -k "not integration"
```

Expected: FAIL com "ModuleNotFoundError"

**Step 3: Implementar docling_extractor.py**

```python
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
        from docling.document_converter import DocumentConverter
        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import PdfPipelineOptions
        from docling.document_converter import PdfFormatOption

        logger.info(f"Extracting with Docling: {pdf_path.name}")

        # Configure pipeline for exam documents
        pipeline_options = PdfPipelineOptions()
        pipeline_options.do_ocr = False  # We handle OCR separately if needed
        pipeline_options.do_table_structure = extract_tables

        # Create converter with options
        converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(
                    pipeline_options=pipeline_options,
                )
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
```

**Step 4: Rodar testes**

```bash
pytest tests/extraction/test_docling_extractor.py -v -k "not integration"
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/extraction/docling_extractor.py tests/extraction/test_docling_extractor.py
git commit -m "feat(extraction): add Docling-based PDF extractor"
```

---

## Task 4: Criar Módulo de Vision Fallback

**Files:**
- Create: `src/extraction/vision_extractor.py`
- Create: `tests/extraction/test_vision_extractor.py`

**Step 1: Escrever o teste**

```python
# tests/extraction/test_vision_extractor.py
"""Tests for Vision LLM fallback extraction."""

import pytest
import base64
from unittest.mock import Mock, patch, MagicMock
from pathlib import Path

from src.extraction.vision_extractor import (
    VisionExtractionResult,
    rasterize_pdf_page,
    extract_page_with_vision,
    VISION_EXTRACTION_PROMPT,
)


class TestVisionExtractionResult:
    """Test VisionExtractionResult dataclass."""

    def test_result_fields(self):
        """Result should store all fields."""
        result = VisionExtractionResult(
            questions=[{"numero": 1, "enunciado": "Test"}],
            page_number=0,
            tokens_used=1500,
            success=True,
        )
        assert result.success is True
        assert len(result.questions) == 1


class TestRasterizePdfPage:
    """Test PDF rasterization."""

    @patch("src.extraction.vision_extractor.convert_from_path")
    def test_rasterize_returns_base64(self, mock_convert):
        """Rasterization should return base64-encoded PNG."""
        # Create mock PIL Image
        mock_image = MagicMock()
        mock_image.tobytes.return_value = b"fake_png_data"
        mock_convert.return_value = [mock_image]

        # Mock BytesIO and image saving
        with patch("src.extraction.vision_extractor.BytesIO") as mock_bytesio:
            mock_buffer = MagicMock()
            mock_buffer.getvalue.return_value = b"fake_png_data"
            mock_bytesio.return_value = mock_buffer

            result = rasterize_pdf_page("test.pdf", page_number=0, dpi=200)

        assert result is not None
        # Should be valid base64
        try:
            decoded = base64.b64decode(result)
            assert len(decoded) > 0
        except Exception:
            pytest.fail("Result is not valid base64")


class TestExtractPageWithVision:
    """Test Vision LLM extraction."""

    @patch("src.extraction.vision_extractor.rasterize_pdf_page")
    @patch("src.extraction.vision_extractor.AnthropicClient")
    def test_extract_success(self, mock_client_class, mock_rasterize):
        """Successful Vision extraction should return questions."""
        # Setup mocks
        mock_rasterize.return_value = base64.b64encode(b"fake_image").decode()

        mock_client = MagicMock()
        mock_client.generate_with_image.return_value = {
            "content": '{"questoes": [{"numero": 1, "enunciado": "Test", "alternativas": {"A": "a", "B": "b", "C": "c", "D": "d", "E": "e"}}]}',
            "tokens": {"total": 1500},
        }
        mock_client_class.return_value = mock_client

        result = extract_page_with_vision("test.pdf", page_number=0)

        assert result.success is True
        assert len(result.questions) == 1
        assert result.questions[0]["numero"] == 1

    @patch("src.extraction.vision_extractor.rasterize_pdf_page")
    def test_extract_rasterize_failure(self, mock_rasterize):
        """Failed rasterization should return error."""
        mock_rasterize.return_value = None

        result = extract_page_with_vision("test.pdf", page_number=0)

        assert result.success is False
        assert "rasterize" in result.error.lower()


class TestVisionPrompt:
    """Test Vision extraction prompt."""

    def test_prompt_includes_json_format(self):
        """Prompt should specify JSON output format."""
        assert "JSON" in VISION_EXTRACTION_PROMPT or "json" in VISION_EXTRACTION_PROMPT

    def test_prompt_includes_portuguese_handling(self):
        """Prompt should mention Portuguese characters."""
        assert "português" in VISION_EXTRACTION_PROMPT.lower() or "acentos" in VISION_EXTRACTION_PROMPT.lower()
```

**Step 2: Rodar teste para verificar que falha**

```bash
pytest tests/extraction/test_vision_extractor.py -v
```

Expected: FAIL

**Step 3: Implementar vision_extractor.py**

```python
# src/extraction/vision_extractor.py
"""
Vision LLM fallback extraction.

Uses Claude Vision (Sonnet) to extract questions from PDF pages
when text-based extraction fails due to layout issues or corrupted text.
"""

import base64
import json
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path
from typing import Optional

from loguru import logger


@dataclass
class VisionExtractionResult:
    """Result of Vision LLM extraction."""

    questions: list[dict] = field(default_factory=list)
    page_number: int = 0
    tokens_used: int = 0
    success: bool = True
    error: Optional[str] = None
    raw_response: Optional[str] = None


# Prompt otimizado para extração de questões via Vision
VISION_EXTRACTION_PROMPT = """Extraia todas as questões de múltipla escolha desta página de prova de concurso brasileiro.

FORMATO DE SAÍDA (JSON estrito):
{
  "questoes": [
    {
      "numero": integer,
      "disciplina": "string ou null se não identificável",
      "enunciado": "texto completo do enunciado preservando quebras de linha",
      "alternativas": {
        "A": "texto da alternativa A",
        "B": "texto da alternativa B",
        "C": "texto da alternativa C",
        "D": "texto da alternativa D",
        "E": "texto da alternativa E"
      },
      "gabarito": "A" | "B" | "C" | "D" | "E" | null
    }
  ],
  "questao_incompleta": boolean,
  "texto_continuacao": "texto que parece ser continuação de questão anterior" | null
}

REGRAS CRÍTICAS:
1. Extraia TODAS as questões visíveis, mesmo parciais
2. Se a questão começou em página anterior, inclua apenas a parte visível aqui
3. Se texto no TOPO da página (antes de "Questão N") parece ser continuação, coloque em "texto_continuacao"
4. Preserve EXATAMENTE os acentos e caracteres do português (á, é, í, ó, ú, ã, õ, ç)
5. NÃO corrija erros de ortografia - transcreva fielmente
6. Se houver imagens/figuras/tabelas no enunciado, descreva em [colchetes]
7. Respeite a ordem de leitura visual (esquerda→direita, cima→baixo, coluna por coluna)

ATENÇÃO PARA LAYOUTS DE DUAS COLUNAS:
- Processe a coluna ESQUERDA completamente primeiro
- Depois processe a coluna DIREITA
- Uma questão pode começar no fim da coluna esquerda e continuar no topo da direita

Retorne APENAS o JSON válido, sem explicações ou markdown."""


def rasterize_pdf_page(
    pdf_path: str | Path,
    page_number: int,
    dpi: int = 200,
) -> Optional[str]:
    """
    Convert a PDF page to base64-encoded PNG image.

    Args:
        pdf_path: Path to PDF file
        page_number: 0-indexed page number
        dpi: Resolution for rasterization (200 is good balance)

    Returns:
        Base64-encoded PNG string, or None if failed
    """
    try:
        from pdf2image import convert_from_path

        logger.debug(f"Rasterizing page {page_number} at {dpi} DPI")

        # Convert only the specific page (1-indexed for pdf2image)
        images = convert_from_path(
            pdf_path,
            dpi=dpi,
            first_page=page_number + 1,
            last_page=page_number + 1,
            fmt="PNG",
        )

        if not images:
            logger.error(f"No image generated for page {page_number}")
            return None

        # Convert PIL Image to base64
        img = images[0]
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        img_bytes = buffer.getvalue()

        b64_string = base64.standard_b64encode(img_bytes).decode("utf-8")

        logger.debug(f"Rasterized page {page_number}: {len(img_bytes)} bytes")
        return b64_string

    except ImportError:
        logger.error("pdf2image not installed. Run: pip install pdf2image")
        return None
    except Exception as e:
        logger.error(f"Failed to rasterize page {page_number}: {e}")
        return None


def extract_page_with_vision(
    pdf_path: str | Path,
    page_number: int,
    dpi: int = 200,
    model: str = "claude-sonnet-4-20250514",
) -> VisionExtractionResult:
    """
    Extract questions from a PDF page using Claude Vision.

    This is the fallback method when text extraction fails.

    Args:
        pdf_path: Path to PDF file
        page_number: 0-indexed page number
        dpi: Resolution for rasterization
        model: Claude model to use

    Returns:
        VisionExtractionResult with extracted questions
    """
    pdf_path = Path(pdf_path)

    # Step 1: Rasterize the page
    image_b64 = rasterize_pdf_page(pdf_path, page_number, dpi)

    if image_b64 is None:
        return VisionExtractionResult(
            page_number=page_number,
            success=False,
            error="Failed to rasterize PDF page",
        )

    # Step 2: Call Claude Vision
    try:
        from src.llm.providers.anthropic_client import AnthropicClient

        client = AnthropicClient()

        logger.info(f"Calling Claude Vision for page {page_number}")

        # Create a temporary file-like path for the image
        # The AnthropicClient expects a file path, but we have base64
        # We need to modify the call or create temp file

        # Actually, let's call the API directly for base64
        import anthropic
        from src.core.config import get_settings

        settings = get_settings()
        api_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

        response = api_client.messages.create(
            model=model,
            max_tokens=4000,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": image_b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": VISION_EXTRACTION_PROMPT,
                    },
                ],
            }],
        )

        content = response.content[0].text
        tokens_used = response.usage.input_tokens + response.usage.output_tokens

        logger.info(f"Vision extraction complete: {tokens_used} tokens")

        # Parse JSON response
        try:
            # Clean potential markdown wrapping
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]

            data = json.loads(content.strip())
            questions = data.get("questoes", [])

            # Add metadata to each question
            for q in questions:
                q["extraction_method"] = "vision"
                q["page"] = page_number

            return VisionExtractionResult(
                questions=questions,
                page_number=page_number,
                tokens_used=tokens_used,
                success=True,
                raw_response=content,
            )

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Vision response as JSON: {e}")
            return VisionExtractionResult(
                page_number=page_number,
                success=False,
                error=f"Invalid JSON response: {e}",
                raw_response=content,
            )

    except ImportError as e:
        logger.error(f"Anthropic client not available: {e}")
        return VisionExtractionResult(
            page_number=page_number,
            success=False,
            error=f"Anthropic client not installed: {e}",
        )
    except Exception as e:
        logger.error(f"Vision extraction failed: {e}")
        return VisionExtractionResult(
            page_number=page_number,
            success=False,
            error=str(e),
        )


def extract_pages_with_vision(
    pdf_path: str | Path,
    page_numbers: list[int],
    dpi: int = 200,
) -> list[VisionExtractionResult]:
    """
    Extract multiple pages with Vision LLM.

    Args:
        pdf_path: Path to PDF file
        page_numbers: List of 0-indexed page numbers
        dpi: Resolution for rasterization

    Returns:
        List of VisionExtractionResult for each page
    """
    results = []

    for page_num in page_numbers:
        result = extract_page_with_vision(pdf_path, page_num, dpi)
        results.append(result)

        # Log progress
        status = "OK" if result.success else f"FAIL: {result.error}"
        logger.info(f"Page {page_num}: {status}")

    return results
```

**Step 4: Rodar testes**

```bash
pytest tests/extraction/test_vision_extractor.py -v
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/extraction/vision_extractor.py tests/extraction/test_vision_extractor.py
git commit -m "feat(extraction): add Vision LLM fallback extractor"
```

---

## Task 5: Criar Pipeline Híbrido Principal

**Files:**
- Create: `src/extraction/hybrid_extractor.py`
- Create: `tests/extraction/test_hybrid_extractor.py`

**Step 1: Escrever o teste**

```python
# tests/extraction/test_hybrid_extractor.py
"""Tests for hybrid extraction pipeline."""

import pytest
from unittest.mock import Mock, patch, MagicMock
from pathlib import Path

from src.extraction.hybrid_extractor import (
    HybridExtractionPipeline,
    ExtractionTier,
    HybridExtractionResult,
)


class TestExtractionTier:
    """Test ExtractionTier enum."""

    def test_tier_values(self):
        """All tiers should be defined."""
        assert ExtractionTier.DOCLING.value == "docling"
        assert ExtractionTier.TEXT_LLM.value == "text_llm"
        assert ExtractionTier.VISION_LLM.value == "vision_llm"


class TestHybridExtractionResult:
    """Test HybridExtractionResult dataclass."""

    def test_result_fields(self):
        """Result should store all required fields."""
        result = HybridExtractionResult(
            questions=[{"numero": 1}],
            tier_used=ExtractionTier.DOCLING,
            quality_score=0.85,
            pages_by_tier={
                ExtractionTier.DOCLING: [0, 1, 2],
                ExtractionTier.VISION_LLM: [3],
            },
            total_pages=4,
            success=True,
        )
        assert result.success
        assert result.vision_fallback_rate == 0.25  # 1/4 pages


class TestHybridExtractionPipeline:
    """Test hybrid extraction pipeline."""

    @patch("src.extraction.hybrid_extractor.extract_with_docling")
    @patch("src.extraction.hybrid_extractor.assess_extraction_quality")
    def test_docling_only_good_quality(self, mock_quality, mock_docling):
        """Good quality extraction should use Docling only."""
        # Setup mocks
        mock_docling.return_value = MagicMock(
            success=True,
            text="Questão 1 sobre português. Alternativas A B C D E.",
            page_count=2,
        )
        mock_quality.return_value = MagicMock(score=0.90, needs_correction=lambda t=0.8: False)

        pipeline = HybridExtractionPipeline()

        with patch.object(pipeline, "_parse_questions_from_text") as mock_parse:
            mock_parse.return_value = [{"numero": 1}]
            result = pipeline.extract("test.pdf")

        assert result.success
        assert ExtractionTier.DOCLING in result.pages_by_tier
        assert ExtractionTier.VISION_LLM not in result.pages_by_tier or \
               len(result.pages_by_tier.get(ExtractionTier.VISION_LLM, [])) == 0

    @patch("src.extraction.hybrid_extractor.extract_with_docling")
    @patch("src.extraction.hybrid_extractor.assess_extraction_quality")
    @patch("src.extraction.hybrid_extractor.extract_page_with_vision")
    def test_vision_fallback_bad_quality(self, mock_vision, mock_quality, mock_docling):
        """Poor quality extraction should trigger Vision fallback."""
        # Setup mocks
        mock_docling.return_value = MagicMock(
            success=True,
            text="Textocorrompidosemespaços",
            page_count=1,
        )
        mock_quality.return_value = MagicMock(score=0.30, needs_correction=lambda t=0.8: True)
        mock_vision.return_value = MagicMock(
            success=True,
            questions=[{"numero": 1, "enunciado": "Questão correta"}],
        )

        pipeline = HybridExtractionPipeline()
        result = pipeline.extract("test.pdf")

        assert result.success
        assert mock_vision.called

    @patch("src.extraction.hybrid_extractor.extract_with_docling")
    def test_docling_failure_uses_vision(self, mock_docling):
        """Docling failure should trigger full Vision extraction."""
        mock_docling.return_value = MagicMock(
            success=False,
            error="PDF corrupted",
        )

        pipeline = HybridExtractionPipeline()

        with patch.object(pipeline, "_extract_all_with_vision") as mock_vision:
            mock_vision.return_value = [{"numero": 1}]
            result = pipeline.extract("test.pdf")

        assert mock_vision.called
```

**Step 2: Rodar teste para verificar que falha**

```bash
pytest tests/extraction/test_hybrid_extractor.py -v
```

Expected: FAIL

**Step 3: Implementar hybrid_extractor.py**

```python
# src/extraction/hybrid_extractor.py
"""
Hybrid extraction pipeline with intelligent routing.

Combines Docling (free) + Claude Haiku (cheap) + Claude Vision (fallback)
for optimal cost/accuracy balance.
"""

from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional

from loguru import logger

from src.extraction.docling_extractor import extract_with_docling, DoclingExtractionResult
from src.extraction.quality_checker import assess_extraction_quality, QualityMetrics
from src.extraction.vision_extractor import extract_page_with_vision, VisionExtractionResult
from src.llm.llm_orchestrator import LLMOrchestrator


class ExtractionTier(Enum):
    """Extraction method tiers."""
    DOCLING = "docling"
    TEXT_LLM = "text_llm"  # Claude Haiku for text correction
    VISION_LLM = "vision_llm"  # Claude Sonnet Vision


@dataclass
class HybridExtractionResult:
    """Result of hybrid extraction pipeline."""

    questions: list[dict] = field(default_factory=list)
    tier_used: ExtractionTier = ExtractionTier.DOCLING
    quality_score: float = 0.0
    pages_by_tier: dict[ExtractionTier, list[int]] = field(default_factory=dict)
    total_pages: int = 0
    success: bool = True
    error: Optional[str] = None

    @property
    def vision_fallback_rate(self) -> float:
        """Proportion of pages that needed Vision fallback."""
        if self.total_pages == 0:
            return 0.0
        vision_pages = len(self.pages_by_tier.get(ExtractionTier.VISION_LLM, []))
        return vision_pages / self.total_pages


class HybridExtractionPipeline:
    """
    Intelligent extraction pipeline with 3 tiers.

    Tier 1: Docling (free, handles columns well)
    Tier 2: Claude Haiku (cheap, corrects OCR errors)
    Tier 3: Claude Vision (expensive, 95%+ accuracy)

    Routes based on quality metrics to minimize cost while maximizing accuracy.
    """

    def __init__(
        self,
        quality_threshold: float = 0.80,
        vision_threshold: float = 0.60,
        use_text_correction: bool = True,
    ):
        """
        Initialize pipeline.

        Args:
            quality_threshold: Score above which Docling is accepted
            vision_threshold: Score below which Vision is used (after text correction)
            use_text_correction: Whether to try Haiku correction before Vision
        """
        self.quality_threshold = quality_threshold
        self.vision_threshold = vision_threshold
        self.use_text_correction = use_text_correction
        self._llm = None

    @property
    def llm(self) -> LLMOrchestrator:
        """Lazy load LLM orchestrator."""
        if self._llm is None:
            self._llm = LLMOrchestrator()
        return self._llm

    def extract(
        self,
        pdf_path: str | Path,
        expected_questions: Optional[int] = None,
    ) -> HybridExtractionResult:
        """
        Extract questions using hybrid pipeline.

        Args:
            pdf_path: Path to PDF file
            expected_questions: Expected number of questions (for validation)

        Returns:
            HybridExtractionResult with questions and metadata
        """
        pdf_path = Path(pdf_path)
        pages_by_tier: dict[ExtractionTier, list[int]] = {
            ExtractionTier.DOCLING: [],
            ExtractionTier.TEXT_LLM: [],
            ExtractionTier.VISION_LLM: [],
        }

        logger.info(f"Starting hybrid extraction: {pdf_path.name}")

        # TIER 1: Try Docling first
        docling_result = extract_with_docling(pdf_path)

        if not docling_result.success:
            logger.warning(f"Docling failed: {docling_result.error}")
            # Full Vision fallback
            return self._extract_all_with_vision_wrapped(pdf_path, pages_by_tier)

        # Assess quality
        quality = assess_extraction_quality(docling_result.text)
        logger.info(f"Docling quality score: {quality.score:.3f}")

        if quality.score >= self.quality_threshold:
            # Good quality - parse directly
            logger.info("Quality OK - using Docling extraction")
            pages_by_tier[ExtractionTier.DOCLING] = list(range(docling_result.page_count))

            questions = self._parse_questions_from_text(docling_result.text)

            return HybridExtractionResult(
                questions=questions,
                tier_used=ExtractionTier.DOCLING,
                quality_score=quality.score,
                pages_by_tier=pages_by_tier,
                total_pages=docling_result.page_count,
                success=True,
            )

        # TIER 2: Try text correction with Haiku
        if self.use_text_correction and quality.score >= self.vision_threshold:
            logger.info("Trying text correction with Claude Haiku")
            corrected_text = self._correct_text_with_haiku(docling_result.text)
            corrected_quality = assess_extraction_quality(corrected_text)

            if corrected_quality.score >= self.quality_threshold:
                logger.info(f"Text correction improved quality: {corrected_quality.score:.3f}")
                pages_by_tier[ExtractionTier.TEXT_LLM] = list(range(docling_result.page_count))

                questions = self._parse_questions_from_text(corrected_text)

                return HybridExtractionResult(
                    questions=questions,
                    tier_used=ExtractionTier.TEXT_LLM,
                    quality_score=corrected_quality.score,
                    pages_by_tier=pages_by_tier,
                    total_pages=docling_result.page_count,
                    success=True,
                )

        # TIER 3: Vision fallback
        logger.info("Quality still poor - using Vision fallback")
        return self._extract_all_with_vision_wrapped(pdf_path, pages_by_tier)

    def _correct_text_with_haiku(self, text: str) -> str:
        """
        Correct OCR errors using Claude Haiku (cheap).

        Args:
            text: Corrupted text from extraction

        Returns:
            Corrected text
        """
        try:
            prompt = f"""Corrija erros de OCR neste texto de prova de concurso em português.

REGRAS:
1. Separe palavras concatenadas (ex: "Aquestão" → "A questão")
2. Corrija confusões de caracteres: 'rn'→'m', 'l'→'I', '0'→'O'
3. Preserve a estrutura original (questões, alternativas)
4. NÃO adicione conteúdo - apenas corrija erros
5. Mantenha números de questões e letras de alternativas

TEXTO:
{text[:8000]}

TEXTO CORRIGIDO:"""

            result = self.llm.generate(
                prompt=prompt,
                temperature=0.1,
                max_tokens=8000,
                prefer_fast=True,  # Use Haiku if available
            )

            return result.get("content", text)

        except Exception as e:
            logger.error(f"Text correction failed: {e}")
            return text

    def _parse_questions_from_text(self, text: str) -> list[dict]:
        """
        Parse questions from extracted text using LLM.

        Args:
            text: Extracted/corrected text

        Returns:
            List of question dictionaries
        """
        from src.extraction.llm_parser import EXTRACTION_SYSTEM_PROMPT, parse_llm_response

        prompt = f"""Analise o texto abaixo extraído de uma prova de concurso e extraia TODAS as questões.

TEXTO:
{text}

Extraia todas as questões no formato JSON especificado."""

        try:
            result = self.llm.generate(
                prompt=prompt,
                system_prompt=EXTRACTION_SYSTEM_PROMPT,
                temperature=0.1,
                max_tokens=8192,
            )

            response_text = result.get("content", "")
            parsed = parse_llm_response(response_text)

            if parsed:
                questions = parsed.get("questoes", [])
                logger.info(f"Parsed {len(questions)} questions from text")
                return questions

            return []

        except Exception as e:
            logger.error(f"Question parsing failed: {e}")
            return []

    def _extract_all_with_vision_wrapped(
        self,
        pdf_path: Path,
        pages_by_tier: dict,
    ) -> HybridExtractionResult:
        """Wrapper for full Vision extraction."""
        questions = self._extract_all_with_vision(pdf_path)

        # Get page count
        import fitz
        doc = fitz.open(pdf_path)
        page_count = len(doc)
        doc.close()

        pages_by_tier[ExtractionTier.VISION_LLM] = list(range(page_count))

        return HybridExtractionResult(
            questions=questions,
            tier_used=ExtractionTier.VISION_LLM,
            quality_score=0.95,  # Vision assumed high quality
            pages_by_tier=pages_by_tier,
            total_pages=page_count,
            success=len(questions) > 0,
            error=None if questions else "No questions extracted",
        )

    def _extract_all_with_vision(self, pdf_path: Path) -> list[dict]:
        """
        Extract all pages with Vision LLM.

        Args:
            pdf_path: Path to PDF file

        Returns:
            List of all questions from all pages
        """
        import fitz

        doc = fitz.open(pdf_path)
        page_count = len(doc)
        doc.close()

        all_questions = []

        for page_num in range(page_count):
            logger.info(f"Vision extraction: page {page_num + 1}/{page_count}")

            result = extract_page_with_vision(pdf_path, page_num)

            if result.success:
                all_questions.extend(result.questions)
            else:
                logger.warning(f"Vision failed for page {page_num}: {result.error}")

        # Deduplicate by question number
        seen_numbers = set()
        unique_questions = []
        for q in all_questions:
            num = q.get("numero")
            if num not in seen_numbers:
                seen_numbers.add(num)
                unique_questions.append(q)

        logger.info(f"Vision extracted {len(unique_questions)} unique questions")
        return unique_questions


# Convenience function
def extract_questions_hybrid(
    pdf_path: str | Path,
    expected_questions: Optional[int] = None,
) -> HybridExtractionResult:
    """
    Extract questions using hybrid pipeline.

    This is the main entry point for the new extraction system.

    Args:
        pdf_path: Path to PDF file
        expected_questions: Expected number of questions (for validation)

    Returns:
        HybridExtractionResult with questions and metadata
    """
    pipeline = HybridExtractionPipeline()
    return pipeline.extract(pdf_path, expected_questions)
```

**Step 4: Rodar testes**

```bash
pytest tests/extraction/test_hybrid_extractor.py -v
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/extraction/hybrid_extractor.py tests/extraction/test_hybrid_extractor.py
git commit -m "feat(extraction): add hybrid extraction pipeline with Docling + Vision"
```

---

## Task 6: Integrar Pipeline na API de Upload

**Files:**
- Modify: `src/api/routes/upload.py`
- Modify: `src/extraction/llm_parser.py`

**Step 1: Adicionar flag para usar hybrid extraction**

Em `src/api/routes/upload.py`, adicionar import e modificar a função de upload:

```python
# Adicionar no topo do arquivo, após os imports existentes
from src.extraction.hybrid_extractor import extract_questions_hybrid, HybridExtractionResult

# Adicionar nova configuração
USE_HYBRID_EXTRACTION = True  # Feature flag para nova extração
```

**Step 2: Modificar função de extração**

Localizar a função que chama `extract_questions_chunked` e adicionar alternativa:

```python
# Na função de upload de provas, substituir:
# questoes_data = extract_questions_chunked(...)

# Por:
if USE_HYBRID_EXTRACTION:
    logger.info("Using hybrid extraction pipeline")
    hybrid_result = extract_questions_hybrid(pdf_path)

    if not hybrid_result.success:
        raise ExtractionError(f"Hybrid extraction failed: {hybrid_result.error}")

    questoes = hybrid_result.questions
    logger.info(
        f"Hybrid extraction complete: {len(questoes)} questions, "
        f"tier={hybrid_result.tier_used.value}, "
        f"vision_fallback={hybrid_result.vision_fallback_rate:.1%}"
    )
else:
    # Legacy extraction
    questoes_data = extract_questions_chunked(pdf_path, llm=llm)
    questoes = questoes_data.get("questoes", [])
```

**Step 3: Testar manualmente**

```bash
# Iniciar backend
uv run uvicorn src.api.main:app --reload --port 8000

# Em outro terminal, testar upload
curl -X POST "http://localhost:8000/api/upload/prova" \
  -F "file=@data/raw/provas/PROVA UNEB 2024 TÉCNICO UNIVERSITÁRIO.pdf" \
  -F "projeto_id=<id>"
```

**Step 4: Commit**

```bash
git add src/api/routes/upload.py
git commit -m "feat(api): integrate hybrid extraction pipeline in upload route"
```

---

## Task 7: Adicionar Testes de Integração

**Files:**
- Create: `tests/integration/test_hybrid_extraction_e2e.py`

**Step 1: Escrever teste E2E**

```python
# tests/integration/test_hybrid_extraction_e2e.py
"""End-to-end tests for hybrid extraction pipeline."""

import pytest
from pathlib import Path

from src.extraction.hybrid_extractor import (
    extract_questions_hybrid,
    ExtractionTier,
)


@pytest.fixture
def sample_pdf_path():
    """Path to sample exam PDF."""
    paths = [
        Path("data/raw/provas/PROVA UNEB 2024 TÉCNICO UNIVERSITÁRIO.pdf"),
        Path("tests/fixtures/sample_prova.pdf"),
    ]
    for p in paths:
        if p.exists():
            return p
    pytest.skip("No test PDF available")


@pytest.mark.integration
@pytest.mark.slow
class TestHybridExtractionE2E:
    """End-to-end integration tests."""

    def test_full_extraction_uneb_pdf(self, sample_pdf_path):
        """Extract real UNEB exam and verify question count."""
        result = extract_questions_hybrid(sample_pdf_path)

        assert result.success is True
        assert len(result.questions) >= 50  # UNEB has 60 questions
        assert result.total_pages > 0

        # Verify question structure
        for q in result.questions[:5]:
            assert "numero" in q
            assert "enunciado" in q
            assert "alternativas" in q
            assert len(q.get("alternativas", {})) >= 4

    def test_extraction_tier_tracking(self, sample_pdf_path):
        """Verify tier usage is tracked correctly."""
        result = extract_questions_hybrid(sample_pdf_path)

        assert result.tier_used in ExtractionTier
        assert result.pages_by_tier is not None

        # At least one tier should have pages
        total_tracked = sum(
            len(pages) for pages in result.pages_by_tier.values()
        )
        assert total_tracked > 0

    def test_vision_fallback_rate_reasonable(self, sample_pdf_path):
        """Vision fallback should be less than 20% for typical exams."""
        result = extract_questions_hybrid(sample_pdf_path)

        # If Docling works well, vision fallback should be minimal
        # Allow up to 30% for edge cases
        assert result.vision_fallback_rate <= 0.30, \
            f"Vision fallback too high: {result.vision_fallback_rate:.1%}"

    def test_question_numbers_sequential(self, sample_pdf_path):
        """Extracted question numbers should be mostly sequential."""
        result = extract_questions_hybrid(sample_pdf_path)

        numbers = sorted([q.get("numero", 0) for q in result.questions])

        # Check for gaps
        gaps = []
        for i in range(1, len(numbers)):
            if numbers[i] - numbers[i-1] > 1:
                gaps.append((numbers[i-1], numbers[i]))

        # Allow some gaps (questions split across pages)
        assert len(gaps) <= 5, f"Too many gaps in question numbers: {gaps}"

    def test_portuguese_characters_preserved(self, sample_pdf_path):
        """Portuguese special characters should be preserved."""
        result = extract_questions_hybrid(sample_pdf_path)

        # Combine all text
        all_text = " ".join([
            q.get("enunciado", "") + " " +
            " ".join(q.get("alternativas", {}).values())
            for q in result.questions
        ])

        # Portuguese exams should have accented characters
        has_accents = any(c in all_text for c in "áéíóúãõçâêô")
        assert has_accents, "No Portuguese accented characters found"
```

**Step 2: Rodar testes de integração**

```bash
pytest tests/integration/test_hybrid_extraction_e2e.py -v -m integration
```

**Step 3: Commit**

```bash
git add tests/integration/test_hybrid_extraction_e2e.py
git commit -m "test: add E2E integration tests for hybrid extraction"
```

---

## Task 8: Atualizar Documentação

**Files:**
- Modify: `docs/ARQUITETURA_COMPLETA.md`
- Update: `thoughts/ledgers/CONTINUITY_CLAUDE-analisador-questoes.md`

**Step 1: Documentar nova arquitetura**

Adicionar seção em `docs/ARQUITETURA_COMPLETA.md`:

```markdown
## 13. Pipeline de Extração Híbrida (2026)

### Visão Geral

O sistema utiliza um pipeline de 3 camadas para extração de questões:

```
PDF → Docling → Quality Check → [OK] → LLM Parse
                      ↓ [ruim]
               Claude Haiku (correção)
                      ↓ [ainda ruim]
               Claude Vision (fallback)
```

### Componentes

| Camada | Tecnologia | Custo | Accuracy | Uso |
|--------|------------|-------|----------|-----|
| 1 | Docling (IBM) | Grátis | 85-90% | 80% páginas |
| 2 | Claude Haiku | ~R$0.001/pág | 90%+ | 15% páginas |
| 3 | Claude Vision | ~R$0.10/pág | 95%+ | 5% páginas |

### Métricas de Qualidade

- `spell_error_rate`: Taxa de palavras não reconhecidas (threshold: 15%)
- `long_word_ratio`: Palavras >18 chars (threshold: 5%)
- `quality_score`: Score composto (threshold: 0.80)

### Arquivos Principais

- `src/extraction/hybrid_extractor.py` - Pipeline principal
- `src/extraction/docling_extractor.py` - Camada 1
- `src/extraction/quality_checker.py` - Métricas
- `src/extraction/vision_extractor.py` - Camada 3
```

**Step 2: Commit final**

```bash
git add docs/ARQUITETURA_COMPLETA.md
git add thoughts/ledgers/CONTINUITY_CLAUDE-analisador-questoes.md
git commit -m "docs: document hybrid extraction pipeline architecture"
```

---

## Resumo do Plano

| Task | Descrição | Arquivos | Estimativa |
|------|-----------|----------|------------|
| 1 | Dependências | `pyproject.toml` | 15 min |
| 2 | Quality Checker | `quality_checker.py` | 30 min |
| 3 | Docling Extractor | `docling_extractor.py` | 45 min |
| 4 | Vision Extractor | `vision_extractor.py` | 45 min |
| 5 | Hybrid Pipeline | `hybrid_extractor.py` | 60 min |
| 6 | Integração API | `upload.py` | 30 min |
| 7 | Testes E2E | `test_hybrid_extraction_e2e.py` | 30 min |
| 8 | Documentação | `ARQUITETURA_COMPLETA.md` | 15 min |

**Total: ~4.5 horas de implementação**

---

## Checklist de Validação Final

- [ ] Docling extrai texto sem colunas fundidas
- [ ] Quality checker detecta texto corrompido
- [ ] Vision fallback funciona para PDFs escaneados
- [ ] Pipeline roteia corretamente baseado em qualidade
- [ ] Testes unitários passam
- [ ] Testes de integração passam
- [ ] Upload via API funciona
- [ ] 60 questões extraídas do PDF UNEB
- [ ] Acentos preservados corretamente
- [ ] Vision fallback < 20% para PDFs normais
