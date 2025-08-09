"""
SQLite Database Connection Manager
Handles database initialization, connection pooling, and basic operations
"""

import aiosqlite
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, Any, List, Dict
import json
from database.optimization import SQLiteOptimizer

logger = logging.getLogger(__name__)


class DatabaseManager:
    """
    Manages SQLite database connections and initialization
    """
    
    def __init__(self, db_path: str = "data/monkeyocr.db"):
        self.db_path = Path(db_path)
        self._initialized = False
        
        # Ensure data directory exists
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        
    async def initialize(self) -> None:
        """
        Initialize database with schema and optimal settings
        """
        if self._initialized:
            return
            
        try:
            async with aiosqlite.connect(str(self.db_path)) as db:
                # Apply comprehensive optimizations (once during initialization)
                logger.info("Initializing database with optimizations...")
                await SQLiteOptimizer.optimize_connection(db)
                
                # Load and execute schema
                schema_path = Path(__file__).parent / "schema.sql"
                if schema_path.exists():
                    with open(schema_path, 'r') as f:
                        schema = f.read()
                    await db.executescript(schema)
                    await db.commit()
                    logger.debug(f"Database schema initialized at {self.db_path}")
                else:
                    logger.warning(f"Schema file not found at {schema_path}")
                
            self._initialized = True
            logger.info(f"Database initialized successfully at {self.db_path}")
            
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            raise
    
    @asynccontextmanager
    async def get_db(self):
        """
        Get a database connection with proper settings
        """
        async with aiosqlite.connect(str(self.db_path)) as db:
            # Enable row factory for dict-like access
            db.row_factory = aiosqlite.Row
            
            # Only set essential connection pragmas, not full optimization
            # Full optimization is done once during initialization
            await db.execute("PRAGMA journal_mode = WAL")
            await db.execute("PRAGMA busy_timeout = 5000")
            await db.execute("PRAGMA foreign_keys = ON")
            
            try:
                yield db
            except Exception as e:
                await db.rollback()
                logger.error(f"Database error: {e}")
                raise
            else:
                await db.commit()
    
    async def execute(self, query: str, params: tuple = ()) -> None:
        """
        Execute a single query
        """
        async with self.get_db() as db:
            await db.execute(query, params)
    
    async def execute_many(self, query: str, params_list: List[tuple]) -> None:
        """
        Execute multiple queries with different parameters
        """
        async with self.get_db() as db:
            await db.executemany(query, params_list)
    
    async def fetch_one(self, query: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
        """
        Fetch a single row
        """
        async with self.get_db() as db:
            cursor = await db.execute(query, params)
            row = await cursor.fetchone()
            return dict(row) if row else None
    
    async def fetch_all(self, query: str, params: tuple = ()) -> List[Dict[str, Any]]:
        """
        Fetch all rows
        """
        async with self.get_db() as db:
            cursor = await db.execute(query, params)
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]
    
    async def insert_returning_id(self, query: str, params: tuple = ()) -> int:
        """
        Insert a row and return the last inserted ID
        """
        async with self.get_db() as db:
            cursor = await db.execute(query, params)
            return cursor.lastrowid
    
    async def table_exists(self, table_name: str) -> bool:
        """
        Check if a table exists
        """
        query = """
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name=?
        """
        result = await self.fetch_one(query, (table_name,))
        return result is not None
    
    async def get_table_info(self, table_name: str) -> List[Dict[str, Any]]:
        """
        Get information about table columns
        """
        query = f"PRAGMA table_info({table_name})"
        async with self.get_db() as db:
            cursor = await db.execute(query)
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]
    
    async def vacuum(self) -> None:
        """
        Optimize database file size
        """
        async with aiosqlite.connect(str(self.db_path)) as db:
            await db.execute("VACUUM")
            logger.info("Database vacuumed successfully")
    
    async def backup(self, backup_path: str) -> None:
        """
        Create a backup of the database
        """
        backup_path = Path(backup_path)
        backup_path.parent.mkdir(parents=True, exist_ok=True)
        
        async with aiosqlite.connect(str(self.db_path)) as source:
            async with aiosqlite.connect(str(backup_path)) as backup:
                await source.backup(backup)
        
        logger.info(f"Database backed up to {backup_path}")
    
    async def get_stats(self) -> Dict[str, Any]:
        """
        Get database statistics
        """
        stats = {}
        
        # Get file size
        if self.db_path.exists():
            stats['file_size_mb'] = self.db_path.stat().st_size / (1024 * 1024)
        
        # Get table counts
        tables = ['users', 'user_sessions', 'processing_tasks', 'task_status_history', 'task_shares']
        for table in tables:
            if await self.table_exists(table):
                count = await self.fetch_one(f"SELECT COUNT(*) as count FROM {table}")
                stats[f'{table}_count'] = count['count'] if count else 0
        
        return stats
    
    def to_json(self, value: Any) -> str:
        """
        Convert a value to JSON string for storage
        """
        return json.dumps(value) if value is not None else None
    
    def from_json(self, value: str) -> Any:
        """
        Convert a JSON string from storage to Python object
        """
        return json.loads(value) if value else None


# Global database manager instance
db_manager: Optional[DatabaseManager] = None


def get_db_manager() -> DatabaseManager:
    """
    Get the global database manager instance
    """
    global db_manager
    if db_manager is None:
        db_manager = DatabaseManager()
    return db_manager


async def init_database() -> DatabaseManager:
    """
    Initialize and return the database manager
    """
    manager = get_db_manager()
    await manager.initialize()
    return manager