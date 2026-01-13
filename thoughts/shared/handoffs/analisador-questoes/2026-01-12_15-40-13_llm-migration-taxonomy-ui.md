---
date: 2026-01-12T15:40:13-03:00
session_name: analisador-questoes
researcher: Claude
git_commit: 0e7345f7778d6afc857c7240721b2473c7d15787
branch: main
repository: analisador-questoes-concurso
topic: "LLM Migration & Taxonomy UI Improvements"
tags: [llm, groq, llama-4-scout, taxonomy, frontend, ui]
status: complete
last_updated: 2026-01-12
last_updated_by: Claude
type: implementation_strategy
root_span_id:
turn_span_id:
---

# Handoff: LLM Migration to Llama 4 Scout + Taxonomy UI Fixes

## Task(s)

1. **TaxonomyPreview component expansion** - COMPLETED
   - Fixed component to support 4 levels of hierarchy (disciplina → assunto → tópico → subtópico)
   - Added smart flattening when intermediate levels have no useful names
   - Fixed grammar (singular/plural: "1 item" vs "2 itens")
   - Show real leaf count instead of misleading intermediate counts

2. **LLM Migration from Llama 3.3 70B to Llama 4 Scout** - COMPLETED
   - Migrated from `llama-3.3-70b-versatile` to `meta-llama/llama-4-scout-17b-16e-instruct`
   - Benefits: 5x more daily tokens (500K vs 100K), 5x cheaper ($0.11 vs $0.59 per M input)
   - Rate limits are PER MODEL, not shared - so new model has fresh quota

3. **Research: Groq Model Selection** - COMPLETED
   - Created comprehensive research report comparing GPT-OSS 20B, Llama 4 Scout, Llama 3.3 70B
   - Recommendation: Llama 4 Scout for best balance of intelligence, cost, and Portuguese support

## Critical References

- `docs/ARQUITETURA_COMPLETA.md` - Full system architecture documentation
- `src/core/config.py:74` - LLM model configuration
- `src/extraction/edital_extractor.py` - Extraction logic with prompts

## Recent changes

- `src/core/config.py:74` - Changed `default_text_model` from `llama-3.3-70b-versatile` to `meta-llama/llama-4-scout-17b-16e-instruct`
- `frontend/src/components/features/EditalWorkflowModal.tsx:143-369` - Rewrote TaxonomyPreview component with smart hierarchy handling

## Learnings

1. **Groq rate limits are per-model**: Each model has its own daily token quota. Switching models gives fresh quota immediately.

2. **Llama 4 Scout vs GPT-OSS 20B**:
   - GPT-OSS has strict JSON schema mode but hallucinates more
   - Llama 4 Scout is more intelligent (MMLU 85% vs 69%) and better for Portuguese
   - For extraction tasks where accuracy matters, Llama 4 Scout is better despite lacking strict JSON

3. **Taxonomy hierarchy issues**: LLM sometimes returns nested structure with empty/useless intermediate names. Frontend must handle this gracefully by flattening when appropriate.

4. **Groq free tier limits**:
   - Llama 3.3 70B: 100K TPD
   - Llama 4 Scout: 500K TPD (5x more!)

## Post-Mortem

### What Worked
- **Model migration**: Single config line change made migration trivial
- **Research agent**: Comprehensive analysis of model options with cost projections
- **Smart UI flattening**: `shouldFlatten()` and `isUsefulName()` functions elegantly handle messy LLM output

### What Failed
- **Initial taxonomy UI**: Showed "(1 tópicos)" but had 12 items inside - misleading counts
- **Grammar hardcoded**: Initial code always used plural form

### Key Decisions
- **Decision**: Use Llama 4 Scout instead of GPT-OSS 20B
  - Alternatives: GPT-OSS 20B (strict JSON), Llama 3.3 70B (current)
  - Reason: Better intelligence, less hallucination, 5x more free tokens, native Portuguese support

- **Decision**: Show "itens" count instead of "tópicos/subtópicos"
  - Alternatives: Show hierarchical counts
  - Reason: Leaf count is what users actually care about, avoids confusing nested counts

## Artifacts

- `.claude/cache/agents/research-agent/latest-output.md` - Groq model comparison research
- `frontend/src/components/features/EditalWorkflowModal.tsx:143-369` - Updated TaxonomyPreview
- `src/core/config.py:74` - LLM model config

## Action Items & Next Steps

1. **Test Llama 4 Scout quality**: Verify extraction quality with real Brazilian editais
2. **Consider dual-model strategy**: Use Llama 3.1 8B ($0.05/M) for simple metadata, Scout for taxonomy
3. **Add JSON validation**: Implement retry logic if LLM returns invalid JSON
4. **Commit changes**: Current changes are uncommitted - run `/commit` when ready

## Other Notes

- Backend running on http://0.0.0.0:8000 (task b0031d3)
- Frontend running on http://localhost:5176 (task b4c67f4)
- Groq pricing: Llama 4 Scout = $0.11/M input, $0.34/M output
- Estimated monthly cost for 100 editais: ~$0.68
