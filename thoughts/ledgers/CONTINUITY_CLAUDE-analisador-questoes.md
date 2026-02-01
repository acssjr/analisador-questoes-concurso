# Continuity Ledger: Analisador de Questoes de Concurso

**Session**: analisador-questoes
**Created**: 2026-01-09
**Last Updated**: 2026-02-01T12:00:00Z

---

## Goal

Sistema completo de análise de questões de concursos públicos brasileiros com pipeline de 4 fases.

### Success Criteria

1. **Extração de PDFs funciona end-to-end** ✅
2. **Classificação com LLM sem erros de API** ✅
3. **Pipeline de Análise Profunda (4 fases)** ✅
4. **Frontend completo com 3 abas** ✅
5. **Extração híbrida Docling + Vision** ✅ COMPLETE

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
  - [x] **PR #4 Merged**: fix/extraction-column-continuation-discipline-unification
    - 14 code review fixes applied in parallel
    - All 7 CI checks passing (Frontend + Backend)
    - Home.tsx refactored (removed framer-motion, using local Icons)
    - Added prefers-reduced-motion accessibility support
  - [x] **Session 13 Fixes**: ProvasQuestoes tab showing edital taxonomy instead of questions
    - Fixed fetchTaxonomy to always use flat disciplina list from questions
    - Fixed discipline filter (ILIKE with accent support)
    - Cleaned up stale backend processes on port 8000
    - Merged feature branch to main with 11 conflict resolutions
    - Added new layout components (AppLayout, GlobalNavbar, GlobalSidebar)
    - Added new pages (Configuracoes, Perfil, Projetos with full functionality)
  - [x] **Session 14: Docling + Vision Extraction Plan** (2026-01-18)
    - Analyzed two research documents on document extraction tech 2026
    - Decided hybrid 3-layer architecture: Docling → Haiku → Vision
    - Created comprehensive implementation plan (8 tasks)
    - Plan saved: `docs/plans/2026-01-17-docling-vision-extraction.md`
  - [x] **Session 15: Docling + Vision Implementation** (2026-01-18)
    - [x] Task 1: Added dependencies (docling, pdf2image, pyspellchecker)
    - [x] Task 2: Created quality_checker.py module (TDD)
    - [x] Task 3: Created docling_extractor.py module (TDD)
    - [x] Task 4: Created vision_extractor.py module (TDD)
    - [x] Task 5: Created hybrid_extractor.py pipeline (TDD)
    - [x] Task 6: Integrated in upload.py API route (USE_HYBRID_EXTRACTION flag)
    - [x] Task 7: Added E2E integration tests
    - [x] Task 8: Updated documentation (ARQUITETURA_COMPLETA.md §13)
    - All 35 tests passing (unit + E2E)
    - Feature flag enabled by default
  - [x] **Session 16: Taxonomy fixes, frontend accents, CLAUDE.md** (2026-02-01)
    - Fixed taxonomy incidence to query classificacoes table (not legacy assunto_pci)
    - Fixed null texto in edital taxonomy nodes
    - Fixed 19 Portuguese accent strings in frontend
    - Added CLAUDE.md with project guidance and git workflow rule

- Now: [->] PR #5 merge to main

- Next:
  - [ ] Production deployment
  - [ ] Consider normalizing discipline names against edital taxonomy during upload
  - [ ] Consider deprecating Questao.assunto_pci field

### Fixes Applied (Session 8)
- [x] Real upload progress with XMLHttpRequest (Option A)
- [x] Fixed duplicate project creation - now creates project at step 1→2 transition
- [x] Fixed discipline counts showing 0 - `_find_count_case_insensitive` now accumulates
- [x] Fixed extraction truncation - reduced pages_per_chunk from 5 to 3
- [x] Added Redação/Discursiva filter in extraction
- [x] **Extraction verified**: 60 questions extracted from UNEB 2024 PDF ✅
- [x] **ProvasQuestoes UI fix**: Replaced TaxonomyTree with simple discipline list
  - VisaoGeral: Shows edital taxonomy with incidence (unchanged)
  - ProvasQuestoes: Shows simple discipline list from extracted questions (fixed)

---

## Key Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Hybrid extraction (Docling + Vision) | Docling resolves column issues; Vision as 5% fallback (85-90% cost savings vs Vision-only) | 2026-01-18 |
| Three-tier routing | Quality score >=0.80 → Docling; <0.80 → Haiku correction; <0.60 → Vision | 2026-01-18 |
| PyMuPDF deprecated | Extracts in draw order, not reading order; causes column fusion and mojibake | 2026-01-18 |
| Pipeline 4 fases | Vetorização → Map → Reduce → CoVe (baseado em pesquisa) | 2026-01-13 |
| HDBSCAN clustering | Auto-detects number of clusters | 2026-01-14 |
| Multi-Pass voting | 3/5 = high confidence, 2/5 = medium | 2026-01-14 |
| CoVe validation | Self-critique isolado falha (MIT 2024) | 2026-01-14 |
| Sync upload API | Backend processes synchronously, not job-based | 2026-01-14 |
| Discipline canonicalization | Normalize accents then map to canonical form (e.g., "informatica" → "Informática") | 2026-01-14 |
| Two-column PDF detection | Detect column boundary using block x-positions, merge left then right | 2026-01-14 |
| Discipline order by exam | ORDER BY MIN(numero) instead of alphabetical sort | 2026-01-14 |
| Substring discipline matching | "Legislação" matches "LEGISLAÇÃO BÁSICA APLICADA À ADMINISTRAÇÃO PÚBLICA" via substring | 2026-01-15 |
| Legislation discipline unification | "Administração Pública" + "Legislação Básica..." → "Legislação e Administração Pública" | 2026-01-15 |
| Column continuation detection | Right column TOP before first "Questão" is continuation from left column bottom | 2026-01-15 |
| Word spacing threshold | Reduced gap threshold from 3 to 0.5 pixels for proper word separation | 2026-01-15 |
| ProvasQuestoes flat list | Always show flat disciplina list from questions, not edital taxonomy tree | 2026-01-16 |
| ILIKE discipline filter | Use ILIKE for case-insensitive matching with accents (replaces normalized first-word) | 2026-01-16 |
| **PDF Extraction Strategy** | Vision-First (pdf2image + LMM) or Hybrid 3-layer (Docling + LLM correction + Vision fallback) - PyMuPDF abandoned | 2026-01-16 |
| Docling for extraction | Docling (MIT license) has custom `docling-parse` backend that handles column merging correctly | 2026-01-16 |

---

## Open Questions

- **CONFIRMED**: Upload API is synchronous (fixed frontend to match)
- **CONFIRMED**: Discipline canonicalization fixes duplicates (database migration applied)
- **CONFIRMED**: Two-column detection algorithm works (left-then-right merge)
- **CONFIRMED**: UNEB 2024 PDF extracts all 60 questions (verified via CLI test)

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
- `frontend/src/pages/projeto/ProvasQuestoes.tsx` - Simple discipline list + questions
- `frontend/src/pages/projeto/VisaoGeral.tsx` - Edital taxonomy with incidence
- `frontend/src/components/features/ProjetoWorkflowModal.tsx` - Fixed workflow

### Recent Commits

```
bb0a658 Merge branch 'fix/extraction-column-continuation-discipline-unification' into main
e2a35f3 feat(frontend): add global layout components and new pages
7f2b90a docs: update continuity ledger and add session 11 handoff
d82f96e feat(frontend): improve projeto workflow and question display
97342ff fix(extraction): handle column continuation and unify disciplines
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

### 2026-01-16 (Session 14) - PDF Extraction Deep Research

- **Problems Reported**:
  1. Questions 43-55 (Legislação) have text formatting issues
  2. Words concatenated without spaces
  3. Excessive spacing between words in justified text
  4. Text broken into short lines

- **Debug Agent Analysis**:
  - Root cause: PyMuPDF uses inconsistent gap thresholds (0.5 vs 3 pixels)
  - PDFs don't store "text" - they store glyphs with X,Y coordinates
  - No concept of "space" between words in PDF format
  - Justified text creates variable micro-spacing that confuses reconstruction

- **Deep Research Conducted**:
  - Analyzed two research documents (2025 Guide + 2026 Tech Update)
  - Used research agents in parallel to extract insights
  - Synthesized findings into strategic recommendation

- **Key Findings**:
  1. **PyMuPDF is fundamentally broken** for justified text PDFs
  2. **Vision-First is 2026 paradigm** - send images to LMM, immune to encoding issues
  3. **Docling (IBM, MIT license)** has custom backend that handles columns correctly
  4. **Hybrid 3-layer** reduces costs 85-90% vs Vision-only

- **Recommended Approaches**:
  | Approach | Cost/1000 provas | Accuracy |
  |----------|------------------|----------|
  | Hybrid 3-layer | R$200-350 | 93-97% |
  | Vision-First (API) | R$1000-1500 | 95%+ |
  | Vision-First (Self-hosted) | R$100-170 | 95%+ |

- **Artifacts Created**:
  - Debug report: `.claude/cache/agents/debug-agent/latest-output.md`
  - Research synthesis: `.claude/cache/agents/research-agent/latest-output.md`
  - Handoff: `thoughts/shared/handoffs/analisador-questoes/2026-01-16_17-13-40_pdf-extraction-research-fix-questions-display.md`

- **Decision Pending**: User to choose Vision-First (simpler) vs Hybrid (cheaper)

---

### 2026-01-16 (Session 13) - ProvasQuestoes Fix & Git Push

- **Problems Reported**:
  1. ProvasQuestoes tab showing edital taxonomy tree instead of flat discipline list
  2. "Nenhuma questão encontrada" when clicking disciplines
  3. Frontend not being pushed to repository

- **Root Cause Analysis**:
  1. **Taxonomy instead of questions**: `fetchTaxonomy()` was using `getProjetoTaxonomiaIncidencia` when `has_taxonomia=true`, showing edital subtopics
  2. **Filter returning 0**: Discipline filter used `_normalize_for_matching()` which removed accents, but PostgreSQL `lower()` doesn't - "lingua" didn't match "língua"
  3. **Multiple stale processes**: 3 Python processes were listening on port 8000 with old code

- **Fixes Applied**:
  1. **ProvasQuestoes.tsx**: Always use flat disciplina list from questions (removed edital taxonomy branch)
  2. **projetos.py**: Changed filter from `func.lower().like(first_word%)` to `Questao.disciplina.ilike(disciplina%)`
  3. **Cleaned port 8000**: Killed all stale Python processes, restarted fresh backend

- **Git Operations**:
  - Merged `fix/extraction-column-continuation-discipline-unification` → `main`
  - Resolved 11 merge conflicts (preferring main for Python, feature for new pages)
  - Added new frontend files: AppLayout, GlobalNavbar, GlobalSidebar, Configuracoes, Perfil, Projetos
  - Pushed to remote: `bb0a658`

- **Current State**:
  - Backend: http://localhost:8000 (task b5d1825)
  - Frontend: http://localhost:5174 (task bfe9926)
  - API tested: "Língua Portuguesa" returns 20 questions ✅
  - Disciplines displayed: 4 (LP: 20, Mat: 9, Info: 9, Leg: 20) = 58 total

- **Pending**:
  - Verify questions display in browser after clicking discipline
  - Investigate 2 missing questions (58/60)

---

### 2026-01-16 (Session 12) - PR #4 Code Review Fixes & Merge

- **Task**: Fix all failing CI checks and code review comments on PR #4

- **Code Review Fixes Applied (14 in parallel)**:
  1. ProjetoLayout.tsx: Fixed id assertion with fallback
  2. projetos.py: Added ILIKE validation (min 3 chars, block common words)
  3. Home.tsx: Fixed disciplinas count calculation
  4. Home.tsx: Added stats refresh after project changes
  5. VisaoGeral.tsx: Fixed React key issue on TaxonomyTree
  6. ProjetoWorkflowModal.tsx: Fixed cleanup logic (projetoId → createdProjetoId)
  7. ProvasQuestoes.tsx: Fixed useCallback dependency array
  8. ProvasQuestoes.tsx: Fixed pagination to load all questions
  9. ProvasQuestoes.tsx: Fixed fetchQuestoes dependency
  10. routes.tsx: Fixed AppLayout import
  11. Added missing page components (Projetos, Configuracoes, Perfil)
  12. Added XMLHttpRequest mock for upload tests
  13. projetos.py: Added edital None check
  14. Removed unused `import re` from edital_extractor.py

- **CI Fixes**:
  - Home.test.tsx: Updated tests to match new UI structure
  - QueueSummary.test.tsx: Fixed CSS class assertions
  - api.test.ts: Updated to use XHR mock instead of fetch mock
  - Ran `ruff format` on backend code

- **Final Commit**:
  - `daca064`: fix(frontend): update Home component and tests to match new UI
  - All 7 CI checks passing: Backend Lint, Backend Test, Backend Type Check, Frontend Build, Frontend Lint, Frontend Test, Frontend Type Check

- **PR #4 Merged**: All extraction and discipline unification fixes now in main

---

### 2026-01-15 (Session 11) - Extraction & Discipline Unification Fixes

- **Problems Reported**:
  1. 59/60 questions extracted (Q26 missing)
  2. "Matemática" split into 2 disciplines (should be 1)
  3. "Legislação" split into 2 disciplines (should be 1)
  4. JSON parsing error on conteúdo programático upload

- **Root Cause Analysis (Systematic Debugging)**:
  1. **Q26 Missing**: Column continuation issue - Q26 spans left column bottom + right column top
     - Options (C), (D), (E) were at right column TOP (y=41-107)
     - Question text + (A), (B) were at left column BOTTOM (y=635-768)
     - Algorithm processed columns separately, losing context
  2. **Discipline Split**: CANONICAL_DISCIPLINAS didn't unify all variations
  3. **JSON Error**: LLM returned JSON with invalid control characters (newlines inside strings)

- **Fixes Applied**:
  1. **Column Continuation Detection** (`llm_parser.py:196-230`)
     - Detect if right column TOP has content before first "Questão"
     - Move continuation spans to end of left column processing
     - Combine: left_text + continuation + right_text

  2. **Word Spacing Fix** (`llm_parser.py:110-120`)
     - Reduced gap threshold from 3 to 0.5 pixels
     - Added punctuation-aware spacing logic

  3. **Discipline Canonicalization** (`upload.py:148-154`)
     - All math variants → "Matemática e Raciocínio Lógico"
     - All legislation variants → "Legislação e Administração Pública"

  4. **JSON Sanitization** (`edital_extractor.py:18-79`)
     - Added `_sanitize_json_string()` function
     - Escapes control characters inside JSON string values

- **Verification**:
  - CLI test: **60 questions extracted** (including Q26) ✅
  - Disciplines properly unified in test

- **Backend Management Issue**:
  - Multiple stale backend processes were responding on port 8002
  - Old code was being executed instead of updated code
  - Solution: Kill all processes, restart fresh backend

- **Current State**:
  - Backend: http://127.0.0.1:8002 (PID 27480, started 17:48:40)
  - Frontend: http://localhost:5180
  - Database: Clean (0 projects)
  - **PENDING**: User needs to upload PDF to verify fixes in production

---

### 2026-01-15 (Session 10) - Discipline Filter Debugging

- **Problem**: Discipline filter returning 0 questions via API, but direct SQL returned 30

- **Systematic Debugging**:
  1. Verified API code was correct (ILIKE filter)
  2. Tested direct SQL: `SELECT COUNT(*) FROM questoes WHERE disciplina ILIKE '%Língua Portuguesa%'` → 30
  3. Tested API: 0 results
  4. **Root cause**: Multiple stale Python processes on port 8000 with outdated code

- **Process Investigation**:
  - `netstat -ano | findstr :8000` showed multiple PIDs
  - Old uvicorn processes were responding instead of new server
  - `taskkill /F /PID <pid>` failed to fully clear port

- **Solution**:
  - Started fresh backend on port 8002 (`uvicorn src.api.main:app --reload --port 8002`)
  - Created `frontend/.env` with `VITE_API_URL=http://localhost:8002/api`
  - Restarted frontend dev server

- **Verification**:
  ```
  curl "http://127.0.0.1:8002/api/projetos/.../questoes/?limit=3&disciplina=Língua%20Portuguesa"
  → Total: 20, Questões: 3 ✅
  ```

- **Additional Fixes Applied**:
  - [x] VARCHAR truncation: increased column sizes from 200 to 500 (classificacoes, questao)
  - [x] 422 error: reduced frontend limit from 1000 to 500 in ProvasQuestoes.tsx

- **Current State**:
  - Backend: http://127.0.0.1:8002 (PID 28956)
  - Frontend: http://localhost:5179 (PID 9800)
  - Filter working correctly

---

### 2026-01-15 (Session 9) - Extraction Debugging

- **Problem reported**: User uploaded PDF, got only 40 questions (should be 60)
- **UI issue**: "Provas & Questões" tab not showing discipline list or questions

- **Systematic Debugging (Phase 1)**:
  1. Checked database: 40 questions stored with disciplines (LP, Mat, Info, Redação)
  2. Checked API: Returns 40 questions correctly
  3. Ran CLI extraction test: **60 questions extracted successfully**
  4. **Root cause identified**: Server was running OLD CODE before restart

- **Investigation Details**:
  - PDF has 16 pages with questions 1-60
  - Questions 1-40 on pages 3-9, Questions 41-60 on pages 9-12
  - Discipline filter tested: All 6 disciplines match edital correctly
  - "Legislação" and "Administração Pública" → match via substring to "LEGISLAÇÃO BÁSICA APLICADA À ADMINISTRAÇÃO PÚBLICA"

- **Actions Taken**:
  1. Restarted backend server (uvicorn --reload)
  2. Verified extraction: 60 questions with correct discipline breakdown
  3. Frontend build verified: No TypeScript errors

- **Extraction Result After Fix**:
  ```
  Língua Portuguesa: 20
  Legislação Básica aplicada à Administração Pública: 15
  Informática: 10
  Matemática e Raciocínio Lógico: 6
  Administração Pública: 5
  Matemática: 3
  Lógica: 1
  Total: 60 ✓
  ```

- **Status**: Server restarted, extraction verified. User needs to:
  1. Hard refresh browser (Ctrl+Shift+R)
  2. Delete old prova/project
  3. Re-upload PDF

---

### 2026-01-15 (Session 8) - UI Fixes & Extraction Verification

- **Continued from compacted context** - Session had extraction/UI fixes in progress

- **Extraction Verification**:
  - Tested UNEB 2024 PDF via CLI: **60 questions extracted** ✅
  - All 5 alternatives (A-E) present in each question
  - Disciplines: Língua Portuguesa (20), Mat/Raciocínio (5+4+1), Informática (10), Legislação (15+5)
  - No Redação questions (correctly filtered)

- **Database Cleanup**:
  - Deleted 2 duplicate projects from previous bug
  - User recreated project with correct workflow

- **ProvasQuestoes UI Fix**:
  - **Problem**: Tab was showing full edital taxonomy tree (with all subtopics)
  - **Expected**: Simple discipline list from extracted questions
  - **Fix**: Replaced `TaxonomyTree` component with `DisciplinaListItem` list
  - **Result**: Shows flat list of disciplines (from questions) + question panel

- **Tab Distinction**:
  | Tab | Content | Source |
  |-----|---------|--------|
  | Visão Geral | Edital taxonomy tree with incidence | `getProjetoTaxonomiaIncidencia` |
  | Provas & Questões | Simple discipline list + questions | `getProjetoQuestoes` |

- **Status**: Build passes, awaiting user testing of corrected UI

---

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

## Session Auto-Summary (2026-01-15T09:58:55.419Z)
- Build/test: 105 passed, 0 failed
## Session Auto-Summary (2026-01-15T10:31:18.142Z)
- Build/test: 111 passed, 0 failed
## Session Auto-Summary (2026-01-16T00:06:34.170Z)
- Build/test: 132 passed, 0 failed

## Session Auto-Summary (2026-01-18T00:50:00Z)
- Build/test: 35 extraction tests passed (unit + E2E)
- Hybrid extraction pipeline implemented (Tasks 1-8)
- Files created: quality_checker.py, docling_extractor.py, vision_extractor.py, hybrid_extractor.py
- Blocker: Poppler not installed (required for Vision fallback)
## Session Auto-Summary (2026-01-18T15:26:56.080Z)
- Build/test: 158 passed, 0 failed
## Session Auto-Summary (2026-01-18T23:50:35.984Z)
- Build/test: 158 passed, 0 failed
## Session Auto-Summary (2026-01-31T17:06:12.853Z)
- Build/test: 158 passed, 0 failed
## Session Auto-Summary (2026-01-31T18:25:32.273Z)
- Build/test: 158 passed, 0 failed
## Session Auto-Summary (2026-02-01T06:36:45.480Z)
- Build/test: 158 passed, 0 failed