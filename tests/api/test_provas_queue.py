# tests/api/test_provas_queue.py
"""
Tests for the queue status endpoint in provas routes.
"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from src.api.main import app
from src.core.database import Base, get_db

# Import all models to ensure they are registered with Base.metadata
from src.models import Classificacao, Edital, Projeto, Prova, Questao  # noqa: F401

# Test database URL (in-memory SQLite)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def test_db():
    """Create a fresh test database for each test"""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with async_session() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    app.dependency_overrides[get_db] = override_get_db

    yield async_session

    app.dependency_overrides.clear()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.mark.asyncio
async def test_get_queue_status(test_db):
    """Should return queue status for all provas in a project"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # This will return empty list or 404 without a real project
        response = await ac.get("/api/provas/queue-status")

        # Should return valid response structure
        assert response.status_code in [200, 404]

        if response.status_code == 200:
            data = response.json()
            assert "provas" in data or "items" in data


@pytest.mark.asyncio
async def test_get_queue_status_returns_items_structure(test_db):
    """Should return items array with expected fields"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/provas/queue-status")

        # Endpoint should exist and return 200
        assert response.status_code == 200

        data = response.json()
        assert "items" in data
        assert isinstance(data["items"], list)


@pytest.mark.asyncio
async def test_get_queue_status_with_projeto_id(test_db):
    """Should accept optional projeto_id query parameter"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Using a random UUID - should return empty list, not error
        response = await ac.get(
            "/api/provas/queue-status",
            params={"projeto_id": "00000000-0000-0000-0000-000000000000"},
        )

        # Should accept the parameter without error
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert isinstance(data["items"], list)


@pytest.mark.asyncio
async def test_get_queue_status_with_prova_data(test_db):
    """Should return prova queue data with correct fields"""
    # Create a test prova
    async with test_db() as session:
        prova = Prova(
            nome="Test Prova",
            banca="Test Banca",
            ano=2024,
            queue_status="processing",
            queue_checkpoint="validated",
            queue_retry_count=1,
            total_questoes=10,
            confianca_media=85.5,
        )
        session.add(prova)
        await session.commit()
        prova_id = prova.id

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/provas/queue-status")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert len(data["items"]) == 1

        item = data["items"][0]
        assert item["id"] == str(prova_id)
        assert item["nome"] == "Test Prova"
        assert item["queue_status"] == "processing"
        assert item["queue_checkpoint"] == "validated"
        assert item["queue_retry_count"] == 1
        assert item["total_questoes"] == 10
        assert item["confianca_media"] == 85.5
