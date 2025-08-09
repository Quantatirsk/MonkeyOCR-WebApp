"""
Database configuration module
"""

import os
from pathlib import Path
from typing import Dict, Any

# Base paths
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
BACKUP_DIR = DATA_DIR / "backups"

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
BACKUP_DIR.mkdir(parents=True, exist_ok=True)


class DatabaseConfig:
    """
    SQLite database configuration
    """
    
    # Database paths
    DATABASE_PATH = os.getenv("DATABASE_PATH", str(DATA_DIR / "monkeyocr.db"))
    DATABASE_URL = f"sqlite+aiosqlite:///{DATABASE_PATH}"
    
    # Connection pool settings
    POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "5"))
    MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "10"))
    POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "30"))
    
    # SQLite optimizations
    PRAGMAS = {
        "journal_mode": "WAL",  # Write-Ahead Logging for better concurrency
        "foreign_keys": "ON",  # Enable foreign key constraints
        "synchronous": "NORMAL",  # Balance between safety and speed
        "cache_size": -64000,  # 64MB cache (negative means KB)
        "page_size": 4096,  # 4KB page size
        "temp_store": "MEMORY",  # Use memory for temporary tables
        "mmap_size": 268435456,  # 256MB memory-mapped I/O
        "busy_timeout": 5000,  # 5 seconds timeout for locks
    }
    
    # Backup settings
    BACKUP_ENABLED = os.getenv("DB_BACKUP_ENABLED", "true").lower() == "true"
    BACKUP_INTERVAL_HOURS = int(os.getenv("DB_BACKUP_INTERVAL", "24"))
    BACKUP_RETENTION_DAYS = int(os.getenv("DB_BACKUP_RETENTION", "7"))
    BACKUP_PATH = str(BACKUP_DIR)
    
    # Performance settings
    VACUUM_ENABLED = os.getenv("DB_VACUUM_ENABLED", "true").lower() == "true"
    VACUUM_INTERVAL_DAYS = int(os.getenv("DB_VACUUM_INTERVAL", "7"))
    
    # Query optimization
    EXPLAIN_ANALYZE = os.getenv("DB_EXPLAIN_ANALYZE", "false").lower() == "true"
    SLOW_QUERY_LOG = os.getenv("DB_SLOW_QUERY_LOG", "false").lower() == "true"
    SLOW_QUERY_THRESHOLD_MS = int(os.getenv("DB_SLOW_QUERY_THRESHOLD", "100"))
    
    @classmethod
    def get_connection_string(cls) -> str:
        """Get database connection string"""
        return cls.DATABASE_URL
    
    @classmethod
    def get_pragmas(cls) -> Dict[str, Any]:
        """Get SQLite PRAGMA settings"""
        return cls.PRAGMAS
    
    @classmethod
    def get_backup_config(cls) -> Dict[str, Any]:
        """Get backup configuration"""
        return {
            "enabled": cls.BACKUP_ENABLED,
            "interval_hours": cls.BACKUP_INTERVAL_HOURS,
            "retention_days": cls.BACKUP_RETENTION_DAYS,
            "path": cls.BACKUP_PATH
        }
    
    @classmethod
    def get_performance_config(cls) -> Dict[str, Any]:
        """Get performance configuration"""
        return {
            "vacuum_enabled": cls.VACUUM_ENABLED,
            "vacuum_interval_days": cls.VACUUM_INTERVAL_DAYS,
            "explain_analyze": cls.EXPLAIN_ANALYZE,
            "slow_query_log": cls.SLOW_QUERY_LOG,
            "slow_query_threshold_ms": cls.SLOW_QUERY_THRESHOLD_MS
        }


# Export configuration instance
db_config = DatabaseConfig()