---
date: 2026-01-14T21:07:00Z
session_name: analisador-questoes-concurso
branch: main
status: completed
outcome: SUCCEEDED
---

# Work Stream: analisador-questoes-concurso

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-01-14T21:07:00Z
**Goal:** Build exam question analyzer with LLM-based extraction, PostgreSQL+pgvector storage, and full upload workflow
**Branch:** main
**Test:** docker exec analisador-questoes-postgres psql -U analisador -d analisador_questoes -c "SELECT COUNT(*) FROM questoes;"

### Now
[->] Re-upload UNEB 2024 PDF to verify all 60 questions extracted

### This Session (2026-01-14 18:00-21:07) - SUCCEEDED
- [x] Fixed discipline duplication (canonicalization at save time)
- [x] Fixed discipline ordering (ORDER BY MIN(numero) instead of sorted())
- [x] Fixed two-column PDF detection (left-then-right merge)
- [x] Renamed EditalWorkflowModal → ProjetoWorkflowModal
- [x] Updated tests for normalized discipline names
- [x] Committed and pushed (6fc139b, 324fdcc)

### Previous Sessions
- **Session 6**: Phase 4 Análise Profunda complete, upload modal bug fixed
- **Session 5**: Upload persistence, page overlap, auto-repair
- **Session 4**: PostgreSQL + pgvector setup
- **Session 3**: Phase 3 Upload UI components

### Next
- [ ] Re-upload UNEB 2024 PDF to verify all 60 questions extracted
- [ ] End-to-end testing of complete flow
- [ ] Production deployment

### Decisions
- discipline_canonicalization: Canonicalize at save time, not display time
- two_column_detection: 40%/45% threshold for column boundary detection
- discipline_ordering: SQL ORDER BY MIN(numero) preserves exam order
- canonical_accents: Keep proper Portuguese accents in canonical names

### Open Questions
- CONFIRMED: Discipline canonicalization works (database migrated)
- CONFIRMED: Two-column detection algorithm works
- UNCONFIRMED: UNEB PDF extracts all 60 questions (needs re-upload)

---

## Context

### Architecture
- Frontend: React 19 + React Router 7 + Vite at localhost:5173
- Backend: FastAPI + SQLAlchemy at localhost:8000
- LLM: Groq (Llama 4 Scout) primary, Anthropic fallback
- Database: PostgreSQL 16 + pgvector 0.8.1

### Recent Commits
- `324fdcc` - refactor(frontend): rename EditalWorkflow to ProjetoWorkflow
- `6fc139b` - fix(extraction): canonicalize disciplines and detect two-column PDFs
- `82336b4` - fix(tests): fix Modal overflow and Home stats async assertions
- `d756d89` - docs: update ledger and handoff with extraction improvements

### Key Files Modified This Session
- `src/api/routes/upload.py` - canonicalize_disciplina(), CANONICAL_DISCIPLINAS
- `src/api/routes/projetos.py` - discipline ordering query
- `src/extraction/llm_parser.py` - _detect_columns(), _reconstruct_text_from_blocks()
- `tests/test_upload_filter.py` - normalized test expectations

### Extraction Bug Fixes Summary

1. **Discipline Duplication**
   - Root cause: Accented vs non-accented stored separately
   - Fix: `canonicalize_disciplina()` maps to canonical form at save time

2. **Discipline Order**
   - Root cause: `sorted()` returned alphabetical
   - Fix: `ORDER BY MIN(numero)` preserves exam order

3. **Missing Questions**
   - Root cause: Two-column PDF text interleaved by y-coordinate
   - Fix: Detect columns, merge left first, then right
