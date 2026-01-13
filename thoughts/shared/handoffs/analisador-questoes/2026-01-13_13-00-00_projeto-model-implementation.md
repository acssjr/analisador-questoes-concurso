---
date: 2026-01-13T13:00:00-03:00
session_name: analisador-questoes
researcher: Claude
git_commit: 89251c6e741efed14b0dd54a42d843f10592af4f
branch: main
repository: analisador-questoes-concurso
topic: "Projeto Model Implementation - Workflow Architecture"
tags: [projeto, database, api, workflow, architecture]
status: in_progress
last_updated: 2026-01-13
last_updated_by: Claude
type: implementation_strategy
root_span_id:
turn_span_id:
---

# Handoff: Projeto Model Implementation and Workflow Architecture

## Task(s)

1. **Database cleanup** - COMPLETED
   - Removed 19 duplicate editais (21 → 2)
   - Removed 32 orphan PDF files (15 MB freed)
   - Added deduplication logic to prevent future duplicates

2. **Projeto model implementation** - IN PROGRESS
   - [x] Created `Projeto` SQLAlchemy model
   - [x] Updated `Edital` model with `projeto_id` foreign key
   - [x] Updated `Prova` model with `projeto_id` foreign key
   - [x] Created Pydantic schemas for Projeto
   - [x] Created API routes for Projeto CRUD
   - [x] Added `projeto_id` columns to database
   - [ ] Test API endpoints (server needs restart)
   - [ ] Update frontend with Projeto selector

3. **SessionStart hook** - COMPLETED
   - Created `.claude/hooks/dev-servers.sh` for auto-starting servers

## Critical References

- `thoughts/ledgers/CONTINUITY_CLAUDE-analisador-questoes.md` - Main continuity ledger
- User's workflow vision documented in conversation (see Learnings below)

## Recent changes

- `src/models/projeto.py:1-76` - NEW: Projeto model with relationships
- `src/models/edital.py:32-35` - Added `projeto_id` foreign key
- `src/models/prova.py:34-37` - Added `projeto_id` foreign key
- `src/schemas/projeto.py:1-67` - NEW: Pydantic schemas
- `src/api/routes/projetos.py:1-294` - NEW: Full CRUD API
- `src/api/main.py:10,48` - Registered projetos router
- `src/api/routes/editais.py:69-103` - Added deduplication logic
- `.claude/hooks/dev-servers.sh:1-57` - NEW: Auto-start hook
- `.claude/settings.json` - Registered SessionStart hook

## Learnings

### User's Full Workflow Vision

The user clarified the complete architecture vision:

```
┌─────────────────────────────────────────────────────────────────┐
│                        PROJETO                                   │
│  (Edital + Conteúdo Programático = unidade de trabalho)         │
├─────────────────────────────────────────────────────────────────┤
│  1. Upload Edital → Extract metadata                             │
│  2. Upload Conteúdo Programático → Extract taxonomia             │
│  3. INCREMENTAL prova uploads over time                          │
│  4. Questions auto-extracted and classified                      │
│  5. When ready → Deep LLM Analysis                               │
└─────────────────────────────────────────────────────────────────┘
```

**Two phases of analysis:**
- **Phase A (Exists)**: Extract questions, classify by taxonomy, show incidence
- **Phase B (Differentiator)**: Deep LLM analysis with:
  - Pattern identification across years
  - Similarity detection between questions
  - Repeated questions detection
  - Difficulty classification
  - "Trick question" identification
  - Written analysis text (not just data)
  - Concepts required for each topic

### Database State

- `data/questoes.db` has tables: projetos, editais, provas, questoes, classificacoes, etc.
- 2 editais saved (CONCURSO PÚBLICO Nº 007/2025 - UEFS/IDCAP)
- 20 prova PDFs in `data/raw/provas/` (NOT YET PROCESSED)
- Question extraction is now working (user confirmed)

### Projeto Status Flow

```
configurando → coletando → pronto_analise → analisando → concluido
     ↑              ↑              ↑
  no edital    has edital    has enough
               + taxonomia    questions
```

## Post-Mortem

### What Worked
- **Database cleanup approach**: Identifying duplicates by (nome, banca, ano) and keeping the one with highest taxonomy score
- **Deduplication at source**: Adding check before creating new edital prevents future duplicates
- **SQLite ALTER TABLE**: Simple column additions work fine, just can't add foreign key constraints

### What Failed
- Tried: SQLAlchemy's `create_all()` to add columns → Failed because: SQLite doesn't alter existing tables
- Fixed by: Manual `ALTER TABLE ADD COLUMN` commands

### Key Decisions
- Decision: Make `projeto_id` optional in Edital/Prova for backward compatibility
  - Alternatives: Required field with migration
  - Reason: Existing editais without project can still work

- Decision: Projeto has status flow (configurando → coletando → pronto_analise → analisando → concluido)
  - Reason: Matches user's incremental workflow

## Artifacts

- `src/models/projeto.py` - Projeto SQLAlchemy model
- `src/schemas/projeto.py` - Pydantic schemas
- `src/api/routes/projetos.py` - API endpoints
- `.claude/hooks/dev-servers.sh` - Auto-start servers hook
- `thoughts/ledgers/CONTINUITY_CLAUDE-analisador-questoes.md` - Updated ledger

## Action Items & Next Steps

1. **Test Projeto API** - Restart backend and test:
   ```bash
   curl http://localhost:8000/api/projetos/
   curl -X POST http://localhost:8000/api/projetos/ -H "Content-Type: application/json" -d '{"nome": "UEFS 2025"}'
   ```

2. **Create frontend Projeto selector** - Add UI to:
   - List existing projects
   - Create new project
   - Select project before upload flow

3. **Integrate upload with Projeto** - Modify upload.py to:
   - Accept `projeto_id` parameter
   - Save provas/questões linked to projeto
   - Update projeto statistics

4. **Process existing provas** - 20 PDFs in `data/raw/provas/` waiting to be processed

5. **Phase B Analysis** - Future: implement deep LLM analysis features

## Other Notes

### API Endpoints Created

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projetos/` | List all projects |
| POST | `/api/projetos/` | Create project |
| GET | `/api/projetos/{id}` | Get project details |
| PATCH | `/api/projetos/{id}` | Update project |
| DELETE | `/api/projetos/{id}` | Delete project |
| POST | `/api/projetos/{id}/vincular-edital/{edital_id}` | Link edital to project |
| GET | `/api/projetos/{id}/stats` | Get detailed statistics |

### Server Commands

```bash
# Backend
cd C:\Users\antonio.santos\Documents\analisador-questoes-concurso
uv run uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000

# Frontend
cd frontend && npm run dev
```

### Current Provas (not processed)

```
1.pdf, 2.pdf, (pt-info-mat).pdf, agente_de_combate_as_endemias_ace.pdf,
agente_de_endemias.pdf, agente_de_suprimentos_contratos_e_patrimonio.pdf,
assistente_legislativo.pdf, ESPECIALIZADO.pdf, fiscal_de_obras_posturas_e_meio_ambiente.pdf,
fiscal_de_saude_publica_e_meio_ambiente.pdf, fiscal_de_tributos.pdf,
tecnico_ambiental.pdf, UNIVERSITÁRIO.pdf, 2025pdf.pdf, 2024df.pdf, ...
```
