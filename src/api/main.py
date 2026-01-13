"""
FastAPI application
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from src.api.routes import analise, classificacao, editais, projetos, provas, questoes, relatorios, sistema, upload
from src.core.config import get_settings
from src.core.database import close_db, init_db

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager"""
    # Startup
    logger.info("Starting API...")
    await init_db()
    logger.info("Database initialized")
    yield
    # Shutdown
    logger.info("Shutting down API...")
    await close_db()
    logger.info("API shutdown complete")


app = FastAPI(
    title="Analisador de Questões de Concurso",
    description="API para análise forense de questões de concurso com IA",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(projetos.router, prefix="/api/projetos", tags=["Projetos"])
app.include_router(editais.router, prefix="/api/editais", tags=["Editais"])
app.include_router(upload.router, prefix="/api/upload", tags=["Upload"])
app.include_router(provas.router, prefix="/api/provas", tags=["Provas"])
app.include_router(questoes.router, prefix="/api/questoes", tags=["Questões"])
app.include_router(classificacao.router, prefix="/api/classificacao", tags=["Classificação"])
app.include_router(analise.router, prefix="/api/analise", tags=["Análise"])
app.include_router(relatorios.router, prefix="/api/relatorios", tags=["Relatórios"])
app.include_router(sistema.router, prefix="/api/sistema", tags=["Sistema"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Analisador de Questões de Concurso API",
        "version": "0.1.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}
