"""
Logging configuration using loguru
"""

import sys

from loguru import logger

from src.core.config import get_settings


def setup_logging():
    """Configure loguru logger"""
    settings = get_settings()

    # Remove default handler
    logger.remove()

    # Console handler (colorized)
    logger.add(
        sys.stderr,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        level=settings.log_level,
        colorize=True,
    )

    # File handler (all logs)
    log_dir = settings.base_dir / "logs"
    log_dir.mkdir(exist_ok=True)

    logger.add(
        log_dir / "app.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
        level="DEBUG",
        rotation="10 MB",
        retention="30 days",
        compression="zip",
    )

    # Error file handler
    logger.add(
        log_dir / "errors.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
        level="ERROR",
        rotation="10 MB",
        retention="90 days",
        compression="zip",
        backtrace=True,
        diagnose=True,
    )

    logger.info(f"Logging configured - Level: {settings.log_level}")


# Initialize logging on import
setup_logging()
