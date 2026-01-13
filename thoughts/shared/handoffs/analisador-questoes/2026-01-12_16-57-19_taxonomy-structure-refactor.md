---
date: 2026-01-12T16:57:19-03:00
session_name: analisador-questoes
researcher: Claude
git_commit: 671132eb944fe3219e1e988b3f3780eaeb747097
branch: main
repository: analisador-questoes-concurso
topic: "Taxonomy Structure Refactor - Eliminate Repetition"
tags: [taxonomy, llm-extraction, frontend, refactor]
status: in_progress
last_updated: 2026-01-12
last_updated_by: Claude
type: implementation_strategy
root_span_id:
turn_span_id:
---

# Handoff: Taxonomy Structure Refactor to Eliminate Repetition

## Task(s)

1. **Commit and push LLM migration changes** - COMPLETED
   - Committed changes from previous session (LLM migration to Llama 4 Scout + TaxonomyPreview improvements)
   - Pushed to origin/main (commit 671132e)

2. **Taxonomy structure refactor** - ANALYZED, NOT IMPLEMENTED
   - User identified a problem: the LLM creates artificial hierarchy that causes repetition
   - Analysis completed, new structure proposed and approved by user
   - Implementation NOT started (session interrupted)

## Critical References

- `src/extraction/edital_extractor.py:143-288` - LLM prompt for taxonomy extraction (NEEDS MODIFICATION)
- `frontend/src/components/features/EditalWorkflowModal.tsx` - TaxonomyPreview UI (NEEDS MODIFICATION)

## Recent changes

- `commit 671132e` - feat: migrate LLM to Llama 4 Scout and improve taxonomy UI

## Learnings

1. **The Problem - Forced 4-Level Hierarchy:**
   - Current prompt forces: DISCIPLINA -> ASSUNTO -> TOPICO -> SUBTOPICO
   - Edital structure is FLAT: numbered items (1, 2, 3...) with optional sub-items (4.1, 6.1, 6.2...)
   - LLM invents "assuntos" by normalizing item names, then repeats the original item as a child

   Example of current broken output:
   ```
   Compreensão e Interpretação de Texto (assunto inventado)
     └─ 1. Compreensão e interpretação de texto (REPETIÇÃO!)
   ```

2. **The Solution - Simpler 2-Level Structure:**
   - New structure: DISCIPLINA -> ITENS (with optional subitens)
   - Preserve original numbering from edital
   - Only create parent-child when edital actually has sub-items (e.g., 6 -> 6.1, 6.2, 6.3)

## Post-Mortem

### What Worked
- Analysis of the problem was clear and user approved the proposed structure
- Identifying that the LLM prompt is forcing unnecessary hierarchy

### What Failed
- N/A - implementation not started yet

### Key Decisions
- **Decision**: Change from 4-level to 2-level taxonomy structure
  - Alternatives: Keep 4-level but improve flattening logic in frontend
  - Reason: Simpler structure is more faithful to edital and eliminates repetition at the source

## Artifacts

- `thoughts/shared/handoffs/analisador-questoes/2026-01-12_15-40-13_llm-migration-taxonomy-ui.md` - Previous handoff (LLM migration)

## Action Items & Next Steps

1. **Modify LLM prompt** in `src/extraction/edital_extractor.py:186-258`
   - Change from 4-level hierarchy to 2-level (disciplina -> itens with subitens)
   - New JSON structure:
   ```json
   {
     "disciplinas": [
       {
         "nome": "Língua Portuguesa",
         "itens": [
           {
             "numero": "1",
             "descricao": "Compreensão e interpretação de texto",
             "subitens": []
           },
           {
             "numero": "6",
             "descricao": "Ortografia (Novo Acordo Ortográfico)",
             "subitens": [
               "6.1 Acentuação gráfica",
               "6.2 Sinais de Pontuação",
               "6.3 Relações de coordenação..."
             ]
           }
         ]
       }
     ]
   }
   ```

2. **Update TaxonomyPreview component** in `frontend/src/components/features/EditalWorkflowModal.tsx`
   - Adapt UI to render the new simpler structure
   - Show items with their numbers
   - Expand/collapse only items that have subitens

3. **Test with real edital**
   - Re-upload the edital shown in screenshots
   - Verify no more repetition in taxonomy display

## Other Notes

- Backend running on http://0.0.0.0:8000
- Frontend running on http://localhost:5176
- The user explicitly said "faça isso ser um padrão para qualquer disciplina e implemente" - meaning the new structure should work for ALL disciplines, not just Língua Portuguesa
