"""
Configuration management using Pydantic Settings
"""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    env: Literal["development", "production", "test"] = "development"
    debug: bool = True
    log_level: str = "INFO"

    # Database
    database_url: str = Field(
        default="sqlite+aiosqlite:///./data/questoes.db",
        description="Database connection URL",
    )

    # LLM APIs
    groq_api_key: str = Field(default="", description="Groq API key")
    anthropic_api_key: str = Field(default="", description="Anthropic Claude API key")
    huggingface_api_key: str = Field(default="", description="Hugging Face API key")

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # Processing
    max_workers: int = Field(default=4, description="Max parallel workers")
    batch_size: int = Field(default=10, description="Batch size for processing")

    # Paths
    @property
    def base_dir(self) -> Path:
        """Base directory of the project"""
        return Path(__file__).parent.parent.parent

    @property
    def data_dir(self) -> Path:
        """Data directory"""
        return self.base_dir / "data"

    @property
    def raw_data_dir(self) -> Path:
        """Raw data directory"""
        return self.data_dir / "raw"

    @property
    def processed_data_dir(self) -> Path:
        """Processed data directory"""
        return self.data_dir / "processed"

    @property
    def outputs_dir(self) -> Path:
        """Outputs directory"""
        return self.data_dir / "outputs"

    # LLM Settings
    default_llm_provider: str = "groq"
    default_text_model: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    default_vision_model: str = "claude-3-5-sonnet-20241022"
    llm_temperature: float = 0.1
    llm_max_tokens: int = 4096

    # Embeddings
    embedding_model: str = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"
    embedding_dimension: int = 768

    # Clustering
    similarity_threshold: float = 0.75
    min_cluster_size: int = 2


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
