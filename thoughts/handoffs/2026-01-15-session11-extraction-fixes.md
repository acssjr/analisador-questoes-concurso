# Handoff: Session 11 - Extraction & Discipline Unification Fixes

**Created**: 2026-01-15T18:00:00Z
**From**: Claude Code Session
**To**: Next Session

---

## Summary

Fixed PDF question extraction issues for UNEB 2024 PDF:
1. Q26 missing due to column continuation issue
2. Discipline duplication (Matemática split, Legislação split)
3. Word spacing issues in extracted text

## Problems Solved

### 1. Q26 Column Continuation Issue

**Symptom**: Question 26 was being skipped during extraction (59/60 questions)

**Root Cause**: Q26 spans across two columns:
- Question text + options (A), (B) at LEFT column BOTTOM (y=635-768)
- Options (C), (D), (E) at RIGHT column TOP (y=41-107)

The algorithm processed columns separately, losing the connection.

**Fix Location**: `src/extraction/llm_parser.py:191-230`

```python
# Detect if right column TOP has content before first "Questão"
# Move continuation spans to end of left column processing
# Combine: left_text + continuation + right_text
```

### 2. Word Spacing Fix

**Symptom**: Words merged together ("ArthurébotafoguenseeBento")

**Root Cause**: Gap threshold of 3 pixels was too high

**Fix Location**: `src/extraction/llm_parser.py:110-120`
- Reduced gap threshold from 3 to 0.5 pixels
- Added punctuation-aware spacing logic

### 3. Discipline Canonicalization

**Symptom**:
- "Matemática" and "Matemática e Raciocínio Lógico" shown as separate
- "Legislação Básica..." (15) and "Administração Pública" (5) shown as separate

**Fix Location**: `src/api/routes/upload.py:147-154`

Added CANONICAL_DISCIPLINAS mappings:
```python
"administracao publica": "Legislação e Administração Pública",
"legislacao": "Legislação e Administração Pública",
"legislacao basica": "Legislação e Administração Pública",
"legislacao basica aplicada a administracao publica": "Legislação e Administração Pública",
```

## Verification Status

| Test | Status | Notes |
|------|--------|-------|
| CLI extraction test | ✅ PASS | 60 questions extracted (including Q26) |
| Frontend upload | ⏳ PENDING | User needs to upload PDF to verify |
| Discipline unification | ⏳ PENDING | Awaiting frontend verification |

## Files Modified

1. `src/extraction/llm_parser.py` - Column continuation detection, word spacing
2. `src/api/routes/upload.py` - Discipline canonicalization mappings
3. `src/extraction/edital_extractor.py` - JSON sanitization for LLM responses
4. `thoughts/ledgers/CONTINUITY_CLAUDE-analisador-questoes.md` - Session log

## Environment State

- **Backend**: http://127.0.0.1:8002 (fresh process, started 17:48:40)
- **Frontend**: http://localhost:5180
- **Database**: Clean (0 projects) - ready for fresh upload
- **Port Note**: Default 8000 had stale processes; using 8002 with `frontend/.env` override

## Next Steps for Incoming Session

1. **User Verification**: Ask user to upload UNEB 2024 PDF via frontend
2. **Expected Results**:
   - 60 questions extracted (not 59)
   - Q26 should appear in "Matemática e Raciocínio Lógico"
   - All math variants unified into ONE discipline
   - All legislation variants unified into ONE discipline
3. **If Issues Persist**:
   - Check backend logs for errors
   - Verify correct backend process is running (port 8002)
   - Run CLI test: `python -c "from src.extraction.llm_parser import extract_questions_from_pdf; ..."`
4. **After Verification**: Commit all Session 11 fixes

## Key Learnings

1. **Column continuation detection**: When processing two-column PDFs, content at the TOP of the right column (before any "Questão" header) is likely a continuation from the left column bottom.

2. **Process management**: Multiple stale uvicorn processes can respond on same port; always kill all and restart fresh when code changes aren't being applied.

3. **Discipline normalization**: Substring matching for discipline canonicalization handles various exam-specific naming conventions.

## Commands for Testing

```bash
# Start fresh backend
cd C:\Users\antonio.santos\Documents\analisador-questoes-concurso
uv run uvicorn src.api.main:app --reload --port 8002

# Start frontend (separate terminal)
cd frontend && npm run dev

# CLI extraction test
python -c "
import fitz
from src.extraction.llm_parser import _extract_text_from_page, _detect_columns, _reconstruct_text_from_blocks
doc = fitz.open('data/raw/provas/PROVA UNEB 2024 TÉCNICO UNIVERSITÁRIO.pdf')
for page_num in range(len(doc)):
    page = doc[page_num]
    text = _extract_text_from_page(page)
    if 'Questão 26' in text or 'QUESTÃO 26' in text:
        print(f'Q26 found on page {page_num + 1}')
"
```

---

**Ledger Location**: `thoughts/ledgers/CONTINUITY_CLAUDE-analisador-questoes.md`
