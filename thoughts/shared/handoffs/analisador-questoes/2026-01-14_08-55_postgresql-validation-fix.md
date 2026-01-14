---
date: 2026-01-14T08:55:13-03:00
session_name: analisador-questoes
researcher: Claude
git_commit: d756d89
branch: main
repository: analisador-questoes-concurso
topic: "PostgreSQL Migration Validation and SQLite Cache Bug Fix"
tags: [postgresql, pgvector, database, validation, bug-fix]
status: complete
last_updated: 2026-01-14
last_updated_by: Claude
type: implementation_strategy
root_span_id: ""
turn_span_id: ""
---

# Handoff: PostgreSQL Migration Validation & SQLite Cache Bug Fix

## Task(s)

### Completed
- [x] Updated Claude Code to latest version (2.1.7 - already current)
- [x] Ran `git pull` to sync latest changes (61 files from f2eb8f9 to d756d89)
- [x] Validated PostgreSQL + pgvector setup
- [x] Fixed DATABASE_URL in `.env` (was SQLite, now PostgreSQL)
- [x] Installed `psycopg2-binary` dependency for alembic migrations
- [x] Created database tables via SQLAlchemy `init_db()`
- [x] Enabled pgvector extension manually
- [x] **Fixed critical SQLite cache bug** - backend was using cached SQLite connection
- [x] Validated full upload workflow: 40 questions extracted and persisted

### Current Status
Extraction and persistence working correctly with PostgreSQL. Ready for Phase 4 (Deep Analysis Pipeline).

## Critical References
- `thoughts/shared/handoffs/analisador-questoes-concurso/current.md` - Main continuity ledger
- `src/api/routes/upload.py` - Upload endpoint with database persistence logic

## Recent changes

```
.env:2 - Changed DATABASE_URL from sqlite to postgresql+asyncpg
pyproject.toml - Added psycopg2-binary dependency
```

## Learnings

### SQLite Cache Bug (CRITICAL)
The backend was using SQLite even after changing `.env` to PostgreSQL because:
1. Python processes (uvicorn) were cached and not restarted
2. The `@lru_cache` on `get_settings()` in `src/core/config.py:88` caches the config
3. The `engine` in `src/core/database.py` is created at module import time

**Solution**: Kill ALL Python processes with `taskkill /F /IM python.exe` before restarting uvicorn. This forces a fresh module import with the new DATABASE_URL.

### Database Setup Order
For PostgreSQL + pgvector from scratch:
1. Start Docker container: `docker-compose up -d`
2. Enable pgvector extension: `CREATE EXTENSION IF NOT EXISTS vector;`
3. Create tables via `init_db()` (imports models first)
4. Alembic migrations only work AFTER base tables exist

### Upload Persistence Flow
Questions are only persisted to database when:
- `projeto_id` is provided in the upload request
- The projeto exists in the database
- Commit happens at `src/api/routes/upload.py:365`

## Post-Mortem (Required for Artifact Index)

### What Worked
- Docker Compose setup for PostgreSQL 16 + pgvector 0.8.1
- LLM extraction via Groq (Llama 4 Scout) - 40 questions extracted correctly
- Discipline identification: Lingua Portuguesa (10), Informática (10), Conhecimentos Específicos (20)
- Page overlap extraction (1-page overlap between chunks)

### What Failed
- Tried: Running alembic migrations before creating base tables → Failed because migrations assumed tables existed
- Tried: Restarting uvicorn with --reload → Failed because Python processes were still cached
- Error: "type vector does not exist" → Fixed by manually running `CREATE EXTENSION IF NOT EXISTS vector`
- Error: SQLite data appearing in PostgreSQL API → Fixed by killing all Python processes

### Key Decisions
- Decision: Use `init_db()` instead of alembic for initial table creation
  - Alternatives: Create alembic migration for all tables
  - Reason: Faster for development, alembic migrations are incremental only

- Decision: Kill all Python processes instead of just uvicorn
  - Alternatives: Clear lru_cache programmatically
  - Reason: Simpler and guarantees clean state

## Artifacts

- `.env` - Updated DATABASE_URL to PostgreSQL
- `pyproject.toml` - Added psycopg2-binary
- `data/questoes.db` - Old SQLite database (can be archived/deleted)
- PostgreSQL tables: 10 tables created (projetos, provas, questoes, editais, etc.)

## Action Items & Next Steps

1. **Optional: Test Frontend UI**
   - Start Vite dev server: `cd frontend && npm run dev`
   - Test upload via browser at localhost:5173

2. **Phase 4: Deep Analysis Pipeline**
   - Implement embeddings generation with pgvector
   - Map-Reduce for question analysis
   - CoVe (Chain of Verification) for quality assurance

3. **TaxonomyTree Component** (Phase 3e)
   - Hierarchical tree with expand/collapse for disciplines
   - Located in `frontend/src/components/features/TaxonomyTree.tsx`

4. **QuestionPanel Component** (Phase 3f)
   - Side panel showing questions for selected topic

## Other Notes

### Database Connection Details
```
Host: localhost:5432
Database: analisador_questoes
User: analisador
Password: analisador_dev
```

### Test Commands
```bash
# Check PostgreSQL container
docker ps --format "table {{.Names}}\t{{.Status}}"

# Query question count
docker exec analisador-questoes-postgres psql -U analisador -d analisador_questoes -c "SELECT COUNT(*) FROM questoes;"

# Check questions by discipline
docker exec analisador-questoes-postgres psql -U analisador -d analisador_questoes -c "SELECT disciplina, COUNT(*) FROM questoes GROUP BY disciplina;"
```

### Backend State
- Backend running on `localhost:8000`
- Background task ID: `bf9e531`
- Connected to PostgreSQL (verified)

### Current Data
- 1 projeto: "Teste Direto" (UUID: 11111111-1111-1111-1111-111111111111)
- 1 prova: "assistente_legislativo.pdf" (40 questions, status: completed)
- 40 questões distribuídas em 3 disciplinas
