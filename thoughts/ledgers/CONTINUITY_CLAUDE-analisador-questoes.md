# Continuity Ledger: Analisador de Questoes de Concurso

**Session**: analisador-questoes
**Created**: 2026-01-09
**Last Updated**: 2026-01-13

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

- Now: [->] Phase 12: Implementação do Design Completo
  - Design documentado em `docs/plans/2026-01-13-analisador-questoes-design.md`
  - Arquitetura de análise em `docs/ANALISE_PROFUNDA_ARQUITETURA.md`
  - Prioridade 1: Camada de Robustez (Backend)
  - Prioridade 2: Frontend Base com React Router
  - Prioridade 3: Aba Provas & Questões
  - Prioridade 4: Pipeline de Análise Profunda

- Next:
  - [ ] Phase 12a: Validação pré-processamento de PDF
  - [ ] Phase 12b: Sistema de fila com estados
  - [ ] Phase 12c: Score de confiança por questão
  - [ ] Phase 12d: Retry com backoff + fallback
  - [ ] Phase 12e: Checkpoints por etapa

- Later:
  - [ ] Phase 13: Frontend - React Router + Layout base
  - [ ] Phase 14: Frontend - Wizard de criação de projeto
  - [ ] Phase 15: Frontend - Aba Provas & Questões (upload + árvore + painel)
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
