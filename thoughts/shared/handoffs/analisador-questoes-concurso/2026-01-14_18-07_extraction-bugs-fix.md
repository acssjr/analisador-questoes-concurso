---
date: 2026-01-14T21:07:00Z
session_name: analisador-questoes-concurso
researcher: Claude Opus 4.5
git_commit: 324fdcc
branch: main
repository: analisador-questoes-concurso
topic: "Extraction Bugs Fix - Disciplines and Two-Column PDFs"
tags: [bugfix, extraction, pdf, disciplines, systematic-debugging]
status: complete
last_updated: 2026-01-14
last_updated_by: Claude Opus 4.5
type: implementation_strategy
---

# Handoff: Extraction Bug Fixes (Disciplines + Two-Column PDFs)

## Task(s)

| Task | Status |
|------|--------|
| Fix discipline duplication ("Informática" vs "Informatica") | Completed |
| Fix discipline ordering (exam order, not alphabetical) | Completed |
| Fix missing questions from two-column PDF pages | Completed |
| Rename EditalWorkflowModal to ProjetoWorkflowModal | Completed |

## Critical References

- `docs/plans/2026-01-13-analisador-questoes-design.md` - Main design doc
- `thoughts/ledgers/CONTINUITY_CLAUDE-analisador-questoes.md` - Session ledger

## Recent Changes

### Discipline Canonicalization (`src/api/routes/upload.py`)
- Line 30-60: Added `CANONICAL_DISCIPLINAS` mapping dictionary
- Line 62-73: Added `canonicalize_disciplina()` function
- Line 426: Applied canonicalization when saving questions

### Discipline Ordering (`src/api/routes/projetos.py`)
- Lines 401-409: Changed query to `GROUP BY disciplina ORDER BY MIN(numero)`
- Line 441: Removed `sorted()` call, use pre-ordered results

### Two-Column PDF Detection (`src/extraction/llm_parser.py`)
- Lines 115-140: Added `_detect_columns()` function
- Lines 142-170: Added `_spans_to_text()` helper
- Lines 172-210: Added `_reconstruct_text_from_blocks()` function
- Lines 220-230: Modified `_extract_page_text_robust()` to detect columns first

### Frontend Rename
- `frontend/src/components/features/EditalWorkflowModal.tsx` → `ProjetoWorkflowModal.tsx`
- `frontend/src/pages/Home.tsx`: Updated import and usage

### Test Updates (`tests/test_upload_filter.py`)
- Updated all test assertions to expect normalized (no accents) discipline names

## Learnings

### Root Causes Discovered

1. **Discipline Duplication**: Unicode normalization was only used for comparison (`normalize_disciplina()`), but original accented/non-accented strings were saved. Fix: Canonicalize at save time.

2. **Discipline Order**: `sorted(disciplinas)` sorts alphabetically. Fix: Use SQL `ORDER BY MIN(numero)` to preserve exam order.

3. **Missing Questions in Two-Column PDFs**: PyMuPDF's `get_text("blocks", sort=True)` interleaves columns by y-coordinate. Example:
   - Before: Q49→Q53→Q50→Q54 (wrong - interleaved)
   - After: Q49→Q50→Q51→Q52 then Q53→Q54→Q55 (correct - left then right)

### Key Patterns

- `unicodedata.normalize('NFKD')` decomposes accented characters
- `encode('ascii', 'ignore')` removes non-ASCII chars after decomposition
- PyMuPDF column detection: check x-positions of blocks, left < 40% width, right > 45% width

## Post-Mortem

### What Worked
- Systematic debugging (Phase 1-4) found all three root causes efficiently
- Database queries confirmed exact scope of each issue before fixing
- Single commit grouped all three related extraction fixes

### What Failed
- Initial assumption that `normalize_disciplina()` would prevent duplicates - it was only used for comparison, not storage

### Key Decisions
- **Decision**: Canonicalize at save time (upload.py) not at display time
  - Alternatives: Display-time normalization, database trigger
  - Reason: Ensures data integrity, simpler queries, no display logic needed

- **Decision**: Keep canonical names with proper accents ("Língua Portuguesa" not "lingua portuguesa")
  - Alternatives: Store normalized, display mapped
  - Reason: Better UX, proper Portuguese typography

- **Decision**: Two-column detection threshold at 40%/45% of page width
  - Alternatives: 50%/50% split, configurable threshold
  - Reason: Handles variable column widths, 5% gap prevents false positives

## Artifacts

- `src/api/routes/upload.py:30-73` - Canonicalization code
- `src/api/routes/projetos.py:401-441` - Discipline ordering query
- `src/extraction/llm_parser.py:115-230` - Two-column detection
- `tests/test_upload_filter.py` - Updated tests

## Action Items & Next Steps

1. **Re-upload UNEB 2024 PDF** - Verify all 60 questions are now extracted (was 53)
2. **End-to-end testing** - Full upload → analysis flow
3. **Production deployment** - When all tests pass

## Other Notes

### Database Migration Script Used
```sql
UPDATE questoes SET disciplina = 'Língua Portuguesa' WHERE disciplina IN ('Lingua Portuguesa', 'Português');
UPDATE questoes SET disciplina = 'Matemática' WHERE disciplina = 'Matematica';
UPDATE questoes SET disciplina = 'Informática' WHERE disciplina = 'Informatica';
UPDATE questoes SET disciplina = 'Raciocínio Lógico' WHERE disciplina = 'Raciocinio Logico';
```

### Test Commands
```bash
# Frontend tests
cd frontend && npm test -- --run

# Backend tests
pytest tests/ -v

# Quick discipline check
docker exec analisador-questoes-postgres psql -U analisador -d analisador_questoes -c "SELECT disciplina, COUNT(*) FROM questoes GROUP BY disciplina ORDER BY COUNT(*) DESC;"
```
