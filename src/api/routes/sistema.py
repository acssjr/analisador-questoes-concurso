"""
Sistema routes - system stats, quota tracking, health checks
"""

from fastapi import APIRouter
from loguru import logger

from src.llm.quota_tracker import get_quota_tracker

router = APIRouter()


@router.get("/quota")
async def get_quota_stats():
    """
    Get LLM quota usage statistics for all providers.

    Returns comprehensive stats including:
    - Current usage (requests, tokens)
    - Configured limits
    - Percentage used
    - Remaining capacity
    - Recommendations
    """
    try:
        tracker = get_quota_tracker()
        stats = tracker.get_all_stats()
        return {
            "success": True,
            **stats,
        }
    except Exception as e:
        logger.error(f"Failed to get quota stats: {e}")
        return {
            "success": False,
            "error": str(e),
        }


@router.get("/quota/{provider}")
async def get_provider_quota(provider: str):
    """
    Get quota stats for a specific provider.

    Args:
        provider: 'groq' or 'anthropic'
    """
    try:
        tracker = get_quota_tracker()
        check = tracker.check_quota(provider)
        return {
            "success": True,
            "provider": provider,
            **check,
        }
    except Exception as e:
        logger.error(f"Failed to get {provider} quota: {e}")
        return {
            "success": False,
            "error": str(e),
        }


@router.post("/quota/reset/{provider}")
async def reset_provider_quota(provider: str):
    """
    Reset daily quota counters for a provider (admin function).

    Args:
        provider: 'groq' or 'anthropic'
    """
    try:
        tracker = get_quota_tracker()
        tracker.reset_daily_counters(provider)
        return {
            "success": True,
            "message": f"Quota reset for {provider}",
        }
    except Exception as e:
        logger.error(f"Failed to reset {provider} quota: {e}")
        return {
            "success": False,
            "error": str(e),
        }


@router.get("/health")
async def health_check():
    """
    System health check with component status.
    """
    from src.core.config import get_settings

    settings = get_settings()

    # Check LLM providers
    llm_status = {
        "groq": bool(settings.groq_api_key),
        "anthropic": bool(settings.anthropic_api_key),
    }

    # Get quota status
    tracker = get_quota_tracker()
    quota_stats = tracker.get_all_stats()

    return {
        "status": "healthy",
        "components": {
            "database": True,  # If we got here, DB is working
            "llm_providers": llm_status,
        },
        "quota_summary": {
            provider: {
                "status": data.get("status", "unknown"),
                "requests_remaining": data.get("remaining", {}).get("requests_today", 0),
                "percentage_used": data.get("percentage", {}).get("requests", 0),
            }
            for provider, data in quota_stats.get("providers", {}).items()
        },
        "recommendations": quota_stats.get("recommendations", []),
    }


@router.get("/stats")
async def get_system_stats():
    """
    Get overall system statistics.
    """
    from sqlalchemy import func, select

    from src.core.database import get_db
    from src.models.classificacao import Classificacao
    from src.models.edital import Edital
    from src.models.questao import Questao

    try:
        stats = {
            "editais": 0,
            "questoes": 0,
            "classificacoes": 0,
            "questoes_classificadas_pct": 0,
        }

        async for db in get_db():
            # Count editais
            result = await db.execute(select(func.count(Edital.id)))
            stats["editais"] = result.scalar() or 0

            # Count questoes
            result = await db.execute(select(func.count(Questao.id)))
            stats["questoes"] = result.scalar() or 0

            # Count classificacoes
            result = await db.execute(select(func.count(Classificacao.id)))
            stats["classificacoes"] = result.scalar() or 0

            # Calculate percentage
            if stats["questoes"] > 0:
                stats["questoes_classificadas_pct"] = round(
                    (stats["classificacoes"] / stats["questoes"]) * 100, 1
                )

        # Add quota info
        tracker = get_quota_tracker()
        quota_stats = tracker.get_all_stats()

        return {
            "success": True,
            "data": stats,
            "quota": {
                provider: {
                    "requests_today": data.get("usage", {}).get("requests_today", 0),
                    "requests_remaining": data.get("remaining", {}).get("requests_today", 0),
                    "status": data.get("status", "unknown"),
                }
                for provider, data in quota_stats.get("providers", {}).items()
            },
        }

    except Exception as e:
        logger.error(f"Failed to get system stats: {e}")
        return {
            "success": False,
            "error": str(e),
        }
