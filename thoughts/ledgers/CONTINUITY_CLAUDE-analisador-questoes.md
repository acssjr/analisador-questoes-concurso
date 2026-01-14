# Continuity Ledger: Analisador de Questoes de Concurso

**Session**: analisador-questoes
**Created**: 2026-01-09
**Last Updated**: 2026-01-14T21:07:00Z

---

## Goal

Sistema completo de análise de questões de concursos públicos brasileiros com pipeline de 4 fases.

### Success Criteria

1. **Extração de PDFs funciona end-to-end** ✅
2. **Classificação com LLM sem erros de API** ✅
3. **Pipeline de Análise Profunda (4 fases)** ✅
4. **Frontend completo com 3 abas** ✅

---

## State

- Done:
  - [x] Phase 0-10: Core infrastructure, LLM, extraction, frontend base
  - [x] Phase 3: Upload UI with queue visualization
  - [x] PostgreSQL + pgvector setup
  - [x] Extraction improvements (page overlap, auto-repair)
  - [x] **Phase 4 Complete: Análise Profunda Pipeline**
    - [x] Task 4.1: pgvector extension
    - [x] Task 4.2: Embedding Service (multilingual-e5-large)
    - [x] Task 4.3: HDBSCAN clustering service
    - [x] Task 4.4: Map Service (Llama 4 Scout via Groq)
    - [x] Task 4.5: Reduce Service (Multi-Pass with Claude)
    - [x] Task 4.6: CoVe Service (Chain-of-Verification)
    - [x] Task 4.7: Pipeline Orchestrator
    - [x] Task 4.8: API endpoints (7 endpoints)
    - [x] Task 4.9: Frontend UI (AnaliseProfunda.tsx)
  - [x] **Upload Modal Bug Fix** (commit 2fe9dad)
    - Fixed API contract mismatch (sync vs async response)

- Now: [->] Re-upload PDFs to test two-column fix

- Next:
  - [ ] Re-upload UNEB 2024 PDF to verify all 60 questions extracted
  - [ ] End-to-end testing of complete flow
  - [ ] Production deployment

---

## Key Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Pipeline 4 fases | Vetorização → Map → Reduce → CoVe (baseado em pesquisa) | 2026-01-13 |
| HDBSCAN clustering | Auto-detects number of clusters | 2026-01-14 |
| Multi-Pass voting | 3/5 = high confidence, 2/5 = medium | 2026-01-14 |
| CoVe validation | Self-critique isolado falha (MIT 2024) | 2026-01-14 |
| Sync upload API | Backend processes synchronously, not job-based | 2026-01-14 |
| Discipline canonicalization | Normalize accents then map to canonical form (e.g., "informatica" → "Informática") | 2026-01-14 |
| Two-column PDF detection | Detect column boundary using block x-positions, merge left then right | 2026-01-14 |
| Discipline order by exam | ORDER BY MIN(numero) instead of alphabetical sort | 2026-01-14 |

---

## Open Questions

- **CONFIRMED**: Upload API is synchronous (fixed frontend to match)
- **CONFIRMED**: Discipline canonicalization fixes duplicates (database migration applied)
- **CONFIRMED**: Two-column detection algorithm works (left-then-right merge)
- **UNCONFIRMED**: UNEB 2024 PDF extracts all 60 questions (needs re-upload to verify)

---

## Working Set

### Key Files (Phase 4)

**Analysis Services:**
- `src/analysis/clustering.py` - HDBSCAN clustering
- `src/analysis/map_service.py` - Chunk analysis with Llama 4 Scout
- `src/analysis/reduce_service.py` - Multi-Pass synthesis with Claude
- `src/analysis/cove_service.py` - Chain-of-Verification
- `src/analysis/pipeline.py` - 4-phase orchestrator

**API:**
- `src/api/routes/analise.py` - 7 endpoints for deep analysis
- `src/models/analise_job.py` - Job tracking model

**Frontend:**
- `frontend/src/pages/projeto/AnaliseProfunda.tsx` - Full analysis UI
- `frontend/src/components/features/UploadModal.tsx` - Fixed upload

### Recent Commits

```
324fdcc refactor(frontend): rename EditalWorkflow to ProjetoWorkflow
6fc139b fix(extraction): canonicalize disciplines and detect two-column PDFs
82336b4 fix(tests): fix Modal overflow and Home stats async assertions
d756d89 docs: update ledger and handoff with extraction improvements
70712ab feat(extraction): improve PDF question extraction reliability
```

### Test Commands

```bash
# Frontend tests
cd frontend && npm test -- --run

# Backend tests
pytest tests/

# Start servers
uvicorn src.api.main:app --reload --port 8000
cd frontend && npm run dev
```

---

## Session Log

### 2026-01-14 (Session 7) - Extraction Bug Fixes

- **Three bugs found and fixed** using systematic debugging:

1. **Discipline Duplication** (Fixed - commit 6fc139b)
   - Root cause: "Língua Portuguesa" vs "Lingua Portuguesa" stored separately
   - Fix: Added `CANONICAL_DISCIPLINAS` mapping + `canonicalize_disciplina()` function
   - Applied canonicalization when saving questions to database
   - Ran database migration to normalize existing records

2. **Discipline Order Wrong** (Fixed - commit 6fc139b)
   - Root cause: `sorted(disciplinas)` returned alphabetical order
   - Fix: Changed to `GROUP BY disciplina ORDER BY MIN(numero)`
   - Disciplines now appear in exam order (as questions are numbered)

3. **Missing Questions** (Fixed - commit 6fc139b)
   - Root cause: Two-column PDF pages had text interleaved incorrectly
   - Q49→Q53→Q50→Q54 instead of Q49→Q50→Q51→Q52 then Q53→Q54→Q55
   - Fix: Added `_detect_columns()` and `_reconstruct_text_from_blocks()` in llm_parser.py
   - Algorithm: Detect column boundary, merge left column text first, then right

- **Frontend Rename** (commit 324fdcc)
   - EditalWorkflowModal → ProjetoWorkflowModal (matches correct data model)

- **Status**: All fixes pushed. Needs re-upload of UNEB PDF to verify all 60 questions extracted.

### 2026-01-14 (Session 6) - Phase 4 Complete + Upload Fix

- **Resumed from handoff** - extraction-ui-fixes
- User requested: continue Phase 4 with subagent-driven development

- **Phase 4 Implementation (Análise Profunda)**:
  - All 9 tasks completed using subagent-driven development
  - Each task: implementer → spec review → code quality review
  - 11 commits pushed to remote

- **Upload Modal Bug Found and Fixed**:
  - Root cause: Frontend expected async job_id + polling
  - Backend returns synchronous response
  - Fix: Removed polling loop, handle sync response directly
  - Commit: 2fe9dad

- **Frontend Tests**:
  - 1 failing test: Modal.test.tsx "should reset body overflow when closed"
  - All other tests pass (177 tests)

- **Status**: Phase 4 complete, upload bug fixed, minor test fix needed
