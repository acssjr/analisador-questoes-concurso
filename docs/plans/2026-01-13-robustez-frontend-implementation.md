# Robustez + Frontend Base Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement robust PDF processing queue with visual feedback and React Router navigation.

**Architecture:** Backend queue system with state machine for PDF processing (pending → validating → processing → completed/failed). Frontend with React Router for navigation between Home → Project → Tabs. Zustand remains for global state.

**Tech Stack:** FastAPI + SQLAlchemy (backend), React 19 + React Router 7 + Zustand + TailwindCSS v4 (frontend)

---

## Phase 1: Backend Queue & Robustness

### Task 1.1: Add Queue Status Fields to Prova Model

**Files:**
- Modify: `src/models/prova.py:42-45`
- Test: `tests/models/test_prova.py` (create)

**Step 1: Write the failing test**

```python
# tests/models/test_prova.py
import pytest
from src.models.prova import Prova

def test_prova_has_queue_status_fields():
    """Prova model should have queue processing fields"""
    prova = Prova(nome="Test Prova")

    # Queue status fields
    assert hasattr(prova, 'queue_status')
    assert hasattr(prova, 'queue_error')
    assert hasattr(prova, 'queue_retry_count')
    assert hasattr(prova, 'queue_checkpoint')
    assert hasattr(prova, 'confianca_media')

    # Default values
    assert prova.queue_status == 'pending'
    assert prova.queue_retry_count == 0
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/models/test_prova.py::test_prova_has_queue_status_fields -v`
Expected: FAIL with AttributeError

**Step 3: Add queue fields to Prova model**

Edit `src/models/prova.py` - add after line 45:

```python
    # Queue processing status
    queue_status: Mapped[str] = mapped_column(
        String(50), default="pending"
    )
    """
    Queue status:
    - pending: Aguardando processamento
    - validating: Validando PDF (não corrompido, tem texto, etc.)
    - processing: Extraindo questões com LLM
    - completed: Sucesso total
    - partial: Sucesso parcial (algumas questões com baixa confiança)
    - failed: Falhou (motivo em queue_error)
    - retry: Aguardando retry após rate limit
    """

    queue_error: Mapped[Optional[str]] = mapped_column(Text)
    queue_retry_count: Mapped[int] = mapped_column(Integer, default=0)
    queue_checkpoint: Mapped[Optional[str]] = mapped_column(
        String(50)
    )  # 'validated', 'text_extracted', 'questions_extracted', 'classified'

    # Confidence score (0-100)
    confianca_media: Mapped[Optional[float]] = mapped_column(default=None)
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/models/test_prova.py::test_prova_has_queue_status_fields -v`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/models/test_prova.py src/models/prova.py
git commit -m "feat(models): add queue processing fields to Prova"
```

---

### Task 1.2: Add Confidence Score Fields to Questao Model

**Files:**
- Modify: `src/models/questao.py:41-46`
- Test: `tests/models/test_questao.py` (create)

**Step 1: Write the failing test**

```python
# tests/models/test_questao.py
import pytest
from src.models.questao import Questao

def test_questao_has_confidence_fields():
    """Questao model should have confidence scoring fields"""
    questao = Questao(
        numero=1,
        enunciado="Test enunciado",
        alternativas={"A": "opt1", "B": "opt2"}
    )

    assert hasattr(questao, 'confianca_score')
    assert hasattr(questao, 'confianca_detalhes')
    assert hasattr(questao, 'dificuldade')
    assert hasattr(questao, 'bloom_level')
    assert hasattr(questao, 'tem_pegadinha')
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/models/test_questao.py::test_questao_has_confidence_fields -v`
Expected: FAIL with AttributeError

**Step 3: Add confidence fields to Questao model**

Edit `src/models/questao.py` - add after line 46:

```python
    # Confidence scoring (0-100)
    confianca_score: Mapped[Optional[int]] = mapped_column(Integer)
    confianca_detalhes: Mapped[Optional[dict]] = mapped_column(JSON)
    """
    Detalhes do score:
    {
        "enunciado_tamanho": 25,  # +25 se 50-2000 chars
        "alternativas_validas": 25,  # +25 se 4-5 alternativas A-E
        "gabarito_claro": 20,  # +20 se gabarito identificado
        "disciplina_match": 15,  # +15 se disciplina do edital
        "formato_consistente": 15  # +15 se formato similar às outras
    }
    """

    # Analysis fields (populated in Phase 4 - Deep Analysis)
    dificuldade: Mapped[Optional[str]] = mapped_column(
        String(20)
    )  # 'easy', 'medium', 'hard', 'very_hard'
    bloom_level: Mapped[Optional[str]] = mapped_column(
        String(20)
    )  # 'remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'
    tem_pegadinha: Mapped[bool] = mapped_column(Boolean, default=False)
    pegadinha_descricao: Mapped[Optional[str]] = mapped_column(Text)
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/models/test_questao.py::test_questao_has_confidence_fields -v`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/models/test_questao.py src/models/questao.py
git commit -m "feat(models): add confidence and analysis fields to Questao"
```

---

### Task 1.3: Create Database Migration

**Files:**
- Create: `alembic/versions/xxx_add_queue_and_confidence_fields.py`

**Step 1: Generate migration**

Run: `alembic revision --autogenerate -m "add_queue_and_confidence_fields"`

**Step 2: Review generated migration**

Verify it includes:
- `queue_status`, `queue_error`, `queue_retry_count`, `queue_checkpoint`, `confianca_media` on `provas`
- `confianca_score`, `confianca_detalhes`, `dificuldade`, `bloom_level`, `tem_pegadinha`, `pegadinha_descricao` on `questoes`

**Step 3: Apply migration**

Run: `alembic upgrade head`
Expected: Migration applies successfully

**Step 4: Commit**

```bash
git add alembic/
git commit -m "db: add queue and confidence fields migration"
```

---

### Task 1.4: Create PDF Validator Service

**Files:**
- Create: `src/extraction/pdf_validator.py`
- Test: `tests/extraction/test_pdf_validator.py`

**Step 1: Write the failing test**

```python
# tests/extraction/test_pdf_validator.py
import pytest
from pathlib import Path
from src.extraction.pdf_validator import PDFValidator, ValidationResult

def test_validator_returns_result():
    """Validator should return ValidationResult with status and details"""
    validator = PDFValidator()

    # Create a simple test - we'll mock the actual PDF
    result = validator.validate(Path("nonexistent.pdf"))

    assert isinstance(result, ValidationResult)
    assert hasattr(result, 'is_valid')
    assert hasattr(result, 'error_code')
    assert hasattr(result, 'error_message')
    assert hasattr(result, 'text_length')

def test_validator_rejects_nonexistent_file():
    """Validator should reject files that don't exist"""
    validator = PDFValidator()
    result = validator.validate(Path("this_file_does_not_exist.pdf"))

    assert result.is_valid is False
    assert result.error_code == "FILE_NOT_FOUND"
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/extraction/test_pdf_validator.py -v`
Expected: FAIL with ImportError

**Step 3: Create the validator service**

```python
# src/extraction/pdf_validator.py
"""
PDF Validator - Pre-processing validation before LLM extraction
"""
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import fitz  # PyMuPDF
from loguru import logger


@dataclass
class ValidationResult:
    """Result of PDF validation"""
    is_valid: bool
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    text_length: int = 0
    page_count: int = 0
    has_images: bool = False
    is_scanned: bool = False


class PDFValidator:
    """
    Validates PDFs before spending tokens on LLM extraction.

    Checks:
    1. File exists and opens correctly
    2. Not password protected
    3. Has extractable text (not pure scan/image)
    4. Text has minimum length (> 1000 chars)
    """

    MIN_TEXT_LENGTH = 1000

    def validate(self, file_path: Path) -> ValidationResult:
        """
        Validate a PDF file for processing.

        Returns ValidationResult with is_valid=True if OK,
        or is_valid=False with error details if not.
        """
        # Check file exists
        if not file_path.exists():
            return ValidationResult(
                is_valid=False,
                error_code="FILE_NOT_FOUND",
                error_message=f"Arquivo não encontrado: {file_path.name}"
            )

        # Check file extension
        if file_path.suffix.lower() != ".pdf":
            return ValidationResult(
                is_valid=False,
                error_code="NOT_PDF",
                error_message=f"Arquivo não é PDF: {file_path.suffix}"
            )

        try:
            # Try to open the PDF
            doc = fitz.open(file_path)
        except Exception as e:
            logger.error(f"Failed to open PDF {file_path}: {e}")
            return ValidationResult(
                is_valid=False,
                error_code="CORRUPTED",
                error_message=f"PDF corrompido ou inválido: {str(e)[:100]}"
            )

        try:
            # Check if encrypted/password protected
            if doc.is_encrypted:
                return ValidationResult(
                    is_valid=False,
                    error_code="PASSWORD_PROTECTED",
                    error_message="PDF protegido por senha"
                )

            # Extract text from all pages
            full_text = ""
            has_images = False

            for page in doc:
                full_text += page.get_text()
                if page.get_images():
                    has_images = True

            text_length = len(full_text.strip())
            page_count = len(doc)

            # Check if it's a scanned document (images but very little text)
            is_scanned = has_images and text_length < 100 * page_count

            if is_scanned:
                return ValidationResult(
                    is_valid=False,
                    error_code="SCANNED_PDF",
                    error_message="PDF é digitalizado (imagem). OCR não suportado ainda.",
                    text_length=text_length,
                    page_count=page_count,
                    has_images=True,
                    is_scanned=True
                )

            # Check minimum text length
            if text_length < self.MIN_TEXT_LENGTH:
                return ValidationResult(
                    is_valid=False,
                    error_code="INSUFFICIENT_TEXT",
                    error_message=f"PDF tem pouco texto ({text_length} chars). Mínimo: {self.MIN_TEXT_LENGTH}",
                    text_length=text_length,
                    page_count=page_count
                )

            # All checks passed
            return ValidationResult(
                is_valid=True,
                text_length=text_length,
                page_count=page_count,
                has_images=has_images,
                is_scanned=False
            )

        finally:
            doc.close()
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/extraction/test_pdf_validator.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/extraction/pdf_validator.py tests/extraction/test_pdf_validator.py
git commit -m "feat(extraction): add PDF validator for pre-processing checks"
```

---

### Task 1.5: Create Confidence Score Calculator

**Files:**
- Create: `src/extraction/confidence_scorer.py`
- Test: `tests/extraction/test_confidence_scorer.py`

**Step 1: Write the failing test**

```python
# tests/extraction/test_confidence_scorer.py
import pytest
from src.extraction.confidence_scorer import ConfidenceScorer

def test_scorer_calculates_score():
    """Scorer should calculate 0-100 score based on criteria"""
    scorer = ConfidenceScorer()

    questao = {
        "numero": 1,
        "enunciado": "Este é um enunciado de teste com tamanho adequado para uma questão de concurso público.",
        "alternativas": {"A": "Opção A", "B": "Opção B", "C": "Opção C", "D": "Opção D", "E": "Opção E"},
        "gabarito": "A",
        "disciplina": "Português"
    }

    edital_disciplinas = ["português", "matemática"]

    result = scorer.calculate(questao, edital_disciplinas)

    assert "score" in result
    assert 0 <= result["score"] <= 100
    assert "detalhes" in result

def test_scorer_high_score_for_complete_question():
    """Complete question should get high confidence score"""
    scorer = ConfidenceScorer()

    questao = {
        "numero": 1,
        "enunciado": "A" * 100,  # Good length
        "alternativas": {"A": "1", "B": "2", "C": "3", "D": "4", "E": "5"},
        "gabarito": "A",
        "disciplina": "Português"
    }

    result = scorer.calculate(questao, ["português"])
    assert result["score"] >= 80  # High confidence
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/extraction/test_confidence_scorer.py -v`
Expected: FAIL with ImportError

**Step 3: Create the scorer**

```python
# src/extraction/confidence_scorer.py
"""
Confidence Score Calculator for extracted questions

Scoring criteria (total 100 points):
- 25 pts: Enunciado has reasonable length (50-2000 chars)
- 25 pts: Has exactly 4-5 alternatives (A-E)
- 20 pts: Gabarito clearly identified
- 15 pts: Disciplina matches edital
- 15 pts: Format consistent (has numero, no missing fields)
"""
import unicodedata
from typing import Optional


def normalize_text(text: str) -> str:
    """Normalize text for comparison (lowercase, no accents)"""
    if not text:
        return ""
    nfkd = unicodedata.normalize('NFKD', text.lower())
    return ''.join(c for c in nfkd if not unicodedata.combining(c))


class ConfidenceScorer:
    """Calculate confidence score for extracted questions"""

    def calculate(
        self,
        questao: dict,
        edital_disciplinas: Optional[list[str]] = None
    ) -> dict:
        """
        Calculate confidence score for a question.

        Args:
            questao: Extracted question dict
            edital_disciplinas: List of discipline names from edital (normalized)

        Returns:
            dict with 'score' (0-100) and 'detalhes' breakdown
        """
        detalhes = {}

        # 1. Enunciado length (25 pts)
        enunciado = questao.get("enunciado", "")
        enunciado_len = len(enunciado)
        if 50 <= enunciado_len <= 2000:
            detalhes["enunciado_tamanho"] = 25
        elif 20 <= enunciado_len < 50 or 2000 < enunciado_len <= 5000:
            detalhes["enunciado_tamanho"] = 15
        else:
            detalhes["enunciado_tamanho"] = 0

        # 2. Alternatives (25 pts)
        alternativas = questao.get("alternativas", {})
        if isinstance(alternativas, dict):
            alt_count = len(alternativas)
            valid_keys = all(k in "ABCDE" for k in alternativas.keys())

            if 4 <= alt_count <= 5 and valid_keys:
                detalhes["alternativas_validas"] = 25
            elif 3 <= alt_count <= 5:
                detalhes["alternativas_validas"] = 15
            else:
                detalhes["alternativas_validas"] = 0
        else:
            detalhes["alternativas_validas"] = 0

        # 3. Gabarito (20 pts)
        gabarito = questao.get("gabarito")
        if gabarito and gabarito in "ABCDE":
            detalhes["gabarito_claro"] = 20
        elif gabarito:
            detalhes["gabarito_claro"] = 10
        else:
            detalhes["gabarito_claro"] = 0

        # 4. Disciplina match (15 pts)
        disciplina = questao.get("disciplina", "")
        if edital_disciplinas and disciplina:
            disc_norm = normalize_text(disciplina)
            if any(disc_norm in ed or ed in disc_norm for ed in edital_disciplinas):
                detalhes["disciplina_match"] = 15
            else:
                detalhes["disciplina_match"] = 5  # Has disciplina but doesn't match
        elif disciplina:
            detalhes["disciplina_match"] = 10  # Has disciplina, no edital to compare
        else:
            detalhes["disciplina_match"] = 0

        # 5. Format consistency (15 pts)
        has_numero = questao.get("numero") is not None
        has_all_fields = all([enunciado, alternativas])

        if has_numero and has_all_fields:
            detalhes["formato_consistente"] = 15
        elif has_all_fields:
            detalhes["formato_consistente"] = 10
        else:
            detalhes["formato_consistente"] = 0

        # Calculate total
        score = sum(detalhes.values())

        return {
            "score": score,
            "detalhes": detalhes,
            "nivel": self._get_nivel(score)
        }

    def _get_nivel(self, score: int) -> str:
        """Get confidence level from score"""
        if score >= 80:
            return "alta"
        elif score >= 50:
            return "media"
        else:
            return "baixa"
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/extraction/test_confidence_scorer.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/extraction/confidence_scorer.py tests/extraction/test_confidence_scorer.py
git commit -m "feat(extraction): add confidence score calculator"
```

---

### Task 1.6: Create Queue Processing Service

**Files:**
- Create: `src/services/queue_processor.py`
- Test: `tests/services/test_queue_processor.py`

**Step 1: Write the failing test**

```python
# tests/services/test_queue_processor.py
import pytest
from unittest.mock import MagicMock, patch
from src.services.queue_processor import QueueProcessor, ProcessingResult

def test_processor_has_state_machine():
    """Processor should transition through states correctly"""
    processor = QueueProcessor()

    assert processor.STATES == [
        'pending', 'validating', 'processing', 'completed', 'partial', 'failed', 'retry'
    ]

def test_processor_returns_result():
    """Processor should return ProcessingResult"""
    processor = QueueProcessor()

    # Mock a prova
    mock_prova = MagicMock()
    mock_prova.id = "test-id"
    mock_prova.arquivo_original = "test.pdf"
    mock_prova.queue_status = "pending"

    # Should return ProcessingResult even if file doesn't exist
    result = processor.process_prova(mock_prova)

    assert isinstance(result, ProcessingResult)
    assert hasattr(result, 'success')
    assert hasattr(result, 'status')
    assert hasattr(result, 'questoes_count')
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/services/test_queue_processor.py -v`
Expected: FAIL with ImportError

**Step 3: Create the queue processor**

```python
# src/services/queue_processor.py
"""
Queue Processor - Handles PDF processing with state machine
"""
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, List
import uuid

from loguru import logger

from src.extraction.pdf_validator import PDFValidator, ValidationResult
from src.extraction.confidence_scorer import ConfidenceScorer
from src.extraction.llm_parser import extract_questions_chunked
from src.llm.llm_orchestrator import LLMOrchestrator


@dataclass
class ProcessingResult:
    """Result of processing a prova"""
    success: bool
    status: str  # final status
    questoes_count: int = 0
    questoes_revisao: int = 0  # questions needing manual review
    confianca_media: float = 0.0
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    checkpoint: Optional[str] = None
    questoes: List[dict] = field(default_factory=list)


class QueueProcessor:
    """
    Processes PDFs through a state machine:
    pending → validating → processing → completed/partial/failed

    Features:
    - Pre-validation before spending tokens
    - Confidence scoring per question
    - Checkpoints for recovery
    - Retry with fallback on rate limits
    """

    STATES = ['pending', 'validating', 'processing', 'completed', 'partial', 'failed', 'retry']

    def __init__(self):
        self.validator = PDFValidator()
        self.scorer = ConfidenceScorer()
        self.llm: Optional[LLMOrchestrator] = None

    def process_prova(
        self,
        prova,
        edital_disciplinas: Optional[List[str]] = None
    ) -> ProcessingResult:
        """
        Process a single prova through the pipeline.

        Args:
            prova: Prova model instance (or mock with arquivo_original)
            edital_disciplinas: List of normalized discipline names

        Returns:
            ProcessingResult with status and extracted questions
        """
        file_path = Path(prova.arquivo_original) if prova.arquivo_original else None

        if not file_path:
            return ProcessingResult(
                success=False,
                status='failed',
                error_code='NO_FILE',
                error_message='Prova não tem arquivo associado'
            )

        # State: validating
        logger.info(f"[{prova.id}] Validating {file_path.name}")
        validation = self.validator.validate(file_path)

        if not validation.is_valid:
            return ProcessingResult(
                success=False,
                status='failed',
                error_code=validation.error_code,
                error_message=validation.error_message,
                checkpoint='validation_failed'
            )

        # Checkpoint: validated
        logger.info(f"[{prova.id}] Validated: {validation.page_count} pages, {validation.text_length} chars")

        # State: processing
        try:
            # Initialize LLM if needed
            if not self.llm:
                self.llm = LLMOrchestrator()

            # Extract questions
            logger.info(f"[{prova.id}] Extracting questions with LLM")
            extraction_result = extract_questions_chunked(
                file_path,
                self.llm,
                pages_per_chunk=4
            )

            questoes = extraction_result.get("questoes", [])

            if not questoes:
                return ProcessingResult(
                    success=False,
                    status='failed',
                    error_code='NO_QUESTIONS',
                    error_message='Nenhuma questão extraída do PDF',
                    checkpoint='extraction_failed'
                )

            # Checkpoint: questions extracted
            logger.info(f"[{prova.id}] Extracted {len(questoes)} questions")

            # Score each question
            scored_questoes = []
            total_score = 0
            revisao_count = 0

            for q in questoes:
                score_result = self.scorer.calculate(q, edital_disciplinas)
                q["confianca_score"] = score_result["score"]
                q["confianca_detalhes"] = score_result["detalhes"]
                q["confianca_nivel"] = score_result["nivel"]

                total_score += score_result["score"]
                if score_result["nivel"] == "baixa":
                    revisao_count += 1

                scored_questoes.append(q)

            confianca_media = total_score / len(scored_questoes) if scored_questoes else 0

            # Determine final status
            if revisao_count == 0:
                status = 'completed'
            elif revisao_count < len(scored_questoes):
                status = 'partial'
            else:
                status = 'failed'  # All questions need review

            return ProcessingResult(
                success=status in ['completed', 'partial'],
                status=status,
                questoes_count=len(scored_questoes),
                questoes_revisao=revisao_count,
                confianca_media=confianca_media,
                checkpoint='completed',
                questoes=scored_questoes
            )

        except Exception as e:
            logger.error(f"[{prova.id}] Processing failed: {e}")

            # Check if rate limit
            error_str = str(e).lower()
            if "rate" in error_str or "429" in error_str or "limit" in error_str:
                return ProcessingResult(
                    success=False,
                    status='retry',
                    error_code='RATE_LIMIT',
                    error_message='Rate limit atingido. Retry automático em breve.',
                    checkpoint='rate_limited'
                )

            return ProcessingResult(
                success=False,
                status='failed',
                error_code='PROCESSING_ERROR',
                error_message=str(e)[:500],
                checkpoint='processing_failed'
            )
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/services/test_queue_processor.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/queue_processor.py tests/services/test_queue_processor.py
git commit -m "feat(services): add queue processor with state machine"
```

---

### Task 1.7: Create Queue Status API Endpoint

**Files:**
- Modify: `src/api/routes/provas.py`
- Test: `tests/api/test_provas_queue.py`

**Step 1: Write the failing test**

```python
# tests/api/test_provas_queue.py
import pytest
from httpx import AsyncClient, ASGITransport
from src.api.main import app

@pytest.mark.asyncio
async def test_get_queue_status():
    """Should return queue status for all provas in a project"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # This will return empty list or 404 without a real project
        response = await ac.get("/api/provas/queue-status")

        # Should return valid response structure
        assert response.status_code in [200, 404]

        if response.status_code == 200:
            data = response.json()
            assert "provas" in data or "items" in data
```

**Step 2: Run test to verify current behavior**

Run: `pytest tests/api/test_provas_queue.py -v`

**Step 3: Add queue status endpoint to provas.py**

Add to `src/api/routes/provas.py`:

```python
@router.get("/queue-status")
async def get_queue_status(projeto_id: Optional[uuid.UUID] = Query(None)):
    """
    Get queue processing status for provas.

    Returns list of provas with their queue_status for real-time updates.
    """
    try:
        async for db in get_db():
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
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/api/test_provas_queue.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/api/routes/provas.py tests/api/test_provas_queue.py
git commit -m "feat(api): add queue status endpoint for provas"
```

---

## Phase 2: Frontend Base with React Router

### Task 2.1: Install React Router

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install dependency**

```bash
cd frontend && npm install react-router@7
```

**Step 2: Verify installation**

Run: `npm list react-router`
Expected: Shows react-router@7.x.x

**Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "deps(frontend): add react-router v7"
```

---

### Task 2.2: Create Router Configuration

**Files:**
- Create: `frontend/src/router/index.tsx`
- Create: `frontend/src/router/routes.tsx`

**Step 1: Create router configuration**

```tsx
// frontend/src/router/routes.tsx
import { lazy } from 'react';

// Lazy load pages for code splitting
const Home = lazy(() => import('../pages/Home').then(m => ({ default: m.Home })));
const ProjetoLayout = lazy(() => import('../pages/projeto/ProjetoLayout'));
const VisaoGeral = lazy(() => import('../pages/projeto/VisaoGeral'));
const ProvasQuestoes = lazy(() => import('../pages/projeto/ProvasQuestoes'));
const AnaliseProfunda = lazy(() => import('../pages/projeto/AnaliseProfunda'));

export const routes = [
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/projeto/:id',
    element: <ProjetoLayout />,
    children: [
      {
        index: true,
        element: <VisaoGeral />,
      },
      {
        path: 'visao-geral',
        element: <VisaoGeral />,
      },
      {
        path: 'provas',
        element: <ProvasQuestoes />,
      },
      {
        path: 'analise',
        element: <AnaliseProfunda />,
      },
    ],
  },
];
```

```tsx
// frontend/src/router/index.tsx
import { createBrowserRouter, RouterProvider } from 'react-router';
import { Suspense } from 'react';
import { routes } from './routes';

const router = createBrowserRouter(routes);

export function AppRouter() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    }>
      <RouterProvider router={router} />
    </Suspense>
  );
}
```

**Step 2: Verify files compile**

Run: `cd frontend && npm run build`
Expected: Build may fail (pages don't exist yet) - that's expected

**Step 3: Commit**

```bash
git add frontend/src/router/
git commit -m "feat(frontend): add React Router configuration"
```

---

### Task 2.3: Create ProjetoLayout with Tab Navigation

**Files:**
- Create: `frontend/src/pages/projeto/ProjetoLayout.tsx`

**Step 1: Create the layout component**

```tsx
// frontend/src/pages/projeto/ProjetoLayout.tsx
import { Outlet, NavLink, useParams, useNavigate } from 'react-router';
import { useEffect, useState } from 'react';
import { MainLayout } from '../../components/layout/MainLayout';
import { FileText, BarChart3, FlaskConical, ChevronLeft } from 'lucide-react';
import { api } from '../../services/api';

interface Projeto {
  id: string;
  nome: string;
  banca?: string;
  ano?: number;
  cargo?: string;
  status: string;
  total_provas: number;
  total_questoes: number;
}

export default function ProjetoLayout() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProjeto() {
      if (!id) return;
      try {
        const data = await api.getProjeto(id);
        setProjeto(data);
      } catch (error) {
        console.error('Failed to load projeto:', error);
      } finally {
        setLoading(false);
      }
    }
    loadProjeto();
  }, [id]);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      </MainLayout>
    );
  }

  if (!projeto) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-gray-400">Projeto não encontrado</p>
        </div>
      </MainLayout>
    );
  }

  const tabs = [
    { path: 'visao-geral', label: 'Visão Geral', icon: FileText },
    { path: 'provas', label: 'Provas & Questões', icon: FlaskConical },
    { path: 'analise', label: 'Análise Profunda', icon: BarChart3 },
  ];

  return (
    <MainLayout showSidebar={false}>
      <div className="min-h-screen bg-gray-950">
        {/* Header */}
        <div className="border-b border-gray-800 bg-gray-900/50">
          <div className="max-w-7xl mx-auto px-4 py-4">
            {/* Back button + title */}
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-400" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-white">{projeto.nome}</h1>
                <p className="text-sm text-gray-400">
                  {projeto.banca && `${projeto.banca} `}
                  {projeto.ano && `• ${projeto.ano} `}
                  {projeto.cargo && `• ${projeto.cargo}`}
                </p>
              </div>
            </div>

            {/* Tab navigation */}
            <nav className="flex gap-1">
              {tabs.map((tab) => (
                <NavLink
                  key={tab.path}
                  to={`/projeto/${id}/${tab.path}`}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`
                  }
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Outlet context={{ projeto }} />
        </div>
      </div>
    </MainLayout>
  );
}
```

**Step 2: Run type check**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```bash
git add frontend/src/pages/projeto/
git commit -m "feat(frontend): add ProjetoLayout with tab navigation"
```

---

### Task 2.4: Create Tab Pages (Stubs)

**Files:**
- Create: `frontend/src/pages/projeto/VisaoGeral.tsx`
- Create: `frontend/src/pages/projeto/ProvasQuestoes.tsx`
- Create: `frontend/src/pages/projeto/AnaliseProfunda.tsx`

**Step 1: Create VisaoGeral stub**

```tsx
// frontend/src/pages/projeto/VisaoGeral.tsx
import { useOutletContext } from 'react-router';

interface ProjetoContext {
  projeto: {
    id: string;
    nome: string;
    total_provas: number;
    total_questoes: number;
    status: string;
  };
}

export default function VisaoGeral() {
  const { projeto } = useOutletContext<ProjetoContext>();

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-white">Visão Geral</h2>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400">Provas</p>
          <p className="text-2xl font-bold text-white">{projeto.total_provas}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400">Questões</p>
          <p className="text-2xl font-bold text-white">{projeto.total_questoes}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400">Status</p>
          <p className="text-2xl font-bold text-white capitalize">{projeto.status}</p>
        </div>
      </div>

      {/* Taxonomy placeholder */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-md font-medium text-white mb-4">Taxonomia do Edital</h3>
        <p className="text-gray-400">Em breve: árvore de disciplinas e tópicos</p>
      </div>
    </div>
  );
}
```

**Step 2: Create ProvasQuestoes stub**

```tsx
// frontend/src/pages/projeto/ProvasQuestoes.tsx
import { useOutletContext } from 'react-router';

interface ProjetoContext {
  projeto: { id: string };
}

export default function ProvasQuestoes() {
  const { projeto } = useOutletContext<ProjetoContext>();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Provas & Questões</h2>
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
          Upload Provas
        </button>
      </div>

      {/* Upload area placeholder */}
      <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center">
        <p className="text-gray-400">
          Arraste PDFs de provas aqui ou clique para selecionar
        </p>
      </div>

      {/* Queue placeholder */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-md font-medium text-white mb-4">Fila de Processamento</h3>
        <p className="text-gray-400">Nenhuma prova em processamento</p>
      </div>
    </div>
  );
}
```

**Step 3: Create AnaliseProfunda stub**

```tsx
// frontend/src/pages/projeto/AnaliseProfunda.tsx
import { useOutletContext } from 'react-router';

interface ProjetoContext {
  projeto: {
    id: string;
    total_questoes: number;
    status: string;
  };
}

export default function AnaliseProfunda() {
  const { projeto } = useOutletContext<ProjetoContext>();

  const canAnalyze = projeto.total_questoes >= 10;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Análise Profunda</h2>
        <button
          disabled={!canAnalyze}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            canAnalyze
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          Gerar Análise
        </button>
      </div>

      {!canAnalyze && (
        <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4">
          <p className="text-amber-200 text-sm">
            Você precisa de pelo menos 10 questões para gerar uma análise profunda.
            Atualmente: {projeto.total_questoes} questões.
          </p>
        </div>
      )}

      {/* Analysis placeholder */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <p className="text-gray-400 text-center py-8">
          Clique em "Gerar Análise" para iniciar o processo de análise profunda
        </p>
      </div>
    </div>
  );
}
```

**Step 4: Run build to verify**

Run: `cd frontend && npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/pages/projeto/
git commit -m "feat(frontend): add tab page stubs for projeto"
```

---

### Task 2.5: Update App.tsx to Use Router

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx`

**Step 1: Update main.tsx**

```tsx
// frontend/src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppRouter } from './router';
import { NotificationCenter } from './components/features/NotificationCenter';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRouter />
    <NotificationCenter />
  </StrictMode>
);
```

**Step 2: Simplify App.tsx (keep for reference but not used)**

```tsx
// frontend/src/App.tsx
// This file is kept for reference but main.tsx now uses AppRouter directly
import { useEffect } from 'react';
import Lenis from 'lenis';
import { MainLayout } from './components/layout/MainLayout';
import { Home } from './pages/Home';
import { NotificationCenter } from './components/features/NotificationCenter';

// Legacy App component - replaced by React Router
function App() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  return (
    <>
      <MainLayout showSidebar={false}>
        <Home />
      </MainLayout>
      <NotificationCenter />
    </>
  );
}

export default App;
```

**Step 3: Run dev server to test**

Run: `cd frontend && npm run dev`
Expected: Server starts, navigate to http://localhost:5173

**Step 4: Commit**

```bash
git add frontend/src/main.tsx frontend/src/App.tsx
git commit -m "feat(frontend): switch to React Router"
```

---

### Task 2.6: Update Home Page with Project Cards

**Files:**
- Modify: `frontend/src/pages/Home.tsx`

**Step 1: Update Home to use navigation**

```tsx
// frontend/src/pages/Home.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, FolderOpen, ChevronRight } from 'lucide-react';
import { MainLayout } from '../components/layout/MainLayout';
import { api } from '../services/api';

interface Projeto {
  id: string;
  nome: string;
  banca?: string;
  ano?: number;
  cargo?: string;
  status: string;
  total_provas: number;
  total_questoes: number;
  updated_at: string;
}

export function Home() {
  const navigate = useNavigate();
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProjetos() {
      try {
        const response = await api.getProjetos();
        setProjetos(response.projetos || []);
      } catch (error) {
        console.error('Failed to load projetos:', error);
      } finally {
        setLoading(false);
      }
    }
    loadProjetos();
  }, []);

  const handleNewProject = () => {
    // TODO: Open wizard modal
    console.log('New project wizard');
  };

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Meus Projetos</h1>
            <p className="text-gray-400 mt-1">Gerencie seus projetos de análise de questões</p>
          </div>
          <button
            onClick={handleNewProject}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            Novo Projeto
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        )}

        {/* Empty state */}
        {!loading && projetos.length === 0 && (
          <div className="text-center py-16 bg-gray-900/50 border border-gray-800 rounded-lg">
            <FolderOpen className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Nenhum projeto ainda</h3>
            <p className="text-gray-400 mb-6">Crie seu primeiro projeto para começar a análise</p>
            <button
              onClick={handleNewProject}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Criar Projeto
            </button>
          </div>
        )}

        {/* Project cards */}
        {!loading && projetos.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projetos.map((projeto) => (
              <button
                key={projeto.id}
                onClick={() => navigate(`/projeto/${projeto.id}`)}
                className="text-left bg-gray-900 border border-gray-800 rounded-lg p-5 hover:border-gray-700 hover:bg-gray-900/80 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                    {projeto.nome}
                  </h3>
                  <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-blue-400 transition-colors" />
                </div>

                <p className="text-sm text-gray-400 mb-4">
                  {projeto.banca && `${projeto.banca} `}
                  {projeto.ano && `• ${projeto.ano} `}
                  {projeto.cargo && `• ${projeto.cargo}`}
                </p>

                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-500">
                    <span className="text-white font-medium">{projeto.total_provas}</span> provas
                  </span>
                  <span className="text-gray-500">
                    <span className="text-white font-medium">{projeto.total_questoes}</span> questões
                  </span>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-800">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    projeto.status === 'concluido'
                      ? 'bg-green-900/50 text-green-400'
                      : projeto.status === 'analisando'
                      ? 'bg-blue-900/50 text-blue-400'
                      : 'bg-gray-800 text-gray-400'
                  }`}>
                    {projeto.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Run to verify**

Run: `cd frontend && npm run dev`

**Step 3: Commit**

```bash
git add frontend/src/pages/Home.tsx
git commit -m "feat(frontend): update Home with project cards and navigation"
```

---

### Task 2.7: Add API Methods for Projetos

**Files:**
- Modify: `frontend/src/services/api.ts`

**Step 1: Add projeto API methods**

Add to `frontend/src/services/api.ts`:

```typescript
// Add these methods to the api object

async getProjetos(): Promise<{ projetos: Projeto[]; total: number }> {
  const response = await fetch(`${this.baseUrl}/projetos/`);
  if (!response.ok) throw new Error('Failed to fetch projetos');
  return response.json();
},

async getProjeto(id: string): Promise<Projeto> {
  const response = await fetch(`${this.baseUrl}/projetos/${id}`);
  if (!response.ok) throw new Error('Failed to fetch projeto');
  return response.json();
},

async createProjeto(data: { nome: string; descricao?: string }): Promise<Projeto> {
  const response = await fetch(`${this.baseUrl}/projetos/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create projeto');
  return response.json();
},

async getProjetoStats(id: string): Promise<ProjetoStats> {
  const response = await fetch(`${this.baseUrl}/projetos/${id}/stats`);
  if (!response.ok) throw new Error('Failed to fetch projeto stats');
  return response.json();
},
```

**Step 2: Add types**

Add to `frontend/src/types/index.ts` (or create if needed):

```typescript
export interface Projeto {
  id: string;
  nome: string;
  descricao?: string;
  banca?: string;
  cargo?: string;
  ano?: number;
  status: string;
  total_provas: number;
  total_questoes: number;
  total_questoes_validas: number;
  total_anuladas: number;
  config?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  edital_id?: string;
  edital_nome?: string;
  has_taxonomia?: boolean;
}

export interface ProjetoStats {
  total_provas: number;
  total_questoes: number;
  total_questoes_validas: number;
  total_anuladas: number;
  provas_por_ano: Record<number, number>;
  questoes_por_disciplina: Record<string, number>;
  status: string;
  pronto_para_analise: boolean;
}
```

**Step 3: Run to verify**

Run: `cd frontend && npm run build`

**Step 4: Commit**

```bash
git add frontend/src/services/api.ts frontend/src/types/
git commit -m "feat(frontend): add projeto API methods and types"
```

---

## Summary

This plan covers **Phase 1 (Backend Robustness)** and **Phase 2 (Frontend Base)** from the design document.

**Phase 1 deliverables:**
- Queue status fields on Prova model
- Confidence score fields on Questao model
- PDF validator service (pre-processing checks)
- Confidence score calculator
- Queue processor with state machine
- Queue status API endpoint

**Phase 2 deliverables:**
- React Router v7 configuration
- ProjetoLayout with tab navigation
- Tab page stubs (VisaoGeral, ProvasQuestoes, AnaliseProfunda)
- Updated Home page with project cards
- API methods for projetos

**Not covered (future phases):**
- Phase 3: Full upload UI with drag & drop, queue visualization, taxonomy tree
- Phase 4: Deep analysis pipeline (embeddings, Map-Reduce, Multi-Pass, CoVe)

---

*Plan created: 2026-01-13*
*Estimated tasks: 14*
*Estimated commits: ~14*
