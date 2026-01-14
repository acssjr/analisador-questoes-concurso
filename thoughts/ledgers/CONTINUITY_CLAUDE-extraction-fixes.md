# Session: extraction-fixes
Updated: 2026-01-14T10:40:00Z

## Goal
Fix PDF question extraction to handle cross-page questions and extract all 60 questions from UNEB 2024 PDF. Also improve UI feedback animations during upload.

## Constraints
- Groq Dev tier (pay-as-you-go) - no daily token limits
- Llama 4 Scout max output: 8192 tokens
- Must handle questions that span page boundaries
- Frontend uses Tailwind CSS for animations

## Key Decisions
- overlap_pages: Changed from 1 to 2 pages for better cross-page handling
- pages_per_chunk: Changed from 4 to 5 pages per chunk
- regex_repair_first: Try regex extraction before LLM for incomplete questions (faster/cheaper)
- cross_page_prompt: Added explicit instructions in prompt for questions spanning pages

## State
- Done:
  - [x] Identified root cause: Question 10 split between pages 4-5
  - [x] Updated prompt with cross-page handling instructions
  - [x] Increased overlap from 1 to 2 pages
  - [x] Increased chunk size from 4 to 5 pages
  - [x] Added `_extract_orphan_content_between_questions()` for regex repair
  - [x] Modified `_repair_incomplete_questions()` to try regex first
  - [x] Removed hardcoded `pages_per_chunk=4` from upload.py
  - [x] Backend restarted with new code
  - [x] UI animations improved (agent task completed)
- Now: [->] User testing extraction via frontend
- Next:
  - [ ] Verify 60 questions extracted correctly
  - [ ] Test UI animations working
  - [ ] Commit all changes

## Open Questions
- UNCONFIRMED: Frontend displaying all 60 questions after re-upload?
- UNCONFIRMED: UI animations now visible during upload?

## Working Set
- Branch: `main`
- Key files modified:
  - `src/extraction/llm_parser.py` - cross-page extraction logic
  - `src/api/routes/upload.py` - removed hardcoded params
  - `frontend/src/components/ui/ProgressBar.tsx` - new animated component
  - `frontend/src/components/features/QueueVisualization.tsx` - shimmer effects
  - `frontend/src/components/features/UploadModal.tsx` - pulsing progress
  - `frontend/src/components/features/UploadDropzone.tsx` - spinner during upload
  - `frontend/tailwind.config.js` - new animations
- Test cmd: `uv run python -c "from src.extraction.llm_parser import extract_questions_chunked; ..."`
- Backend: http://localhost:8000 (task bfdf25f)
- Frontend: http://localhost:5173 (task b786570)

## Technical Details

### Extraction Changes
```
Before: pages_per_chunk=4, overlap=1, stride=3
  Chunks: 1-4, 4-7, 7-10, 10-13, 13-16

After: pages_per_chunk=5, overlap=2, stride=3
  Chunks: 1-5, 4-8, 7-11, 10-14, 13-16
```

### Groq Dev Tier Limits
- TPM: 300K (was 6K free)
- RPM: 1K (was 30 free)
- TPD: Unlimited (was 500K free)
- Cost: ~$0.01 per prova extraction

### Test Results (CLI)
- 60 questions extracted successfully
- 2 incomplete questions repaired (Q1 via regex, Q60 via LLM)
- Portuguese questions: 19 + 1 Redação = 20 total
