---
date: 2026-01-13T14:16:05-03:00
session_name: analisador-questoes
researcher: Claude
git_commit: a00e110
branch: main
repository: analisador-questoes-concurso
topic: "LLM-based Question Extraction and Editais UI"
tags: [llm, extraction, frontend, editais, groq]
status: complete
last_updated: 2026-01-13
last_updated_by: Claude
type: implementation_strategy
root_span_id:
turn_span_id:
---

# Handoff: LLM Question Extraction + Editais List UI

## Task(s)

1. **LLM-based Question Extraction** - COMPLETED
   - Replaced regex-based PCI parser with LLM-powered extraction
   - Uses Groq Llama 4 Scout for intelligent question identification
   - Processes PDFs in chunks (4 pages per call) to fit 8K token output limit
   - Successfully extracts 60 questions from test PDF

2. **Discipline Normalization Fix** - COMPLETED
   - Added accent removal for discipline matching (Língua = Lingua)
   - Expanded DISCIPLINA_ALIASES for flexible matching
   - Fixed "Tecnologia" → "Informática", "Redação" → "Português" mappings

3. **Editais List UI** - COMPLETED
   - Created EditaisList component to show existing editais on Home page
   - Fixed issue where Home only showed "projetos" but user had "editais"
   - Added listEditais API method

4. **Bug Fix: Multiple Editais Query** - COMPLETED
   - Fixed `scalar_one_or_none()` error when duplicate editais exist
   - Changed to `.scalars().first()` with `.limit(1)`

## Critical References

- `thoughts/ledgers/CONTINUITY_CLAUDE-analisador-questoes.md` - Main continuity ledger
- `src/extraction/llm_parser.py` - New LLM extraction module

## Recent changes

- `src/extraction/llm_parser.py:1-320` - NEW: LLM-based question extraction with chunked processing
- `src/api/routes/upload.py:16-17` - Added LLM parser imports
- `src/api/routes/upload.py:229-239` - Switched to LLM extraction with regex fallback
- `src/api/routes/upload.py:62-72` - Added `remove_accents()` and updated `normalize_disciplina()`
- `src/api/routes/upload.py:26-66` - Expanded DISCIPLINA_ALIASES without accents
- `src/api/routes/editais.py:76-82` - Fixed multiple rows query bug
- `frontend/src/components/features/EditaisList.tsx:1-200` - NEW: Editais list component
- `frontend/src/services/api.ts:101-108` - Added listEditais and getEdital methods
- `frontend/src/pages/Home.tsx:5,201,217-218,257-261,375-384` - Integrated EditaisList

## Learnings

1. **Groq Llama 4 Scout Limits**: max_tokens is 8192, not 16000. Large PDFs must be chunked.

2. **Groq Client Returns "content"**: The Groq client returns `result["content"]`, not `result["text"]`. This caused empty responses initially.

3. **PDF Text Extraction is Messy**: PyMuPDF extracts text with lots of whitespace. LLM handles this better than regex.

4. **Projetos vs Editais**: These are separate entities. Projetos reference editais. User expected to see editais but Home only showed projetos.

5. **Accent Normalization Essential**: Brazilian text has accents (Língua, Português). Matching fails without `unicodedata.normalize('NFKD')`.

## Post-Mortem

### What Worked
- **Chunked LLM Extraction**: Processing 4 pages at a time works perfectly. Each chunk stays under token limits.
- **JSON Parsing with Fallbacks**: `parse_llm_response()` tries direct JSON, then markdown code block, then regex extraction.
- **Alias-based Discipline Matching**: Flexible matching handles LLM variations like "Matemática e Raciocínio Lógico".

### What Failed
- Tried: Full PDF in single LLM call → Failed: Output truncated at 8K tokens
- Tried: `result.get("text")` → Failed: Groq uses "content" key
- Tried: `scalar_one_or_none()` for edital lookup → Failed: Multiple rows error when duplicates exist

### Key Decisions
- Decision: Use chunked extraction (4 pages) instead of single call
  - Alternatives: Compress prompt, use streaming, switch to Claude
  - Reason: 4 pages fits comfortably in 8K output while maintaining context

- Decision: Keep regex parser as fallback
  - Alternatives: Remove regex entirely, use only LLM
  - Reason: Fallback ensures graceful degradation if LLM fails/rate-limited

## Artifacts

- `src/extraction/llm_parser.py` - New LLM extraction module
- `frontend/src/components/features/EditaisList.tsx` - New component
- `thoughts/ledgers/CONTINUITY_CLAUDE-analisador-questoes.md` - Updated ledger

## Action Items & Next Steps

1. **Test Full Frontend Flow**
   - Upload edital → Select cargo → Upload conteúdo → Upload provas
   - Verify questions are extracted and filtered by edital taxonomy

2. **Implement Incidência Analysis**
   - Cross-reference extracted questions with edital taxonomy
   - Generate incidence report showing topic frequency

3. **Add Question View/Details Page**
   - When user clicks an edital, show extracted questions
   - Allow filtering by discipline, viewing individual questions

4. **Commit Changes**
   - All changes are uncommitted
   - Run `/commit` to create commit with reasoning

## Other Notes

### Servers
- Backend: `http://localhost:8000` (FastAPI + uvicorn --reload)
- Frontend: `http://localhost:5174` (Vite dev server)

### Test Commands
```bash
# Test LLM extraction directly
.venv/Scripts/python.exe -c "
from src.extraction.llm_parser import extract_questions_chunked
result = extract_questions_chunked('path/to/pdf.pdf')
print(f'Extracted: {len(result[\"questoes\"])} questions')
"

# Test API
curl -X POST "http://localhost:8000/api/upload/pdf" -F "files=@path/to/pdf.pdf"
```

### Token Usage
- Each PDF page uses ~1.5K tokens input
- 4-page chunk: ~6K input + ~2K output = ~8K total per chunk
- 16-page PDF: ~32K tokens total (4 chunks)
