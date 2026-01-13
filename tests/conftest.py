"""
Pytest configuration and fixtures
"""
import asyncio
from typing import AsyncGenerator, Generator
from unittest.mock import MagicMock, patch

import pytest

# Optional database imports - only required for DB tests
try:
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
    from sqlalchemy.orm import sessionmaker
    from src.core.database import Base
    HAS_SQLALCHEMY = True
except ImportError:
    HAS_SQLALCHEMY = False
    AsyncSession = None


# Test database URL (in-memory SQLite)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def test_db() -> AsyncGenerator:
    """Create test database session"""
    if not HAS_SQLALCHEMY:
        pytest.skip("SQLAlchemy not installed")

    engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture
def mock_llm_response():
    """Mock LLM response for classification"""
    return {
        "content": """{
            "disciplina": "Língua Portuguesa",
            "assunto": "Sintaxe",
            "topico": "Período Composto",
            "subtopico": "Orações Subordinadas",
            "conceito_especifico": "Orações subordinadas adverbiais concessivas",
            "item_edital_path": "Língua Portuguesa > Sintaxe > Período Composto",
            "confianca_disciplina": 0.95,
            "confianca_assunto": 0.88,
            "confianca_topico": 0.75,
            "confianca_subtopico": 0.65,
            "conceito_testado": "Identificação de orações subordinadas adverbiais",
            "habilidade_bloom": "analisar",
            "nivel_dificuldade": "intermediario",
            "fora_taxonomia": false,
            "motivo_fora_taxonomia": null
        }""",
        "model": "test-model",
        "tokens": {"prompt": 500, "completion": 200, "total": 700},
        "provider": "groq",
    }


@pytest.fixture
def sample_questao():
    """Sample question for testing"""
    return {
        "numero": 1,
        "disciplina": "Português",
        "assunto_pci": "Sintaxe",
        "enunciado": "Assinale a alternativa que apresenta uma oração subordinada adverbial concessiva.",
        "alternativas": {
            "A": "Embora estivesse cansado, continuou trabalhando.",
            "B": "O aluno estudou tanto que passou no concurso.",
            "C": "Se você estudar, passará no concurso.",
            "D": "Quando chegou, todos já haviam saído.",
            "E": "O livro que comprei é muito bom.",
        },
        "gabarito": "A",
        "anulada": False,
    }


@pytest.fixture
def sample_taxonomia():
    """Sample edital taxonomy for testing"""
    return {
        "disciplinas": [
            {
                "nome": "Língua Portuguesa",
                "itens": [
                    {
                        "id": "1",
                        "texto": "Compreensão e interpretação de textos",
                        "filhos": [],
                    },
                    {
                        "id": "2",
                        "texto": "Sintaxe",
                        "filhos": [
                            {"id": "2.1", "texto": "Período Simples", "filhos": []},
                            {"id": "2.2", "texto": "Período Composto", "filhos": []},
                        ],
                    },
                ],
            },
            {
                "nome": "Raciocínio Lógico",
                "itens": [
                    {"id": "1", "texto": "Proposições", "filhos": []},
                    {"id": "2", "texto": "Conectivos lógicos", "filhos": []},
                ],
            },
        ]
    }


@pytest.fixture
def mock_groq_client():
    """Mock Groq client"""
    with patch("src.llm.providers.groq_client.GroqClient") as mock:
        instance = MagicMock()
        mock.return_value = instance
        yield instance


@pytest.fixture
def mock_anthropic_client():
    """Mock Anthropic client"""
    with patch("src.llm.providers.anthropic_client.AnthropicClient") as mock:
        instance = MagicMock()
        mock.return_value = instance
        yield instance
