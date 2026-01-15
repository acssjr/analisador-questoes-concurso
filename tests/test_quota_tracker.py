"""
Tests for LLM quota tracking system
"""

import json
from datetime import datetime
from unittest.mock import patch

import pytest

from src.llm.quota_tracker import DEFAULT_QUOTAS, QuotaTracker, get_quota_tracker


class TestQuotaTracker:
    """Tests for QuotaTracker class"""

    @pytest.fixture
    def tracker(self, tmp_path):
        """Create fresh QuotaTracker with temp storage"""
        # Reset singleton
        QuotaTracker._instance = None

        # Patch the settings to use temp path
        with patch("src.llm.quota_tracker.settings") as mock_settings:
            mock_settings.data_dir = tmp_path
            tracker = QuotaTracker()
            yield tracker

        # Cleanup singleton
        QuotaTracker._instance = None

    def test_initial_state(self, tracker):
        """Test tracker starts with zero usage"""
        stats = tracker.get_all_stats()

        assert stats["providers"]["groq"]["usage"]["requests_today"] == 0
        assert stats["providers"]["groq"]["usage"]["tokens_today"] == 0
        assert stats["providers"]["anthropic"]["usage"]["requests_today"] == 0

    def test_record_request(self, tracker):
        """Test recording a request updates counters"""
        tracker.record_request(
            provider="groq",
            tokens_used=500,
            prompt_tokens=300,
            completion_tokens=200,
            model="test-model",
            success=True,
        )

        stats = tracker.get_all_stats()
        assert stats["providers"]["groq"]["usage"]["requests_today"] == 1
        assert stats["providers"]["groq"]["usage"]["tokens_today"] == 500

    def test_record_multiple_requests(self, tracker):
        """Test multiple requests accumulate correctly"""
        for i in range(5):
            tracker.record_request(
                provider="groq",
                tokens_used=100,
                success=True,
            )

        stats = tracker.get_all_stats()
        assert stats["providers"]["groq"]["usage"]["requests_today"] == 5
        assert stats["providers"]["groq"]["usage"]["tokens_today"] == 500

    def test_check_quota_available(self, tracker):
        """Test quota check when quota is available"""
        result = tracker.check_quota("groq")

        assert result["can_proceed"] is True
        assert result["remaining"]["requests_today"] == DEFAULT_QUOTAS["groq"]["requests_per_day"]

    def test_check_quota_exceeded_daily(self, tracker):
        """Test quota check when daily limit exceeded"""
        # Simulate hitting the daily limit
        tracker.usage["groq"]["requests_today"] = DEFAULT_QUOTAS["groq"]["requests_per_day"]
        tracker.usage["groq"]["day_start"] = datetime.now().date().isoformat()

        result = tracker.check_quota("groq")

        assert result["can_proceed"] is False
        assert "Daily request limit" in result["reason"]

    def test_check_quota_exceeded_minute(self, tracker):
        """Test quota check when per-minute limit exceeded"""
        # Simulate hitting the per-minute limit
        tracker.usage["groq"]["requests_this_minute"] = DEFAULT_QUOTAS["groq"][
            "requests_per_minute"
        ]
        tracker.usage["groq"]["minute_window_start"] = datetime.now().isoformat()

        result = tracker.check_quota("groq")

        assert result["can_proceed"] is False
        assert "Per-minute" in result["reason"]

    def test_unknown_provider(self, tracker):
        """Test handling of unknown provider"""
        result = tracker.check_quota("unknown_provider")

        assert result["can_proceed"] is False
        assert "Unknown provider" in result["reason"]

    def test_record_failed_request(self, tracker):
        """Test recording failed requests"""
        tracker.record_request(
            provider="groq",
            tokens_used=0,
            success=False,
            error="Rate limit exceeded",
        )

        stats = tracker.get_all_stats()
        assert stats["providers"]["groq"]["usage"]["requests_today"] == 1
        # Failed requests still count toward quota

    def test_persistence(self, tracker):
        """Test data persists to file"""
        tracker.record_request(provider="groq", tokens_used=100, success=True)

        # Check file was created
        storage_path = tracker.storage_path
        assert storage_path.exists()

        # Load and verify content
        with open(storage_path) as f:
            data = json.load(f)

        assert data["groq"]["requests_today"] == 1
        assert data["groq"]["tokens_today"] == 100

    def test_status_healthy(self, tracker):
        """Test status is healthy when usage is low"""
        stats = tracker.get_all_stats()
        assert stats["providers"]["groq"]["status"] == "healthy"

    def test_status_warning(self, tracker):
        """Test status is warning when usage is high"""
        # Set usage to 75%
        limit = DEFAULT_QUOTAS["groq"]["requests_per_day"]
        tracker.usage["groq"]["requests_today"] = int(limit * 0.75)
        tracker.usage["groq"]["day_start"] = datetime.now().date().isoformat()

        stats = tracker.get_all_stats()
        assert stats["providers"]["groq"]["status"] == "warning"

    def test_status_critical(self, tracker):
        """Test status is critical when usage is very high"""
        # Set usage to 95%
        limit = DEFAULT_QUOTAS["groq"]["requests_per_day"]
        tracker.usage["groq"]["requests_today"] = int(limit * 0.95)
        tracker.usage["groq"]["day_start"] = datetime.now().date().isoformat()

        stats = tracker.get_all_stats()
        assert stats["providers"]["groq"]["status"] == "critical"

    def test_recommendations_healthy(self, tracker):
        """Test recommendations when quota is healthy"""
        stats = tracker.get_all_stats()
        assert any("saudável" in r.lower() for r in stats["recommendations"])

    def test_reset_daily_counters(self, tracker):
        """Test resetting daily counters"""
        tracker.record_request(provider="groq", tokens_used=1000, success=True)

        tracker.reset_daily_counters("groq")

        stats = tracker.get_all_stats()
        assert stats["providers"]["groq"]["usage"]["requests_today"] == 0
        assert stats["providers"]["groq"]["usage"]["tokens_today"] == 0

    def test_history_limited_to_100(self, tracker):
        """Test that history is limited to 100 entries"""
        for i in range(150):
            tracker.record_request(provider="groq", tokens_used=10, success=True)

        assert len(tracker.usage["groq"]["history"]) <= 100


class TestGetQuotaTracker:
    """Tests for singleton getter"""

    def test_returns_same_instance(self):
        """Test that get_quota_tracker returns singleton"""
        # Reset singleton first
        QuotaTracker._instance = None

        tracker1 = get_quota_tracker()
        tracker2 = get_quota_tracker()

        assert tracker1 is tracker2

        # Cleanup
        QuotaTracker._instance = None
