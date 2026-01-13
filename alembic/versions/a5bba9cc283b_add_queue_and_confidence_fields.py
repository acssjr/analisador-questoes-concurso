"""add_queue_and_confidence_fields

Revision ID: a5bba9cc283b
Revises:
Create Date: 2026-01-13 17:10:39.371259

This migration adds queue processing fields to provas table
and confidence scoring fields to questoes table.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a5bba9cc283b'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    Adds:
    - provas.queue_status: Processing queue status (pending, validating, processing, completed, partial, failed, retry)
    - provas.queue_error: Error message if processing failed
    - provas.queue_retry_count: Number of retry attempts
    - provas.queue_checkpoint: Last successful processing checkpoint
    - provas.confianca_media: Average confidence score for all questions

    - questoes.confianca_score: Confidence score for this question (0-100)
    - questoes.confianca_detalhes: JSON with breakdown of confidence scoring
    - questoes.dificuldade: Question difficulty (easy, medium, hard, very_hard)
    - questoes.bloom_level: Bloom's taxonomy level
    - questoes.tem_pegadinha: Whether question has a trick/trap
    - questoes.pegadinha_descricao: Description of the trick if present
    """
    # Add queue processing fields to provas table
    with op.batch_alter_table('provas', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('queue_status', sa.String(length=50), nullable=False, server_default='pending')
        )
        batch_op.add_column(
            sa.Column('queue_error', sa.Text(), nullable=True)
        )
        batch_op.add_column(
            sa.Column('queue_retry_count', sa.Integer(), nullable=False, server_default='0')
        )
        batch_op.add_column(
            sa.Column('queue_checkpoint', sa.String(length=50), nullable=True)
        )
        batch_op.add_column(
            sa.Column('confianca_media', sa.Float(), nullable=True)
        )

    # Add confidence and analysis fields to questoes table
    with op.batch_alter_table('questoes', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('confianca_score', sa.Integer(), nullable=True)
        )
        batch_op.add_column(
            sa.Column('confianca_detalhes', sa.JSON(), nullable=True)
        )
        batch_op.add_column(
            sa.Column('dificuldade', sa.String(length=20), nullable=True)
        )
        batch_op.add_column(
            sa.Column('bloom_level', sa.String(length=20), nullable=True)
        )
        batch_op.add_column(
            sa.Column('tem_pegadinha', sa.Boolean(), nullable=False, server_default='0')
        )
        batch_op.add_column(
            sa.Column('pegadinha_descricao', sa.Text(), nullable=True)
        )


def downgrade() -> None:
    """Downgrade schema by removing the added columns."""
    with op.batch_alter_table('questoes', schema=None) as batch_op:
        batch_op.drop_column('pegadinha_descricao')
        batch_op.drop_column('tem_pegadinha')
        batch_op.drop_column('bloom_level')
        batch_op.drop_column('dificuldade')
        batch_op.drop_column('confianca_detalhes')
        batch_op.drop_column('confianca_score')

    with op.batch_alter_table('provas', schema=None) as batch_op:
        batch_op.drop_column('confianca_media')
        batch_op.drop_column('queue_checkpoint')
        batch_op.drop_column('queue_retry_count')
        batch_op.drop_column('queue_error')
        batch_op.drop_column('queue_status')
