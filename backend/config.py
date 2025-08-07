"""
Configuration management for MonkeyOCR WebApp Backend
"""
import os
from typing import Optional
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Settings(BaseSettings):
    """Application settings with environment variable support"""
    
    # LLM Configuration for Translation
    llm_base_url: str = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
    llm_api_key: str = os.getenv("LLM_API_KEY", "")
    llm_model_name: str = os.getenv("LLM_MODEL_NAME", "gpt-4.1-nano")
    translation_cache_ttl: int = int(os.getenv("TRANSLATION_CACHE_TTL", "3600"))
    
    # MonkeyOCR Configuration
    monkeyocr_api_key: str = os.getenv("MONKEYOCR_API_KEY", "")
    
    # Application Settings
    debug: bool = os.getenv("DEBUG", "True").lower() == "true"
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    
    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings()


def get_llm_config() -> dict:
    """Get LLM configuration for API calls"""
    return {
        "base_url": settings.llm_base_url,
        "api_key": settings.llm_api_key,
        "model": settings.llm_model_name
    }


def validate_llm_config() -> bool:
    """Validate that LLM configuration is complete"""
    return bool(settings.llm_api_key and settings.llm_base_url)