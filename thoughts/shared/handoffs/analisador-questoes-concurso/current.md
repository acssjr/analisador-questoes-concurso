---
date: 2026-01-14T07:55:00Z
session_name: analisador-questoes-concurso
branch: main
status: completed
outcome: SUCCEEDED
---

# Work Stream: analisador-questoes-concurso

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-01-14T07:55:00Z
**Goal:** Build exam question analyzer with LLM-based extraction, PostgreSQL+pgvector storage, and full upload workflow
**Branch:** main
**Test:** docker exec analisador-questoes-postgres psql -U analisador -d analisador_questoes -c "SELECT COUNT(*) FROM questoes;"

### Now
[->] Continue with Phase 4: Deep analysis pipeline (embeddings, Map-Reduce, CoVe)

### This Session
- [x] ESLint cleanup - fixed 23 errors across 8 files (commit 0eed5c5)
- [x] PostgreSQL + pgvector setup via Docker Compose (pgvector 0.8.1)
- [x] Migrated from SQLite to PostgreSQL for production-ready storage
- [x] Fixed upload endpoint - now persists Prova and Questao records to DB (commit a133a71)
- [x] Tested full upload workflow via API - 50 questions persisted correctly
- [x] Fixed chunked extraction with page overlap (1 page overlap between chunks)
- [x] Added optional `filter_by_edital` parameter to disable discipline filtering
- [x] Implemented auto-repair for incomplete questions (empty alternatives)
- [x] Committed extraction improvements (commit 70712ab)

### Next
- [ ] Phase 4: Deep analysis pipeline (embeddings using pgvector, Map-Reduce, CoVe)
- [ ] TaxonomyTree component - hierarchical tree with expand/collapse
- [ ] QuestionPanel - side panel showing questions for selected topic
- [ ] Test UI upload flow in browser

### Decisions
- postgresql_pgvector: Migrated to PostgreSQL 16 + pgvector 0.8.1 for production-ready vector storage
- async_session_context: Used AsyncSessionLocal() context manager to keep DB session open throughout upload
- page_overlap: Added 1-page overlap between chunks to prevent questions split across pages
- filter_optional: Added `filter_by_edital` parameter (default: true) to allow keeping all questions
- auto_repair: Incomplete questions (empty alternatives) are automatically re-extracted with focused prompts

### Open Questions
- CONFIRMED: PostgreSQL + pgvector working (11 tables created)
- CONFIRMED: Backend connected to PostgreSQL at localhost:5432
- CONFIRMED: Upload persistence works - 50 questions from PDF stored in DB
- CONFIRMED: Page overlap prevents split questions (10 PT questions vs 5 before)
- CONFIRMED: Auto-repair fixes incomplete questions (2/2 repaired successfully)

### Workflow State
pattern: subagent-driven-development
phase: extraction-improvements-complete
total_phases: 4
retries: 0
max_retries: 3

#### Resolved
- goal: "Improve PDF extraction reliability"
- postgresql_setup: COMPLETE (docker-compose.yml, pgvector extension)
- upload_persistence: COMPLETE (Prova + Questao records created)
- extraction_overlap: COMPLETE (1-page overlap between chunks)
- filter_optional: COMPLETE (filter_by_edital parameter)
- auto_repair: COMPLETE (incomplete questions re-extracted)

#### Unknowns
- (none currently)

### Checkpoints
**Agent:** main
**Task:** PDF extraction improvements
**Started:** 2026-01-14T07:30:00Z
**Last Updated:** 2026-01-14T07:55:00Z

#### Phase Status
- Phase 3a-d (Upload UI): ✓ VALIDATED (103 tests, commit c9e4148)
- PostgreSQL Setup: ✓ VALIDATED (pgvector 0.8.1, commit 0eed5c5)
- Upload Persistence: ✓ VALIDATED (Prova+Questao persist, commit a133a71)
- Extraction Improvements: ✓ VALIDATED (overlap + repair, commit 70712ab)
- Phase 3e (TaxonomyTree): ○ PENDING
- Phase 3f (QuestionPanel): ○ PENDING
- Phase 4 (Deep Analysis): ○ PENDING

#### Validation State
```json
{
  "test_count": 103,
  "tests_passing": 103,
  "files_modified": [
    "src/api/routes/upload.py",
    "src/extraction/llm_parser.py"
  ],
  "last_test_command": "docker exec analisador-questoes-postgres psql -U analisador -d analisador_questoes -c 'SELECT COUNT(*) FROM questoes;'",
  "last_test_exit_code": 0
}
```

#### Resume Context
- Current focus: Extraction improvements complete, ready for Phase 4
- Next action: Implement embeddings with pgvector for semantic similarity
- Blockers: (none)

---

## Context

### Architecture
- Frontend: React 19 + React Router 7 + Vite at localhost:5173
- Backend: FastAPI + SQLAlchemy at localhost:8000
- LLM: Groq (Llama 4 Scout) primary, Anthropic fallback
- Queue: State machine (pending → validating → processing → completed/failed)

### Recent Commits
- `70712ab` - feat(extraction): improve PDF question extraction reliability
- `a133a71` - fix(api): persist Prova and Questao records to database on upload
- `0eed5c5` - feat: ESLint cleanup, PostgreSQL+pgvector setup, Phase 3 components

### Extraction Improvements (commit 70712ab)
1. **Page Overlap**: 1-page overlap between chunks prevents questions split across pages
   - Before: pages 1-4, 5-8, 9-12 (no overlap)
   - After: pages 1-4, 4-7, 7-10, 10-13 (with overlap)
   - Result: 10 Portuguese questions extracted (vs 5 before)

2. **Optional Filter**: `filter_by_edital=false` keeps all questions regardless of discipline
   - Before: 5 questions (23 filtered out)
   - After: 50 questions (all kept)

3. **Auto-Repair**: Incomplete questions (empty alternatives) are re-extracted
   - Detects questions with missing/empty alternatives
   - Re-extracts with focused prompt using full PDF text
   - Merges repaired data back into results
   - Result: 2/2 incomplete questions repaired successfully

### Key Files Modified
- `src/extraction/llm_parser.py` - overlap + repair logic
- `src/api/routes/upload.py` - filter_by_edital parameter

### Phase 3 Components (COMPLETE)
1. **UploadDropzone**: Drag & drop area for multiple PDFs
2. **QueueVisualization**: Show processing status for each PDF
3. **QueueSummary**: Stats and bulk actions
4. **ProvasQuestoes Integration**: Full page wiring

### Phase 3e Components (TO BUILD)
1. **TaxonomyTree**: Hierarchical tree with question counts
2. **QuestionPanel**: Side panel for selected topic

### Existing Types (for TaxonomyTree)
```typescript
interface ItemConteudo {
  id: string | null;
  texto: string;
  filhos: ItemConteudo[];
}

interface IncidenciaNode {
  nome: string;
  count: number;
  percentual: number;
  children?: IncidenciaNode[];
  questoes?: Questao[];
}
```
