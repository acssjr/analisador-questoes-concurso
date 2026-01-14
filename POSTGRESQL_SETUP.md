# PostgreSQL with pgvector Setup Guide

This guide explains how to set up and use PostgreSQL with pgvector extension for the analisador-questoes-concurso project.

## Why PostgreSQL + pgvector?

- **Vector similarity search**: Native support for embeddings and similarity queries (faster than JSON storage)
- **Better performance**: ACID compliance, better concurrency, indexing for large datasets
- **Production-ready**: Reliable, scalable, widely supported

## Prerequisites

- Docker and Docker Compose installed
- Python 3.11+ with project dependencies installed

## Setup Steps

### 1. Start PostgreSQL with Docker

```bash
# Start PostgreSQL container with pgvector extension
docker-compose up -d

# Check if container is running
docker-compose ps

# View logs
docker-compose logs -f postgres
```

The database will be available at:
- **Host**: localhost
- **Port**: 5432
- **Database**: analisador_questoes
- **User**: analisador
- **Password**: analisador_dev

### 2. Verify .env Configuration

Ensure your `.env` file has the PostgreSQL URL active:

```env
# PostgreSQL with pgvector (recommended for production and embeddings)
DATABASE_URL=postgresql+asyncpg://analisador:analisador_dev@localhost:5432/analisador_questoes

# SQLite fallback for development (comment out PostgreSQL URL and uncomment this)
# DATABASE_URL=sqlite+aiosqlite:///./data/questoes.db
```

### 3. Install Python Dependencies

```bash
# Install/update dependencies (includes asyncpg, pgvector, aiosqlite)
pip install -e .
```

### 4. Run Database Migrations

```bash
# Apply all migrations (creates tables and enables pgvector)
alembic upgrade head

# Check migration history
alembic history

# Current revision
alembic current
```

### 5. Verify pgvector Extension

Connect to the database and verify:

```bash
# Connect to PostgreSQL
docker exec -it analisador-questoes-postgres psql -U analisador -d analisador_questoes

# Inside psql, check if vector extension is enabled
\dx

# Should show:
#  Name   | Version |   Schema   |         Description
# --------+---------+------------+-----------------------------
#  vector | 0.5.0   | public     | vector data type and ivfflat...

# Check embeddings table structure
\d embeddings

# Exit psql
\q
```

## Usage

### Switching Between PostgreSQL and SQLite

**Use PostgreSQL (recommended):**
```env
DATABASE_URL=postgresql+asyncpg://analisador:analisador_dev@localhost:5432/analisador_questoes
```

**Use SQLite (for quick local dev without Docker):**
```env
DATABASE_URL=sqlite+aiosqlite:///./data/questoes.db
```

The code automatically adapts:
- PostgreSQL: Uses `vector(768)` type for embeddings
- SQLite: Falls back to `JSON` type

### Common Database Operations

```bash
# Stop PostgreSQL
docker-compose down

# Stop and remove data (⚠️ DESTRUCTIVE - deletes all data)
docker-compose down -v

# Restart PostgreSQL
docker-compose restart

# View database logs
docker-compose logs -f postgres

# Backup database
docker exec analisador-questoes-postgres pg_dump -U analisador analisador_questoes > backup.sql

# Restore database
cat backup.sql | docker exec -i analisador-questoes-postgres psql -U analisador -d analisador_questoes
```

### Creating New Migrations

```bash
# Auto-generate migration from model changes
alembic revision --autogenerate -m "description of changes"

# Create empty migration (for custom SQL)
alembic revision -m "description of changes"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1
```

## Vector Operations with pgvector

Once you have embeddings stored, you can perform similarity searches:

```python
from sqlalchemy import select, func
from src.models import Embedding, Questao

# Find similar questions using cosine distance
async def find_similar_questions(db: AsyncSession, embedding_vector: list[float], limit: int = 10):
    stmt = (
        select(Questao, Embedding.vetor.cosine_distance(embedding_vector).label('distance'))
        .join(Embedding)
        .where(Embedding.tipo == 'enunciado_completo')
        .order_by('distance')
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.all()
```

Available distance functions:
- `cosine_distance(vector)` - Cosine distance (0 = identical, 2 = opposite)
- `l2_distance(vector)` - Euclidean distance
- `max_inner_product(vector)` - Maximum inner product (for normalized vectors)

## Performance Optimization

### Create Vector Index (for large datasets)

```sql
-- After loading embeddings, create an index for faster similarity search
CREATE INDEX ON embeddings USING ivfflat (vetor vector_cosine_ops) WITH (lists = 100);
```

For smaller datasets (<10k embeddings), a sequential scan may be faster than an index.

## Troubleshooting

### Connection refused
```bash
# Check if container is running
docker-compose ps

# Restart container
docker-compose restart postgres
```

### Migration errors
```bash
# Check current revision
alembic current

# View migration history
alembic history

# Force stamp (if migrations are out of sync)
alembic stamp head
```

### Reset database completely
```bash
# ⚠️ DESTRUCTIVE - Deletes all data
docker-compose down -v
docker-compose up -d
alembic upgrade head
```

### Port 5432 already in use
If you have another PostgreSQL instance running:
```yaml
# Edit docker-compose.yml ports section
ports:
  - "5433:5432"  # Use different host port

# Update .env
DATABASE_URL=postgresql+asyncpg://analisador:analisador_dev@localhost:5433/analisador_questoes
```

## Architecture Notes

- **Async driver**: Uses `asyncpg` for PostgreSQL, `aiosqlite` for SQLite
- **Migration sync**: Alembic automatically converts async URLs to sync for migrations
- **Vector fallback**: The Embedding model automatically uses JSON when pgvector is not available
- **Batch operations**: SQLite migrations use `batch_alter_table` for compatibility

## Next Steps

1. ✅ PostgreSQL running
2. ✅ Migrations applied
3. ✅ pgvector extension enabled
4. Load your data (PDFs → questions → embeddings)
5. Query similar questions using vector similarity

For embedding generation, see `src/services/embedding_service.py`.
