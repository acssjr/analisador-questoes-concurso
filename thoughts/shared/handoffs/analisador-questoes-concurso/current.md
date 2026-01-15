---
date: 2026-01-15T03:08:00Z
session_name: analisador-questoes-concurso
branch: main
status: active
outcome: SUCCEEDED
---

# Work Stream: analisador-questoes-concurso

## Ledger
<!-- This section is extracted by SessionStart hook for quick resume -->
**Updated:** 2026-01-15T03:08:00Z
**Goal:** Build exam question analyzer with LLM-based extraction, PostgreSQL+pgvector storage, taxonomy classification, and full upload workflow
**Branch:** main
**Test:** cd frontend && npm test -- --run && cd .. && pytest tests/ -v

### Now
[->] Commit changes and push to trigger new granular CI workflow

### This Session (2026-01-15 00:00-03:00) - SUCCEEDED
- [x] Debugged PDF extraction - identified missing questions issue
- [x] Added "logica" → "Raciocínio Lógico" canonicalization mapping
- [x] Re-uploaded UNEB PDF - now extracts all 60 questions (was 53)
- [x] Split CI workflow into 7 granular jobs (lint, typecheck, test, build)
- [x] Updated ruleset with 5 required checks (excluding type checks)

### Previous Sessions
- **Session 9**: Document type validation, GitHub Actions CI, Rulesets config
- **Session 8**: Encoding fix, classifier integration, taxonomy tree, classification tags
- **Session 7**: Extraction bug fixes (canonicalization, ordering, two-column PDFs)
- **Session 6**: Phase 4 Análise Profunda complete, upload modal bug fixed
- **Session 5**: Upload persistence, page overlap, auto-repair
- **Session 4**: PostgreSQL + pgvector setup
- **Session 3**: Phase 3 Upload UI components

### Next
- [ ] Commit and push changes (upload.py, ci.yml, ruleset-main.json)
- [ ] Verify new CI jobs appear in GitHub Actions
- [ ] Import updated ruleset in GitHub Settings → Rules → Rulesets
- [ ] Add GROQ_API_KEY and ANTHROPIC_API_KEY to GitHub Secrets
- [ ] Consider post-processing to merge similar disciplines

### Decisions
- granular_ci_jobs: Split Backend CI/Frontend CI into 7 jobs for specific GitHub status checks
- required_checks_5: Backend Lint, Backend Test, Frontend Lint/Test/Build required; type checks optional
- logica_mapping: Map "Lógica" to "Raciocínio Lógico" in canonicalization

### Open Questions
- CONFIRMED: Extraction correctly extracts all 60 questions from UNEB PDF
- CONFIRMED: Canonicalization converts "Lógica" to "Raciocínio Lógico"
- UNCONFIRMED: New CI jobs work on GitHub (needs push)
- KNOWN_ISSUE: LLM extracts inconsistent discipline names within same section

---

## Context

### Architecture
- Frontend: React 19 + React Router 7 + Vite at localhost:5173
- Backend: FastAPI + SQLAlchemy at localhost:8000
- LLM: Groq (Llama 4 Scout) primary, Anthropic fallback
- Database: PostgreSQL 16 + pgvector 0.8.1

### Key Files Modified This Session
- `src/api/routes/upload.py:118` - Added "logica" → "Raciocínio Lógico" mapping
- `.github/workflows/ci.yml` - Split into 7 granular jobs
- `.github/ruleset-main.json` - Updated with 5 required status checks

### CI Jobs (New Structure)
| Job | Required |
|-----|----------|
| Backend Lint | ✓ |
| Backend Type Check | ✗ |
| Backend Test (pytest) | ✓ |
| Frontend Lint (ESLint) | ✓ |
| Frontend Type Check (TypeScript) | ✗ |
| Frontend Test (Vitest) | ✓ |
| Frontend Build | ✓ |

### Session 10 Findings

1. **Extraction Issue Root Cause**
   - Prova uploaded before fixes only had 53 questions
   - Re-upload with current code extracts all 60 questions
   - Chunked extraction with overlap works correctly

2. **Discipline Inconsistency**
   - LLM infers discipline from question content, not section headers
   - Same section can have "Matemática", "Matemática e Raciocínio Lógico", "Lógica"
   - Canonicalization helps but doesn't fully solve (different canonical forms)

3. **CI Granularity**
   - Monolithic jobs (Backend CI, Frontend CI) not useful for required checks
   - Split into 7 jobs allows specific check requirements
   - Type checks run but don't block merge (existing type debt)

### Previous Session (Session 9) Summary
- Document type validation (edital/conteúdo/prova)
- GitHub Actions CI workflow created
- GitHub Rulesets configuration template
