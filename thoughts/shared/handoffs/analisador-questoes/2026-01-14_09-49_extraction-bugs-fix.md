---
date: 2026-01-14T09:49:51-03:00
session_name: analisador-questoes
researcher: Claude
git_commit: d756d89
branch: main
repository: analisador-questoes-concurso
topic: "PDF Extraction Bug Fixes - Alternative E, Infinite Loop, Persistence"
tags: [bug-fix, extraction, pdf-detection, persistence, llm-parser]
status: complete
last_updated: 2026-01-14
last_updated_by: Claude
type: implementation_strategy
root_span_id: ""
turn_span_id: ""
---

# Handoff: PDF Extraction Critical Bug Fixes

## Task(s)

### Completed
- [x] Fixed alternative E not being extracted (was only extracting A-D)
- [x] Fixed infinite loop in `extract_questions_chunked` when last chunk is empty
- [x] Fixed PDF format detection (was incorrectly detecting provas as GABARITO)
- [x] Fixed upload persistence (provas not saved when projeto didn't exist yet)
- [x] Cleaned database and restarted backend with fixes

### In Progress
- [→] User testing the complete upload flow with all fixes applied

## Critical References
- `thoughts/shared/handoffs/analisador-questoes/2026-01-14_08-55_postgresql-validation-fix.md` - Previous handoff with PostgreSQL setup
- `thoughts/shared/handoffs/analisador-questoes-concurso/current.md` - Main continuity ledger

## Recent changes

```
src/extraction/llm_parser.py:223 - Changed non_empty < 4 to < 5 (require all 5 alternatives)
src/extraction/llm_parser.py:273-284 - Added alternative E to repair prompt example
src/extraction/llm_parser.py:403 - Added start_page += stride before continue (fixes infinite loop)
src/extraction/pdf_detector.py:34 - Increased sample pages from 3 to 6
src/extraction/pdf_detector.py:50-56 - Added more flexible question detection patterns
src/api/routes/upload.py:259-273 - Auto-create draft projeto when edital has none
```

## Learnings

### Alternative E Bug Root Cause
1. `_is_incomplete_question()` at `llm_parser.py:223` only required 4 non-empty alternatives (`non_empty < 4`)
2. The repair prompt at `llm_parser.py:284` only showed A-D in the JSON example, not E
3. Questions with 5 keys but empty E value passed validation but displayed broken UI

### Infinite Loop Bug Root Cause
The `extract_questions_chunked` function had a `continue` statement at line 403 that skipped empty chunks, but the `start_page += stride` was AFTER the continue at line 436. When the last page(s) were empty, the loop never terminated.

### PDF Format Detection Issues
1. Detection only analyzed first 3 pages - but exam instructions are on pages 1-2, questions start page 3-4
2. `has_question_content` regex was too strict - only matched `(A)` or `A)` formats, not `A.` or `A -`
3. PDFs with answer indicators like "(Correta: X)" were matching gabarito patterns

### Upload Persistence Issue
When user uploads prova via the wizard (edital → conteúdo → prova → finalizar):
1. Edital is created first (no projeto yet)
2. Prova upload happens with `edital_id` but `projeto` is None
3. Code at `upload.py:316` only persists if `projeto` exists
4. Fix: Auto-create draft projeto when edital has no linked projeto

## Post-Mortem (Required for Artifact Index)

### What Worked
- Log analysis revealed the infinite loop immediately (repeated "Processing pages 16-16/16")
- Database queries confirmed alternative E was missing or empty in stored data
- Reading the PDF raw text revealed question format (helped fix detection)
- Auto-creating draft projeto is a clean solution that doesn't break frontend flow

### What Failed
- Tried: Assuming the detection bug was in the sample size → Partially correct, but regex was also too strict
- Error: ROLLBACK in logs when uploading prova → Fixed by auto-creating projeto
- Error: Questions showing 0 after upload → Was because prova wasn't being persisted

### Key Decisions
- Decision: Require 5 non-empty alternatives instead of 4
  - Alternatives: Accept 4 for exams that don't have 5
  - Reason: Brazilian concursos always have 5 alternatives (A-E), anything less is extraction error

- Decision: Auto-create draft projeto on prova upload
  - Alternatives: Store prova temporarily, persist on "Finalizar"
  - Reason: Simpler backend-only fix, doesn't require frontend changes

- Decision: Increase detection sample to 6 pages
  - Alternatives: Dynamic detection based on page content
  - Reason: Simple fix that covers most exam formats (instructions usually 1-2 pages)

## Artifacts

- `src/extraction/llm_parser.py` - Fixed alternative E extraction and infinite loop
- `src/extraction/pdf_detector.py` - Fixed format detection
- `src/api/routes/upload.py` - Fixed persistence with auto-create projeto

## Action Items & Next Steps

1. **Verify fixes work** - User should test complete upload flow:
   - Upload edital → conteúdo programático → prova → finalizar
   - Check that questions are saved and all 5 alternatives appear

2. **Commit changes** - After verification, commit the bug fixes

3. **Continue Phase 4** - Deep Analysis Pipeline:
   - Generate embeddings with pgvector
   - Map-Reduce for question analysis
   - CoVe (Chain of Verification)

4. **Complete Phase 3e/3f** - UI Components:
   - TaxonomyTree - hierarchical tree with expand/collapse
   - QuestionPanel - side panel for selected topic

## Other Notes

### Backend Status
- Backend running on `localhost:8000` (task ID: b8c7578)
- Frontend running on `localhost:5174` (task ID: b786570)
- PostgreSQL healthy with empty tables (cleaned for testing)

### Test Commands
```bash
# Check question count
docker exec analisador-questoes-postgres psql -U analisador -d analisador_questoes -c "SELECT COUNT(*) FROM questoes;"

# Check questions with alternatives
docker exec analisador-questoes-postgres psql -U analisador -d analisador_questoes -c "SELECT numero, alternativas FROM questoes LIMIT 3;"

# Check projetos
docker exec analisador-questoes-postgres psql -U analisador -d analisador_questoes -c "SELECT id, nome, status FROM projetos;"
```

### Files Changed (uncommitted)
- `src/extraction/llm_parser.py` - 3 edits
- `src/extraction/pdf_detector.py` - 2 edits
- `src/api/routes/upload.py` - 1 edit
