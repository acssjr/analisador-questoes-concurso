"""
LLM Quota Tracker - monitors API usage and enforces limits
"""
import json
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from loguru import logger

from src.core.config import get_settings

settings = get_settings()


# Default quotas per provider (free tier estimates)
DEFAULT_QUOTAS = {
    "groq": {
        "requests_per_minute": 30,
        "requests_per_day": 6000,
        "tokens_per_minute": 14400,
        "tokens_per_day": 500000,
    },
    "anthropic": {
        "requests_per_minute": 50,
        "requests_per_day": 10000,
        "tokens_per_minute": 100000,
        "tokens_per_day": 1000000,
    },
}


class QuotaTracker:
    """
    Tracks LLM API usage across providers with persistence.
    Thread-safe for concurrent access.
    """

    _instance: Optional["QuotaTracker"] = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self._initialized = True
        self._data_lock = threading.Lock()

        # Storage path
        self.storage_path = settings.data_dir / "quota_usage.json"

        # In-memory usage tracking
        self.usage = {
            "groq": self._empty_usage(),
            "anthropic": self._empty_usage(),
        }

        # Load persisted data
        self._load_usage()

        logger.info("QuotaTracker initialized")

    def _empty_usage(self) -> dict:
        """Create empty usage structure"""
        return {
            "requests_today": 0,
            "tokens_today": 0,
            "requests_this_minute": 0,
            "tokens_this_minute": 0,
            "last_request_time": None,
            "minute_window_start": None,
            "day_start": None,
            "history": [],  # Last 100 requests for analysis
        }

    def _load_usage(self):
        """Load usage from persistent storage"""
        try:
            if self.storage_path.exists():
                with open(self.storage_path, "r") as f:
                    data = json.load(f)

                # Check if it's a new day - reset daily counters
                today = datetime.now().date().isoformat()

                for provider in ["groq", "anthropic"]:
                    if provider in data:
                        stored_day = data[provider].get("day_start")
                        if stored_day == today:
                            # Same day - restore counters
                            self.usage[provider]["requests_today"] = data[provider].get("requests_today", 0)
                            self.usage[provider]["tokens_today"] = data[provider].get("tokens_today", 0)
                            self.usage[provider]["day_start"] = today
                            self.usage[provider]["history"] = data[provider].get("history", [])[-100:]
                        else:
                            # New day - reset but keep history
                            self.usage[provider]["day_start"] = today
                            self.usage[provider]["history"] = data[provider].get("history", [])[-100:]

                logger.info(f"Loaded quota usage from {self.storage_path}")
        except Exception as e:
            logger.warning(f"Failed to load quota usage: {e}")

    def _save_usage(self):
        """Persist usage to storage"""
        try:
            self.storage_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.storage_path, "w") as f:
                json.dump(self.usage, f, indent=2, default=str)
        except Exception as e:
            logger.warning(f"Failed to save quota usage: {e}")

    def _reset_minute_window_if_needed(self, provider: str):
        """Reset minute window counters if a minute has passed"""
        now = datetime.now()
        window_start = self.usage[provider].get("minute_window_start")

        if window_start is None or (now - datetime.fromisoformat(window_start)) > timedelta(minutes=1):
            self.usage[provider]["requests_this_minute"] = 0
            self.usage[provider]["tokens_this_minute"] = 0
            self.usage[provider]["minute_window_start"] = now.isoformat()

    def _reset_day_if_needed(self, provider: str):
        """Reset daily counters if it's a new day"""
        today = datetime.now().date().isoformat()
        day_start = self.usage[provider].get("day_start")

        if day_start != today:
            self.usage[provider]["requests_today"] = 0
            self.usage[provider]["tokens_today"] = 0
            self.usage[provider]["day_start"] = today

    def record_request(
        self,
        provider: str,
        tokens_used: int = 0,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        model: str = "",
        success: bool = True,
        error: Optional[str] = None,
    ):
        """
        Record an API request.

        Args:
            provider: 'groq' or 'anthropic'
            tokens_used: Total tokens used
            prompt_tokens: Input tokens
            completion_tokens: Output tokens
            model: Model used
            success: Whether request succeeded
            error: Error message if failed
        """
        provider = provider.lower()
        if provider not in self.usage:
            logger.warning(f"Unknown provider: {provider}")
            return

        with self._data_lock:
            self._reset_minute_window_if_needed(provider)
            self._reset_day_if_needed(provider)

            # Update counters
            self.usage[provider]["requests_today"] += 1
            self.usage[provider]["requests_this_minute"] += 1
            self.usage[provider]["tokens_today"] += tokens_used
            self.usage[provider]["tokens_this_minute"] += tokens_used
            self.usage[provider]["last_request_time"] = datetime.now().isoformat()

            # Add to history
            history_entry = {
                "timestamp": datetime.now().isoformat(),
                "tokens_used": tokens_used,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "model": model,
                "success": success,
                "error": error,
            }
            self.usage[provider]["history"].append(history_entry)

            # Keep only last 100 entries
            if len(self.usage[provider]["history"]) > 100:
                self.usage[provider]["history"] = self.usage[provider]["history"][-100:]

            # Persist
            self._save_usage()

        logger.debug(
            f"Recorded {provider} request: {tokens_used} tokens "
            f"(day: {self.usage[provider]['requests_today']}/{DEFAULT_QUOTAS[provider]['requests_per_day']})"
        )

    def check_quota(self, provider: str) -> dict:
        """
        Check if quota is available for a provider.

        Returns:
            dict with:
                - can_proceed: bool
                - reason: str if cannot proceed
                - usage: current usage stats
                - limits: configured limits
                - remaining: remaining quota
        """
        provider = provider.lower()
        if provider not in self.usage:
            return {"can_proceed": False, "reason": f"Unknown provider: {provider}"}

        with self._data_lock:
            self._reset_minute_window_if_needed(provider)
            self._reset_day_if_needed(provider)

            limits = DEFAULT_QUOTAS[provider]
            usage = self.usage[provider]

            # Check daily limit
            if usage["requests_today"] >= limits["requests_per_day"]:
                return {
                    "can_proceed": False,
                    "reason": f"Daily request limit reached ({limits['requests_per_day']})",
                    "usage": self._get_usage_summary(provider),
                    "limits": limits,
                }

            # Check minute limit
            if usage["requests_this_minute"] >= limits["requests_per_minute"]:
                return {
                    "can_proceed": False,
                    "reason": f"Per-minute request limit reached ({limits['requests_per_minute']})",
                    "usage": self._get_usage_summary(provider),
                    "limits": limits,
                    "retry_after_seconds": 60,
                }

            # Check token limits
            if usage["tokens_today"] >= limits["tokens_per_day"]:
                return {
                    "can_proceed": False,
                    "reason": f"Daily token limit reached ({limits['tokens_per_day']})",
                    "usage": self._get_usage_summary(provider),
                    "limits": limits,
                }

            return {
                "can_proceed": True,
                "usage": self._get_usage_summary(provider),
                "limits": limits,
                "remaining": {
                    "requests_today": limits["requests_per_day"] - usage["requests_today"],
                    "tokens_today": limits["tokens_per_day"] - usage["tokens_today"],
                    "requests_this_minute": limits["requests_per_minute"] - usage["requests_this_minute"],
                },
            }

    def _get_usage_summary(self, provider: str) -> dict:
        """Get usage summary for a provider"""
        usage = self.usage[provider]
        return {
            "requests_today": usage["requests_today"],
            "tokens_today": usage["tokens_today"],
            "requests_this_minute": usage["requests_this_minute"],
            "tokens_this_minute": usage["tokens_this_minute"],
            "last_request_time": usage["last_request_time"],
        }

    def get_all_stats(self) -> dict:
        """
        Get comprehensive usage statistics for all providers.

        Returns:
            dict with usage stats, limits, and analysis
        """
        with self._data_lock:
            stats = {
                "timestamp": datetime.now().isoformat(),
                "providers": {},
            }

            for provider in ["groq", "anthropic"]:
                self._reset_minute_window_if_needed(provider)
                self._reset_day_if_needed(provider)

                limits = DEFAULT_QUOTAS[provider]
                usage = self.usage[provider]

                # Calculate percentages
                requests_pct = (usage["requests_today"] / limits["requests_per_day"]) * 100
                tokens_pct = (usage["tokens_today"] / limits["tokens_per_day"]) * 100

                # Analyze history for average tokens per request
                recent_history = usage["history"][-20:] if usage["history"] else []
                avg_tokens = (
                    sum(h["tokens_used"] for h in recent_history) / len(recent_history)
                    if recent_history
                    else 0
                )
                success_rate = (
                    sum(1 for h in recent_history if h["success"]) / len(recent_history) * 100
                    if recent_history
                    else 100
                )

                # Estimate remaining capacity
                remaining_requests = limits["requests_per_day"] - usage["requests_today"]
                estimated_questions = int(remaining_requests) if avg_tokens == 0 else remaining_requests

                stats["providers"][provider] = {
                    "usage": {
                        "requests_today": usage["requests_today"],
                        "tokens_today": usage["tokens_today"],
                        "requests_this_minute": usage["requests_this_minute"],
                        "last_request": usage["last_request_time"],
                    },
                    "limits": limits,
                    "percentage": {
                        "requests": round(requests_pct, 1),
                        "tokens": round(tokens_pct, 1),
                    },
                    "remaining": {
                        "requests_today": remaining_requests,
                        "tokens_today": limits["tokens_per_day"] - usage["tokens_today"],
                    },
                    "analysis": {
                        "avg_tokens_per_request": round(avg_tokens, 1),
                        "success_rate": round(success_rate, 1),
                        "estimated_questions_remaining": estimated_questions,
                    },
                    "status": self._get_status(requests_pct, tokens_pct),
                }

            # Add recommendations
            stats["recommendations"] = self._generate_recommendations(stats["providers"])

            return stats

    def _get_status(self, requests_pct: float, tokens_pct: float) -> str:
        """Get status based on usage percentage"""
        max_pct = max(requests_pct, tokens_pct)
        if max_pct >= 90:
            return "critical"
        elif max_pct >= 70:
            return "warning"
        elif max_pct >= 50:
            return "moderate"
        else:
            return "healthy"

    def _generate_recommendations(self, providers: dict) -> list[str]:
        """Generate usage recommendations"""
        recommendations = []

        groq_status = providers.get("groq", {}).get("status", "healthy")
        anthropic_status = providers.get("anthropic", {}).get("status", "healthy")

        if groq_status == "critical":
            recommendations.append("Groq quota quase esgotada - considere usar Anthropic como alternativa")
        if groq_status in ["warning", "critical"]:
            recommendations.append("Reduza o número de classificações em lote para preservar quota")

        if anthropic_status == "critical":
            recommendations.append("Anthropic quota baixa - pause operações não essenciais")

        groq_remaining = providers.get("groq", {}).get("remaining", {}).get("requests_today", 0)
        if groq_remaining < 100:
            recommendations.append(f"Apenas {groq_remaining} requests restantes no Groq hoje")

        if not recommendations:
            recommendations.append("Quota saudável - operações normais disponíveis")

        return recommendations

    def reset_daily_counters(self, provider: Optional[str] = None):
        """Manually reset daily counters (admin function)"""
        with self._data_lock:
            providers = [provider] if provider else ["groq", "anthropic"]
            for p in providers:
                if p in self.usage:
                    self.usage[p]["requests_today"] = 0
                    self.usage[p]["tokens_today"] = 0
                    self.usage[p]["day_start"] = datetime.now().date().isoformat()
            self._save_usage()
            logger.info(f"Reset daily counters for: {providers}")


# Singleton instance
def get_quota_tracker() -> QuotaTracker:
    """Get the singleton QuotaTracker instance"""
    return QuotaTracker()
