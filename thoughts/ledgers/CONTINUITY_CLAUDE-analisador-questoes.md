# Continuity Ledger: Analisador de Questoes de Concurso

**Session**: analisador-questoes
**Created**: 2026-01-09
**Last Updated**: 2026-01-14

---

## Goal

Fazer a analise de PDFs de concursos funcionar sem erros de API, seguindo a arquitetura ja planejada.

### Success Criteria

1. **Extracao de Edital funciona end-to-end**
   - Carregar PDF do edital
   - Extrair metadados (banca, cargo, ano, disciplinas)
   - Extrair conteudo programatico em taxonomia hierarquica
   - Salvar resultado em JSON estruturado

2. **Extracao de Questoes funciona end-to-end**
   - Processar PDFs do formato PCI Concursos (provas com gabarito inline)
   - Detectar formato do PDF automaticamente
   - Extrair questoes com: enunciado, alternativas, gabarito, disciplina/assunto
   - Lidar com questoes anuladas
   - Suportar batch processing de multiplos PDFs

3. **Classificacao com LLM sem erros de API**
   - LLM Orchestrator funciona com fallback (Groq -> Anthropic)
   - Rate limiting tratado com retry/backoff
   - JSON parsing robusto das respostas
   - Classificacao hierarquica: Disciplina > Assunto > Topico > Subtopico > Conceito

4. **Filtragem por Edital**
   - Questoes podem ser filtradas/agrupadas por assuntos do edital
   - Match entre taxonomia do edital e classificacao das questoes

### Workflow Desejado

```
1. Edital PDF -> extract_edital_metadata() + extract_conteudo_programatico()
                 -> edital.json (taxonomia hierarquica)

2. Provas PDFs -> detect_pdf_format() -> parse_pci_pdf() ou parse_generic_pdf()
                  -> questoes.json (lista de questoes extraidas)

3. Questoes -> QuestionClassifier.classify_batch(questoes, edital_taxonomia)
               -> classificacoes.json (classificacao hierarquica de cada questao)

4. Analise -> filtrar por edital, detectar padroes, gerar relatorio
```

---

## Constraints

### Tech Stack (Frozen)

**Backend:**
- Python 3.11+
- FastAPI + Uvicorn
- SQLAlchemy 2.0 + Alembic (PostgreSQL/SQLite)
- Pydantic v2 for validation

**LLMs:**
- Primary: Groq (Llama 4 Scout 17B) - free, fast, 500K TPD
- Fallback: Anthropic Claude (for vision/complex tasks)
- Config via `.env` file

**PDF Processing:**
- PyMuPDF (fitz) for text extraction
- pdfplumber as fallback
- Tesseract/PaddleOCR for images with text

**CLI:**
- Typer with Rich output
- Commands: extract, classify, analyze, report

### Code Patterns

1. **Error Handling**: Custom exceptions in `src/core/exceptions.py`
2. **Logging**: Loguru with structured logging
3. **Config**: Pydantic Settings from `.env`
4. **LLM Calls**: Always through `LLMOrchestrator` (handles fallback)
5. **JSON Parsing**: Extract from markdown code blocks, validate required fields

### Directory Structure

```
src/
  extraction/       # PDF parsing (pci_parser, edital_extractor, pdf_detector)
  llm/              # LLM clients (groq, anthropic) + orchestrator
  classification/   # QuestionClassifier
  analysis/         # Embeddings, similarity
  report/           # Report generator
  cli/              # Typer commands
  api/              # FastAPI routes
  schemas/          # Pydantic models
  models/           # SQLAlchemy models
  core/             # Config, exceptions, logging
```

---

## Key Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Groq as primary LLM | Free tier, fast, Llama 3.3 70B quality | 2026-01-08 |
| PCI format first | Most common format with inline answers | 2026-01-08 |
| Hierarchical taxonomy | Matches edital structure (5 levels) | 2026-01-08 |
| SQLite for dev | Simpler setup, migrate to PostgreSQL later | 2026-01-08 |
| Llama 4 Scout over GPT-OSS | More intelligent (MMLU 85%), less hallucination, 5x cheaper | 2026-01-12 |
| Rate limits per-model | Each Groq model has own quota - can switch for fresh limits | 2026-01-12 |
| Recursive taxonomy structure | N-level depth instead of fixed 4-level hierarchy | 2026-01-12 |
| Auto-start dev servers | SessionStart hook checks ports and starts if free | 2026-01-13 |
| Pipeline 4 fases para análise | Vetorização → Map → Multi-Pass → CoVe (baseado em pesquisa) | 2026-01-13 |
| Upload em lote com robustez | Fila com estados, checkpoints, retry com backoff | 2026-01-13 |
| React Router + Zustand | Navegação com estado global no frontend | 2026-01-13 |
| Self-Critique via CoVe | Self-critique isolado falha (MIT 2024), usar CoVe | 2026-01-13 |
| PostgreSQL + pgvector | Migrou de SQLite para PostgreSQL com pgvector para embeddings/similarity | 2026-01-14 |
| Page overlap extraction | 1 page overlap between chunks prevents split questions | 2026-01-14 |
| Optional edital filter | filter_by_edital param allows keeping all questions | 2026-01-14 |
| Auto-repair incomplete questions | Re-extract questions with empty alternatives using focused prompts | 2026-01-14 |

---

## State

- Done:
  - [x] Phase 0: Project scaffolding (src structure, CLI, API skeleton)
  - [x] Phase 1: Core infrastructure (config, logging, exceptions)
  - [x] Phase 2: LLM providers (Groq client, Anthropic client, Orchestrator)
  - [x] Phase 3: PDF detection (detect_pdf_format, inferir_banca_cargo_ano)
  - [x] Phase 4: PCI parser basic (parse_pci_pdf, parse_pci_question_block)
  - [x] Phase 5: Edital extractor basic (extract_edital_text, extract_edital_metadata, extract_conteudo_programatico)
  - [x] Phase 6: Classifier basic (QuestionClassifier, classify_question, classify_batch)
  - [x] Phase 7: CLI extract command (pdf, batch)
  - [x] Phase 8: Frontend scaffolding (React 19, Vite, TailwindCSS v4, Zustand)
  - [x] Phase 9: Frontend - Hierarchical types & Incidencia store
    - Added 5-level Classificacao type (Disciplina > Assunto > Topico > Subtopico > Conceito)
    - Added IncidenciaNode type for tree representation
    - Updated Zustand store with incidencia state and actions
  - [x] Phase 9b: Frontend - EditalAnalysis page
    - Created new page with hierarchical tree view
    - Shows overview cards (questoes, validas, anuladas, provas)
    - Interactive tree with expand/collapse
  - [x] Phase 9c: Frontend - Upload flow fix
    - Fixed frontend-backend mismatch on questoes location
    - Backend returns result.results[*].questoes, NOT result.questoes
    - Updated EditalWorkflowModal to flatMap from results array
  - [x] Phase 10: Taxonomy Structure Refactor (commit e987816)
    - Replaced fixed 4-level hierarchy with recursive ItemConteudo structure
    - Support 1 to N levels of depth based on actual edital content
    - LLM prompt instructs to preserve structure, not invent intermediate levels
    - TaxonomyPreview renders any depth with RecursiveItemRenderer
  - [x] Phase 10b: Frontend UI Redesign (commit 75f9212)
    - Complete UI redesign with "Scholarly Warmth" aesthetic
    - Improved scrolling, contrast, and interactivity (commit 89251c6)
  - [x] Phase 10c: Frontend Tests (commit f330884)
    - Added vitest infrastructure and component tests

- Done (Phase 3 - Upload UI):
  - [x] Phase 3a: UploadDropzone component (commit c324193)
  - [x] Phase 3b: QueueVisualization component (commit 40eb26c)
  - [x] Phase 3c: Full Upload UI with queue (commit c9e4148)
  - [x] Phase 3d: TaxonomyTree component for disciplina navigation
  - [x] Phase 3e: QuestionPanel component with expandable cards
  - [x] Phase 3f: ProvasQuestoes page integration (two-column layout)
  - [x] Phase 3g: API getProjetoQuestoes endpoint + frontend method
  - [x] Phase 3h: Test fixes (ProvasQuestoes mock, Home MemoryRouter)

- Done (ESLint Cleanup - commit 0eed5c5):
  - [x] TreemapChart.tsx - fixed any types with CustomContentProps interface
  - [x] EditaisList.tsx - fixed any types with TaxonomiaItem/Taxonomia interfaces
  - [x] UploadModal.tsx - unused err vars (changed to catch without binding)
  - [x] Modal.test.tsx - any types replaced with React.HTMLAttributes
  - [x] Dashboard.test.tsx - 9 any types replaced with proper React types
  - [x] api.ts - any types replaced with Edital, Questao types
  - [x] mocks.ts - removed unused Questao import
  - [x] calculations.ts - added void _nivel for unused param

- Done (PostgreSQL + pgvector Setup):
  - [x] Created docker-compose.yml with PostgreSQL 16 + pgvector
  - [x] Updated .env for PostgreSQL connection
  - [x] Created Alembic migration for pgvector extension
  - [x] Installed psycopg2-binary for Alembic migrations
  - [x] Created all tables in PostgreSQL
  - [x] Verified pgvector 0.8.1 extension enabled

- Done (Extraction Improvements - commit 70712ab):
  - [x] Added page overlap (1 page) between chunks to prevent split questions
  - [x] Added optional `filter_by_edital` parameter to upload endpoint
  - [x] Implemented auto-repair for incomplete questions (empty alternatives)
  - [x] Tested: 50 questions extracted (vs 5 before), 2/2 incomplete repaired

- Now: [->] Phase 4: Deep analysis pipeline
  - [ ] Implement embedding generation using pgvector
  - [ ] Add similarity search for questions

- Next:
  - [ ] TaxonomyTree component with expand/collapse
  - [ ] QuestionPanel for selected topic
  - [ ] Phase 16: Backend - Vetorização com embeddings
  - [ ] Phase 17: Backend - Map-Reduce com chunks
  - [ ] Phase 18: Backend - Multi-Pass + CoVe

- Later:
  - [ ] Phase 16: Backend - Vetorização com embeddings
  - [ ] Phase 17: Backend - Map-Reduce com chunks
  - [ ] Phase 18: Backend - Multi-Pass + CoVe
  - [ ] Phase 19: Frontend - Aba Análise Profunda

---

## Open Questions

- **UNCONFIRMED**: Qual o limite de rate do Groq API no free tier? (possivelmente 30 req/min)
- **UNCONFIRMED**: PDFs do PCI Concursos sempre seguem o mesmo formato `15. [Portugues - Sintaxe]`?
- **UNCONFIRMED**: Como tratar questoes com imagens/figuras no enunciado?
- **UNCONFIRMED**: Precisa de OCR para PDFs de editais ou texto e sempre extraivel?

---

## Working Set

### Key Files

**Extraction:**
- `src/extraction/pdf_detector.py` - Detecta formato do PDF
- `src/extraction/pci_parser.py` - Parse de provas PCI Concursos
- `src/extraction/edital_extractor.py` - Extracao de editais

**LLM:**
- `src/llm/llm_orchestrator.py` - Orquestra providers com fallback
- `src/llm/providers/groq_client.py` - Cliente Groq
- `src/llm/providers/anthropic_client.py` - Cliente Anthropic

**Classification:**
- `src/classification/classifier.py` - Classificador de questoes
- `src/llm/prompts/classificacao.py` - Prompts de classificacao

**CLI:**
- `src/cli/main.py` - Entry point
- `src/cli/commands/extract.py` - Comando extract

**Config:**
- `src/core/config.py` - Settings
- `src/core/exceptions.py` - Custom exceptions
- `.env` - API keys (GROQ_API_KEY, ANTHROPIC_API_KEY)

### Test Commands

```bash
# Ativar ambiente virtual
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Linux/Mac

# Testar extracao de PDF
python -m src.cli.main extract pdf data/raw/provas/exemplo.pdf

# Testar batch extraction
python -m src.cli.main extract batch data/raw/provas/

# Testar LLM isoladamente
python -c "from src.llm.llm_orchestrator import LLMOrchestrator; llm = LLMOrchestrator(); print(llm.generate('Ola'))"

# Iniciar API
uvicorn src.api.main:app --reload
```

### Sample PDFs Needed

- `data/raw/editais/` - PDFs de editais para teste
- `data/raw/provas/` - PDFs de provas PCI Concursos para teste

---

## Session Log

### 2026-01-09

- Sessao iniciada
- Analisado estrutura completa do projeto
- Identificado que codigo base ja existe para:
  - Extracao de PDFs (PCI parser, edital extractor)
  - LLM integration (Groq, Anthropic, Orchestrator)
  - Classificacao (QuestionClassifier)
  - CLI (extract command)
- Criado ledger de continuidade
- Proximo passo: debugar erros de API na integracao LLM

### 2026-01-12

- Started both servers (frontend:5174, backend:8000)
- Fixed missing aiosqlite module (`uv pip install aiosqlite`)
- User clarified project's TRUE purpose: **analise de INCIDENCIA de assuntos** not just extraction
- Implemented 5-level hierarchical classification types (Disciplina > Assunto > Topico > Subtopico > Conceito)
- Created new EditalAnalysis page with tree view for incidencia display
- Updated Zustand store with incidencia state and actions
- Removed mock data from App.tsx
- Fixed critical frontend-backend mismatch:
  - Backend returns `result.results[*].questoes`
  - Frontend was expecting `result.questoes` at top level
  - Fixed by flattening: `result.results.flatMap(r => r.questoes)`
- Issue persists: Backend returns success (3 provas analisadas) but 0 questoes extracted
  - Root cause: PDF parser not recognizing format of uploaded PDFs
  - Needs debugging in `src/extraction/pci_parser.py`
- Created handoff: `thoughts/shared/handoffs/analisador-questoes/2026-01-12_10-12-07_frontend-upload-flow-fix.md`

### 2026-01-12 (Session 2)

- **LLM Migration**: Migrated from Llama 3.3 70B to Llama 4 Scout
  - Changed `src/core/config.py:74` model ID to `meta-llama/llama-4-scout-17b-16e-instruct`
  - Benefits: 5x more daily tokens (500K vs 100K), 5x cheaper ($0.11 vs $0.59/M input)
  - Rate limits are PER MODEL - switching gives fresh quota immediately
- **Groq Model Research**: Created comprehensive comparison of GPT-OSS 20B, Llama 4 Scout, Llama 3.3 70B
  - Research at: `.claude/cache/agents/research-agent/latest-output.md`
  - Recommendation: Llama 4 Scout for best intelligence + cost + Portuguese support
  - GPT-OSS has strict JSON but hallucinates more
- **TaxonomyPreview UI Rewrite**: `frontend/src/components/features/EditalWorkflowModal.tsx:143-369`
  - Fixed grammar (singular/plural: "1 item" vs "2 itens")
  - Show real leaf count instead of misleading intermediate counts
  - Smart hierarchy flattening when intermediate levels have no useful names
  - Functions: `isUsefulName()`, `shouldFlatten()`, `countLeafItems()`, `getLeafItems()`
- Created handoff: `thoughts/shared/handoffs/analisador-questoes/2026-01-12_15-40-13_llm-migration-taxonomy-ui.md`

### 2026-01-12 (Session 3)

- **Committed and pushed** LLM migration changes (commit 671132e)
  - feat: migrate LLM to Llama 4 Scout and improve taxonomy UI
  - 13 files changed, +2093 -474 lines
- **Identified taxonomy repetition problem**:
  - User showed screenshots: LLM creates "Compreensão e Interpretação de Texto" assunto, then repeats "1. Compreensão e interpretação de texto" as child
  - Root cause: LLM prompt forces 4-level hierarchy when edital structure is flat
- **Proposed solution**: Simpler 2-level structure
  - disciplina -> itens (with numero, descricao, subitens[])
  - Only create hierarchy when edital actually has sub-items (e.g., 6 -> 6.1, 6.2)
  - User approved the proposal
- **Implementation NOT started** - session ended before coding
- Created handoff: `thoughts/shared/handoffs/analisador-questoes/2026-01-12_16-57-19_taxonomy-structure-refactor.md`

### 2026-01-13

- Resumed from handoff, discovered Phase 10 was already implemented (commit e987816)
- Added SessionStart hook for auto-starting dev servers
  - `.claude/hooks/dev-servers.sh` - checks ports before starting
  - Registered in `.claude/settings.json`
- Updated ledger to reflect completed work (Phases 10, 10b, 10c)
- Current focus: Phase 11 - Backend PDF parser debugging

### 2026-01-13 (Session 2)

- **UI de Projetos** (commit 82a4b15)
  - Criado ProjectsList component
  - Home page mostra projetos existentes
  - Ao finalizar workflow, projeto é criado automaticamente

- **Parser PCI Corrigido** (commit a00e110)
  - Problema: Parser esperava `15. [Português - Sintaxe]` mas PDFs usam `Questão 03 (Correta: C)`
  - Solução: Auto-detecção de formato (legacy PCI vs IDCAP)
  - Testado: 60 questões extraídas com sucesso do PDF real

- **Modal UI Melhorias** (commit a00e110)
  - Progress bar com animação verde
  - Seletor de cargo estilizado
  - Scroll do modal corrigido
  - Taxonomia com estilo melhorado

- **Handoff criado**: `thoughts/shared/handoffs/analisador-questoes/2026-01-13_pci-parser-modal-ui-fix.md`
- **Próximo passo**: Testar fluxo completo no frontend

### 2026-01-13 (Session 3) - Brainstorming de Design

- **Brainstorming extenso** sobre arquitetura completa do sistema
  - Navegação: Home → Projetos → Dentro do Projeto (3 abas)
  - Upload: Lote com fila + robustez completa
  - Análise: Pipeline 4 fases com Multi-Pass + CoVe

- **Pesquisa aprofundada** sobre limitações de LLMs
  - Google Deep Research + Claude Deep Research
  - Descoberta: "Lost in the Middle" afeta 80% das questões em processamento único
  - Descoberta: Self-Critique isolado pode PIORAR resultados (MIT 2024)
  - Solução: Chain-of-Verification (CoVe) com busca em dados externos

- **Validação da técnica**: Reli documentos em blocos e descobri 4 conceitos perdidos na primeira leitura

- **Custos Claude API 2026**:
  - Opus 4.5: $5/$25 por MTok
  - Sonnet 4.5: $3/$15 por MTok
  - Haiku 4.5: $1/$5 por MTok
  - Custo por análise: $0.17-0.31

- **Documentos criados**:
  - `docs/plans/2026-01-13-analisador-questoes-design.md` - Design completo
  - `docs/ANALISE_PROFUNDA_ARQUITETURA.md` - Arquitetura de análise
  - `thoughts/shared/handoffs/analisador-questoes/2026-01-13_16-27-35_brainstorm-design-completo.md`

- **Próximo passo**: Implementação começando pela camada de robustez

### 2026-01-14 (Session 4) - Phase 3 Integration + ESLint Cleanup

- **Resumed from handoff** - Phase 3 Upload UI was done, needed integration

- **TaxonomyTree Component** (`frontend/src/components/features/TaxonomyTree.tsx`)
  - Tree navigation for disciplinas with expand/collapse
  - Selection state with visual feedback
  - Uses IconFolder/IconDocument for hierarchy

- **QuestionPanel Component** (`frontend/src/components/features/QuestionPanel.tsx`)
  - Expandable question cards showing full details
  - Alternatives with correct answer highlighting
  - Confidence score, anulada status, prova info

- **ProvasQuestoes Integration** (`frontend/src/pages/projeto/ProvasQuestoes.tsx`)
  - Two-column layout: 1/3 tree, 2/3 questions
  - Taxonomy fetched on load and after processing
  - Questions loaded on disciplina selection

- **API Endpoint** (`src/api/routes/projetos.py`, `frontend/src/services/api.ts`)
  - Added `GET /projetos/{id}/questoes` with filtering
  - Added `api.getProjetoQuestoes()` frontend method

- **Test Fixes**
  - ProvasQuestoes tests: added `getProjetoQuestoes` mock
  - Home tests: added MemoryRouter wrapper (not global to avoid conflicts)
  - Tests: 202/204 passing (2 pre-existing failures)

- **ESLint Cleanup Started** (23 errors found, 2 fixed)
  - TreemapChart.tsx: added CustomContentProps interface
  - EditaisList.tsx: added TaxonomiaItem/Taxonomia interfaces
  - Remaining: UploadModal, Modal.test, Dashboard.test, api.ts, mocks.ts, calculations.ts

- **Lesson Learned**: Subagent-driven development should include code quality review step
  - Pre-existing lint errors not caught during implementation
  - User correctly pointed out gaps in the process

- **Handoff criado**: `thoughts/shared/handoffs/analisador-questoes/2026-01-14_00-29_phase3-integration-eslint-cleanup.yaml`

## Session Auto-Summary (2026-01-14T02:56:14.272Z)
- Build/test: 56 passed, 0 failed
## Session Auto-Summary (2026-01-14T03:18:22.585Z)
- Build/test: 57 passed, 0 failed
## Session Auto-Summary (2026-01-14T03:31:13.030Z)
- Build/test: 67 passed, 0 failed
## Session Auto-Summary (2026-01-14T04:01:52.258Z)
- Build/test: 74 passed, 0 failed

### 2026-01-14 (Session 5) - Extraction Improvements

- **Resumed from handoff** - needed to test upload persistence fix

- **Tested Upload Workflow**
  - Uploaded PDF via API endpoint
  - Confirmed 50 questions persisted in PostgreSQL
  - Identified issues: only 5 Portuguese questions (should be 10), question 5 had empty alternatives

- **Fixed Page Overlap** (`src/extraction/llm_parser.py`)
  - Problem: chunks 1-4, 5-8, 9-12 had no overlap
  - Solution: Added `overlap_pages` parameter (default 1)
  - Result: chunks 1-4, 4-7, 7-10, 10-13 now overlap
  - Improvement: 10 Portuguese questions extracted (vs 5 before)

- **Added Optional Filter** (`src/api/routes/upload.py`)
  - Added `filter_by_edital` parameter (default: true)
  - With filter=false, all 50 questions kept (vs 5 with filter)

- **Implemented Auto-Repair**
  - `_is_incomplete_question()`: Detects questions with empty/missing alternatives
  - `_repair_incomplete_questions()`: Re-extracts using full PDF text with focused prompt
  - Result: 2/2 incomplete questions (5 and 24) repaired successfully

- **Commits**:
  - `70712ab` - feat(extraction): improve PDF question extraction reliability

- **Handoff updated**: `thoughts/shared/handoffs/analisador-questoes-concurso/current.md`