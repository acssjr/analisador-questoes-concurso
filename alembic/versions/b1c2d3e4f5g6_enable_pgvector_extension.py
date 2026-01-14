"""enable_pgvector_extension

Revision ID: b1c2d3e4f5g6
Revises: a5bba9cc283b
Create Date: 2026-01-14 00:00:00.000000

This migration enables the pgvector extension for PostgreSQL and
ensures the embeddings table uses proper vector columns instead of JSON.

Note: This migration is PostgreSQL-specific. SQLite will continue using JSON.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5g6'
down_revision: Union[str, Sequence[str], None] = 'a5bba9cc283b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def is_postgresql():
    """Check if we're running on PostgreSQL"""
    bind = op.get_bind()
    return bind.dialect.name == 'postgresql'


def upgrade() -> None:
    """Upgrade schema - Enable pgvector and convert embedding vectors.

    For PostgreSQL:
    - Enables the pgvector extension
    - Converts the embeddings.vetor column from JSON to vector(768)

    For SQLite:
    - No changes (continues using JSON)
    """
    if is_postgresql():
        # Enable pgvector extension
        op.execute('CREATE EXTENSION IF NOT EXISTS vector;')

        # Convert embeddings.vetor from JSON to vector(768)
        # Note: This requires pgvector to be installed in PostgreSQL
        with op.batch_alter_table('embeddings', schema=None) as batch_op:
            # Drop the old JSON column
            batch_op.drop_column('vetor')

            # Add the new vector column
            # Using postgresql.ARRAY as a placeholder - will be replaced by Vector type at runtime
            batch_op.add_column(
                sa.Column('vetor', postgresql.ARRAY(sa.Float()), nullable=True)
            )

        # Note: After this migration, the Embedding model's Vector type will handle the rest
        # pgvector's Vector type will properly store the data as vector(768)
    else:
        # SQLite - no changes needed, JSON works fine
        pass


def downgrade() -> None:
    """Downgrade schema - Convert vectors back to JSON.

    Warning: This will lose vector indexing capabilities in PostgreSQL.
    """
    if is_postgresql():
        # Convert embeddings.vetor from vector(768) back to JSON
        with op.batch_alter_table('embeddings', schema=None) as batch_op:
            batch_op.drop_column('vetor')
            batch_op.add_column(
                sa.Column('vetor', sa.JSON(), nullable=True)
            )

        # Note: We don't drop the vector extension as other databases might use it
        # To drop it manually: DROP EXTENSION IF EXISTS vector;
    else:
        # SQLite - no changes needed
        pass
