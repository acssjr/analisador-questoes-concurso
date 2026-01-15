# tests/models/test_prova.py
from src.models.prova import Prova


def test_prova_has_queue_status_fields():
    """Prova model should have queue processing fields"""
    prova = Prova(nome="Test Prova")

    # Queue status fields
    assert hasattr(prova, "queue_status")
    assert hasattr(prova, "queue_error")
    assert hasattr(prova, "queue_retry_count")
    assert hasattr(prova, "queue_checkpoint")
    assert hasattr(prova, "confianca_media")

    # Default values
    assert prova.queue_status == "pending"
    assert prova.queue_retry_count == 0
