"""
Database setup script - creates tables
"""
import asyncio
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from loguru import logger

from src.core.database import init_db


async def main():
    """Create database tables"""
    logger.info("Setting up database...")

    try:
        await init_db()
        logger.info("✓ Database setup complete!")
    except Exception as e:
        logger.error(f"✗ Database setup failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
