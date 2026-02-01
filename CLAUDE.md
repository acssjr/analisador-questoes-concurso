# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend
```bash
# Run API server
uvicorn src.api.main:app --reload --port 8000

# Run tests
pytest                              # all tests
pytest tests/extraction/ -k "test_quality"  # single test
pytest -m integration               # integration only
pytest --cov                        # with coverage

# Lint/format
black .
ruff check .
mypy src/
```

### Frontend
```bash
cd frontend
npm run dev          # dev server (http://localhost:5173)
npm run build        # production build
npm run lint         # ESLint
npm run test         # Vitest
```

### Database
```bash
alembic upgrade head                          # apply migrations
alembic revision --autogenerate -m "message"  # create migration
```

## Architecture

Full-stack app for analyzing Brazilian exam questions (concursos públicos). Extracts questions from PDF exams, classifies them against a syllabus taxonomy, and shows topic frequency to guide study.

### Data Flow
```
Upload PDF → Hybrid Extraction → Store Questions → LLM Classification → Incidence Dashboard
```

### Backend (Python/FastAPI)

**Entry point:** `src/api/main.py` → registers 9 routers from `src/api/routes/`

**Extraction pipeline** (`src/extraction/hybrid_extractor.py`):
- Tier 1: Docling (free, native text) + forced OCR (pytesseract) for multi-column PDFs
- Tier 2: Text LLM via Groq (fixes OCR errors in chunks)
- Tier 3: Claude Vision (expensive fallback for low-quality text)
- Quality assessment (`quality_checker.py`) triggers tier fallback at thresholds 0.80/0.60
- Discipline attribution is position-based: detects section headers via regex, maps questions by text position (not LLM)
- Multi-line headers ending with prepositions (à, de, etc.) are auto-merged with continuation line

**Classification** (`src/classification/classifier.py`):
- Sends question enunciado + edital taxonomy to Groq LLM
- Returns hierarchical path: disciplina > assunto > topico > subtopico
- Results stored in `classificacoes` table (separate from `questoes`)

**Key models** (SQLAlchemy 2.0 async):
```
Projeto 1:1 Edital (taxonomia JSON)
Projeto 1:N Prova
Prova 1:N Questao (disciplina, enunciado, alternativas, gabarito)
Questao 1:N Classificacao (assunto, topico, subtopico, confianca)
```

**Status flows:**
- Projeto: `configurando → coletando → pronto_analise → analisando → concluido`
- Prova: `pendente → processando → completo → erro`

### Frontend (React 19 + TypeScript + Vite)

**State:** Zustand (`frontend/src/store/`)
**Routing:** React Router v7
```
/ → Home (project list)
/projeto/:id → ProjetoLayout
  ├─ visao-geral → Overview + taxonomy incidence tree
  ├─ provas → Exam/question browser
  └─ analise → Deep analysis dashboard
```

**API client:** `frontend/src/services/api.ts` (XMLHttpRequest for upload progress)

### Database

PostgreSQL (asyncpg) or SQLite (aiosqlite), controlled by `DATABASE_URL` in `.env`.
Migrations via Alembic. Supports pgvector for embeddings.

## Environment

Required: `GROQ_API_KEY` in `.env`
Optional: `ANTHROPIC_API_KEY` (Vision fallback), `DATABASE_URL` (default: SQLite)

## Important Patterns

- Taxonomy incidence counts come from the `classificacoes` table (not `questoes.assunto_pci` which is legacy/unused)
- The `_find_count_case_insensitive()` in `projetos.py` handles matching between edital taxonomy names (UPPERCASE) and classification names (mixed case) using accent-stripped first-word prefix matching
- Frontend `.env` uses `VITE_API_URL` to point to backend (e.g., `http://localhost:8003/api`)
- All Portuguese text in the frontend should use proper accents (á, ã, ç, etc.)
