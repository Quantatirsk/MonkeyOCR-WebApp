"""
Configuration management for MonkeyOCR WebApp Backend
"""
import os
from typing import Optional
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load environment variables from .env file in project root
# Try parent directory first (project root), then current directory
from pathlib import Path
root_env = Path(__file__).parent.parent / '.env'
if root_env.exists():
    load_dotenv(root_env)
else:
    load_dotenv()  # Fallback to current directory


class Settings(BaseSettings):
    """Application settings with environment variable support"""
    
    # LLM Configuration
    llm_base_url: str = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
    llm_api_key: str = os.getenv("LLM_API_KEY", "")
    llm_model_name: str = os.getenv("LLM_MODEL_NAME", "gpt-4.1-nano")
    
    # MonkeyOCR Configuration
    monkeyocr_api_key: str = os.getenv("MONKEYOCR_API_KEY", "")
    
    # Application Settings
    debug: bool = os.getenv("DEBUG", "True").lower() == "true"
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    
    # Redis Configuration
    redis_enabled: bool = os.getenv("REDIS_ENABLED", "False").lower() == "true"
    redis_host: str = os.getenv("REDIS_HOST", "redis")
    redis_port: int = int(os.getenv("REDIS_PORT", "6379"))
    redis_db: int = int(os.getenv("REDIS_DB", "0"))
    redis_password: Optional[str] = os.getenv("REDIS_PASSWORD", None)
    redis_url: Optional[str] = os.getenv("REDIS_URL", None)
    
    class Config:
        env_file = "../.env"  # Read from project root
        case_sensitive = False
        extra = "ignore"  # Ignore extra fields from .env
    
    @property
    def get_redis_url(self) -> str:
        """Get Redis connection URL"""
        if self.redis_url:
            return self.redis_url
        if self.redis_password:
            return f"redis://:{self.redis_password}@{self.redis_host}:{self.redis_port}/{self.redis_db}"
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"


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