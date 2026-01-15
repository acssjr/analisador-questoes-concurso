"""
Migration script to fix encoding issues in the database.

Fixes:
1. Inconsistent disciplina names (missing accents)
2. Mojibake (double UTF-8 encoding)

Run with: python scripts/fix_encoding.py [--dry-run]
"""
import asyncio
import sys
import unicodedata
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from loguru import logger
from sqlalchemy import select, text, update

from src.core.database import AsyncSessionLocal
from src.models.questao import Questao


def fix_mojibake(text: str) -> str:
    """
    Fix double UTF-8 encoding (mojibake) in text.

    Common mojibake patterns:
    - "Ã¡" -> "a" (UTF-8 interpreted as Latin-1, then encoded as UTF-8 again)
    - "Ã©" -> "e"
    - "Ãº" -> "u"
    - etc.
    """
    if not text:
        return text

    try:
        # If the text contains mojibake, it was UTF-8 bytes interpreted as Latin-1
        # We can fix it by encoding to Latin-1 and decoding as UTF-8
        fixed = text.encode('latin-1').decode('utf-8')
        return fixed
    except (UnicodeDecodeError, UnicodeEncodeError):
        # Not mojibake, return original
        return text


def remove_accents(text: str) -> str:
    """Remove accents from text for comparison"""
    nfkd = unicodedata.normalize('NFKD', text)
    return ''.join(c for c in nfkd if not unicodedata.combining(c))


# Canonical display names for common disciplines (normalized key -> display name with accents)
CANONICAL_DISCIPLINAS = {
    "lingua portuguesa": "Língua Portuguesa",
    "portugues": "Língua Portuguesa",
    "matematica": "Matemática",
    "raciocinio logico": "Raciocínio Lógico",
    "raciocinio logico-matematico": "Raciocínio Lógico-Matemático",
    "matematica e raciocinio logico": "Matemática e Raciocínio Lógico",
    "informatica": "Informática",
    "nocoes de informatica": "Noções de Informática",
    "direito constitucional": "Direito Constitucional",
    "direito administrativo": "Direito Administrativo",
    "direito penal": "Direito Penal",
    "direito civil": "Direito Civil",
    "direito tributario": "Direito Tributário",
    "direito processual": "Direito Processual",
    "administracao": "Administração",
    "administracao publica": "Administração Pública",
    "contabilidade": "Contabilidade",
    "contabilidade geral": "Contabilidade Geral",
    "contabilidade publica": "Contabilidade Pública",
    "economia": "Economia",
    "afo": "AFO",
    "administracao financeira e orcamentaria": "Administração Financeira e Orçamentária",
    "legislacao": "Legislação",
    "legislacao basica": "Legislação Básica",
    "legislacao basica aplicada a administracao publica": "Legislação Básica Aplicada à Administração Pública",
    "nocoes de legislacao": "Noções de Legislação",
    "atualidades": "Atualidades",
    "conhecimentos gerais": "Conhecimentos Gerais",
    "redacao": "Redação",
    "tecnologia": "Tecnologia",
    "tecnologia da informacao": "Tecnologia da Informação",
    "conhecimentos especificos": "Conhecimentos Específicos",
    "meio ambiente": "Meio Ambiente",
    "historia do municipio": "História do Município",
    "principios da administracao publica e legislacao": "Princípios da Administração Pública e Legislação",
}


def canonicalize_disciplina(nome: str) -> str:
    """
    Convert discipline name to canonical display form with proper accents.

    Maps variations like "Lingua Portuguesa", "lingua portuguesa", "LINGUA PORTUGUESA"
    all to "Lingua Portuguesa".
    """
    if not nome:
        return ""

    # First, try to fix any mojibake
    nome = fix_mojibake(nome)

    # Normalize for lookup (lowercase, no accents)
    normalized = remove_accents(nome.lower().strip())

    # Check canonical mapping
    if normalized in CANONICAL_DISCIPLINAS:
        return CANONICAL_DISCIPLINAS[normalized]

    # For unknown disciplines, use title case on original
    return nome.strip().title()


async def fix_questoes_encoding(dry_run: bool = True):
    """Fix encoding issues in questoes table"""

    async with AsyncSessionLocal() as db:
        # Get all distinct disciplinas
        result = await db.execute(
            select(Questao.id, Questao.disciplina).where(Questao.disciplina.isnot(None))
        )
        questoes = result.all()

        # Group by original disciplina
        by_disciplina = {}
        for q_id, disciplina in questoes:
            if disciplina not in by_disciplina:
                by_disciplina[disciplina] = []
            by_disciplina[disciplina].append(q_id)

        logger.info(f"Found {len(by_disciplina)} distinct disciplina values")

        # Calculate fixes
        fixes = {}
        for original, ids in by_disciplina.items():
            canonical = canonicalize_disciplina(original)
            if original != canonical:
                fixes[original] = {
                    "canonical": canonical,
                    "count": len(ids),
                    "ids": ids
                }

        if not fixes:
            logger.info("No encoding fixes needed!")
            return

        logger.info(f"Found {len(fixes)} disciplinas to fix:")
        for original, fix_info in fixes.items():
            logger.info(f"  '{original}' -> '{fix_info['canonical']}' ({fix_info['count']} records)")

        if dry_run:
            logger.info("DRY RUN - no changes made. Run with --apply to fix.")
            return

        # Apply fixes
        total_fixed = 0
        for original, fix_info in fixes.items():
            stmt = (
                update(Questao)
                .where(Questao.disciplina == original)
                .values(disciplina=fix_info["canonical"])
            )
            result = await db.execute(stmt)
            total_fixed += result.rowcount
            logger.info(f"Fixed {result.rowcount} records: '{original}' -> '{fix_info['canonical']}'")

        await db.commit()
        logger.info(f"Total fixed: {total_fixed} records")


async def show_current_state():
    """Show current state of disciplinas in database"""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            text("SELECT disciplina, COUNT(*) as cnt FROM questoes GROUP BY disciplina ORDER BY cnt DESC")
        )
        rows = result.all()

        logger.info("Current disciplinas in database:")
        for disciplina, count in rows:
            logger.info(f"  {count:4d} | {disciplina}")


async def main():
    """Main migration function"""
    import argparse

    parser = argparse.ArgumentParser(description="Fix encoding issues in database")
    parser.add_argument("--apply", action="store_true", help="Apply fixes (default is dry run)")
    parser.add_argument("--show", action="store_true", help="Show current state only")
    args = parser.parse_args()

    if args.show:
        await show_current_state()
        return

    dry_run = not args.apply

    logger.info("=" * 60)
    logger.info("Encoding Fix Migration")
    logger.info("=" * 60)

    if dry_run:
        logger.info("Running in DRY RUN mode (no changes will be made)")
    else:
        logger.info("Running in APPLY mode (changes will be committed)")

    logger.info("")

    await show_current_state()
    logger.info("")

    await fix_questoes_encoding(dry_run=dry_run)

    if not dry_run:
        logger.info("")
        logger.info("After fix:")
        await show_current_state()


if __name__ == "__main__":
    asyncio.run(main())
