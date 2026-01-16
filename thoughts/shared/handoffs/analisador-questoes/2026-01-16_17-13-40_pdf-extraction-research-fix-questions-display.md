---
date: 2026-01-16T17:13:40-03:00
session_name: analisador-questoes
researcher: Claude
git_commit: bb0a658
branch: main
repository: acssjr/analisador-questoes-concurso
topic: "PDF Extraction Research & Question Display Fix"
tags: [pdf-extraction, vision-llm, docling, bug-fix, research]
status: complete
last_updated: 2026-01-16
last_updated_by: Claude
type: implementation_strategy
root_span_id: ""
turn_span_id: ""
---

# Handoff: PDF Extraction Strategy Research & ProvasQuestoes Display Fix

## Task(s)

### Completed
1. **Fixed ProvasQuestoes showing taxonomy instead of questions** - Modified `fetchTaxonomy()` to always use flat discipline list from questions instead of edital taxonomy tree when `has_taxonomia=true`
2. **Fixed discipline filter returning 0 questions** - Changed from `func.lower().like(first_word%)` to `Questao.disciplina.ilike(disciplina%)` for proper Portuguese accent handling
3. **Deep Research on PDF Extraction** - Comprehensive analysis of why PyMuPDF fails and what alternatives exist (Docling, Vision LLM, hybrid approaches)

### Work In Progress
4. **Migration to new extraction pipeline** - Research complete, implementation pending user decision on approach

## Critical References
- `thoughts/ledgers/CONTINUITY_CLAUDE-analisador-questoes.md` - Main continuity ledger with full project history
- `C:\Users\antonio.santos\Downloads\compass_artifact_wf-4ae8e3a0-78fb-4209-a182-4e3bd3785873_text_markdown.md` - 2025 extraction guide (hybrid 3-layer approach)
- `C:\Users\antonio.santos\Downloads\Atualização Tecnológica 2026_ Extração de Documentos.md` - 2026 Vision-First paradigm research

## Recent changes

### Bug Fixes
- `frontend/src/pages/projeto/ProvasQuestoes.tsx:102-168` - Modified `fetchTaxonomy()` to always build flat discipline list from questions via pagination
- `src/api/routes/projetos.py:447-450` - Changed discipline filter to use ILIKE instead of normalized first-word matching
- `frontend/.env:1` - Fixed API URL from port 8002 to 8000

### New Files Added to Git (previous session)
- `frontend/src/components/layout/AppLayout.tsx`
- `frontend/src/components/layout/GlobalNavbar.tsx`
- `frontend/src/components/layout/GlobalSidebar.tsx`
- `frontend/src/pages/Configuracoes.tsx`
- `frontend/src/pages/Perfil.tsx`
- `frontend/src/pages/Projetos.tsx`

## Learnings

### Root Cause of PDF Extraction Issues
**PDFs don't store text** - they store glyphs with X,Y coordinates. The concept of "space" between words doesn't exist in PDF format. PyMuPDF tries to infer spaces based on coordinate gaps, which fails with justified text.

```
PDF internal:         What PyMuPDF does:
glyph "U" x=100      gap=8 → no space
glyph "m" x=108      gap=8 → no space
glyph "a" x=145      gap=37 → SPACE?    ← wrong threshold
```

### Two Inconsistent Thresholds in Current Code
- `src/extraction/llm_parser.py:111` - `_spans_to_text()` uses `gap > 0.5`
- `src/extraction/llm_parser.py:280` - `_reconstruct_text_from_blocks()` uses `gap > 3`

### PostgreSQL Accent Handling
- `func.lower()` in PostgreSQL does NOT remove accents
- "lingua" won't match "língua" with `lower().like()`
- Use `ILIKE` for case-insensitive matching that works with accented Portuguese

### Vision-First is 2026 Paradigm
- Vision LLMs "see" the document layout and are immune to encoding corruption
- Docling (IBM, MIT license) has custom `docling-parse` backend that handles column merging
- Hybrid approach (Docling + LLM correction + Vision fallback) reduces costs 85-90%

## Post-Mortem (Required for Artifact Index)

### What Worked
- **Debug agent for root cause analysis** - Quickly identified the dual threshold issue in llm_parser.py
- **Research agents in parallel** - Reading two research documents simultaneously saved time
- **ILIKE for Portuguese text** - Simple fix that properly handles accents without complex normalization
- **API testing with curl** - Confirmed the fix worked before browser testing

### What Failed
- **Text normalizers** - User confirmed they've tried normalizers before and they cause problems with concatenation and chunks
- **PyMuPDF gap-based reconstruction** - Fundamentally broken for justified text PDFs
- **First-word extraction for discipline filter** - Accent normalization caused mismatches

### Key Decisions
- **Decision: Research PDF extraction alternatives before implementing fix**
  - Alternatives considered: Quick regex normalizer, adjust gap thresholds
  - Reason: User explicitly requested strategic solution, not hacky fix

- **Decision: Recommend Vision-First for robustness, Hybrid for cost**
  - Alternatives considered: Pure Docling, Pure Vision LLM
  - Reason: Vision-First eliminates 100% of concatenation issues; Hybrid saves 85-90% cost

- **Decision: Use ILIKE instead of normalized matching**
  - Alternatives considered: Unaccent extension, Python normalization
  - Reason: Simplest solution that works with existing PostgreSQL setup

## Artifacts

### Research Reports Generated
- `.claude/cache/agents/debug-agent/latest-output.md` - Debug report on text formatting issues
- `.claude/cache/agents/research-agent/latest-output.md` - Analysis of 2026 extraction research

### Key Files Modified
- `frontend/src/pages/projeto/ProvasQuestoes.tsx` - Taxonomy fetch logic
- `src/api/routes/projetos.py` - Discipline filter
- `frontend/.env` - API URL configuration

### Research Documents (User's Downloads)
- `compass_artifact_wf-4ae8e3a0-78fb-4209-a182-4e3bd3785873_text_markdown.md`
- `Atualização Tecnológica 2026_ Extração de Documentos.md`

## Action Items & Next Steps

### Immediate (This Week)
1. **Test Vision-First on problematic pages** - Use the test script provided in synthesis to validate Claude Vision resolves concatenation
   ```bash
   pip install pdf2image anthropic
   ```
2. **Decide on extraction approach** - Vision-First (simpler, robust) vs Hybrid 3-layer (cheaper, complex)

### Short Term (1-2 Weeks)
3. **Install Docling** - `pip install docling` - Replace PyMuPDF for primary extraction
4. **Implement quality metrics** - spell_error_rate, long_word_ratio to detect problematic pages
5. **Add Vision LLM fallback** - For pages with quality score < 0.80

### Medium Term (3+ Weeks)
6. **Consider Qwen2.5-VL self-hosted** - If volume > 5000 provas/month
7. **Reprocess affected questions** - Questions 43-55 need re-extraction with new pipeline

## Other Notes

### Current Server State
- Backend: http://localhost:8000 (task b5d1825 running)
- Frontend: http://localhost:5174 (task bfe9926 running)

### Project UUID for Testing
- Project with taxonomy: `0294535b-4be3-4b3d-98f3-d69150f17cb6`
- API test: `curl "http://localhost:8000/api/projetos/0294535b.../questoes?disciplina=Língua%20Portuguesa"`

### Cost Estimates for New Pipeline
| Approach | Cost/1000 provas | Accuracy |
|----------|------------------|----------|
| Hybrid 3-layer | R$200-350 | 93-97% |
| Vision-First (API) | R$1000-1500 | 95%+ |
| Vision-First (Self-hosted) | R$100-170 | 95%+ |

### Recommended First Test
```python
# test_vision_extraction.py - provided in synthesis
# Tests Claude Vision on a single problematic page
from pdf2image import convert_from_path
import anthropic
# ... see full code in synthesis section
```
