"""
SQLite optimization module for performance tuning
Configures SQLite for optimal performance with WAL mode and other optimizations
"""

import logging
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import aiosqlite
from pathlib import Path

logger = logging.getLogger(__name__)


class SQLiteOptimizer:
    """
    SQLite performance optimizer
    Applies best practices for concurrent access and performance
    """
    
    # Optimal PRAGMA settings for web applications
    PRAGMAS = {
        # === Concurrency & Performance ===
        "journal_mode": "WAL",  # Write-Ahead Logging for better concurrency
        "synchronous": "NORMAL",  # Balance between safety and speed
        "temp_store": "MEMORY",  # Use memory for temporary tables
        "mmap_size": 268435456,  # 256MB memory-mapped I/O
        "cache_size": -64000,  # 64MB cache (negative = KB)
        "page_size": 4096,  # 4KB page size (good for most workloads)
        
        # === Reliability & Safety ===
        "foreign_keys": "ON",  # Enable foreign key constraints
        "recursive_triggers": "ON",  # Enable recursive triggers
        "busy_timeout": 5000,  # 5 seconds timeout for locks
        
        # === Query Optimization ===
        "query_only": "OFF",  # Allow writes
        "automatic_index": "ON",  # Allow automatic index creation
        "optimize": None,  # Run ANALYZE periodically (special case)
    }
    
    # WAL mode specific settings
    WAL_SETTINGS = {
        "wal_autocheckpoint": 1000,  # Checkpoint every 1000 pages
        "wal_checkpoint": "TRUNCATE",  # Checkpoint mode
    }
    
    # Analysis and maintenance settings
    MAINTENANCE_SETTINGS = {
        "auto_vacuum": "INCREMENTAL",  # Incremental vacuum
        "incremental_vacuum_pages": 100,  # Pages to vacuum at a time
    }
    
    @classmethod
    async def optimize_connection(cls, connection: aiosqlite.Connection) -> None:
        """
        Apply optimizations to a database connection
        
        Args:
            connection: SQLite connection to optimize
        """
        logger.debug("Applying SQLite optimizations...")
        
        # Apply main PRAGMA settings
        for pragma, value in cls.PRAGMAS.items():
            if value is not None:
                try:
                    await connection.execute(f"PRAGMA {pragma} = {value}")
                    logger.debug(f"Set PRAGMA {pragma} = {value}")
                except Exception as e:
                    logger.warning(f"Failed to set PRAGMA {pragma}: {e}")
        
        # Apply WAL-specific settings
        current_mode = await cls.get_pragma_value(connection, "journal_mode")
        if current_mode == "wal":
            for pragma, value in cls.WAL_SETTINGS.items():
                try:
                    if pragma == "wal_checkpoint":
                        # Special handling for checkpoint
                        await connection.execute(f"PRAGMA wal_checkpoint({value})")
                    else:
                        await connection.execute(f"PRAGMA {pragma} = {value}")
                    logger.debug(f"Set WAL PRAGMA {pragma} = {value}")
                except Exception as e:
                    logger.warning(f"Failed to set WAL PRAGMA {pragma}: {e}")
        
        # Apply maintenance settings
        for pragma, value in cls.MAINTENANCE_SETTINGS.items():
            try:
                await connection.execute(f"PRAGMA {pragma} = {value}")
                logger.debug(f"Set maintenance PRAGMA {pragma} = {value}")
            except Exception as e:
                logger.warning(f"Failed to set maintenance PRAGMA {pragma}: {e}")
        
        await connection.commit()
        logger.debug("SQLite optimizations applied successfully")
    
    @classmethod
    async def analyze_database(cls, connection: aiosqlite.Connection) -> None:
        """
        Run ANALYZE to update query planner statistics
        
        Args:
            connection: SQLite connection
        """
        logger.info("Running ANALYZE on database...")
        try:
            await connection.execute("ANALYZE")
            await connection.commit()
            logger.info("ANALYZE completed successfully")
        except Exception as e:
            logger.error(f"ANALYZE failed: {e}")
    
    @classmethod
    async def vacuum_database(
        cls,
        connection: aiosqlite.Connection,
        incremental: bool = True
    ) -> None:
        """
        Vacuum the database to reclaim space
        
        Args:
            connection: SQLite connection
            incremental: Use incremental vacuum if True
        """
        logger.info(f"Running {'incremental' if incremental else 'full'} VACUUM...")
        try:
            if incremental:
                # Incremental vacuum
                pages = cls.MAINTENANCE_SETTINGS["incremental_vacuum_pages"]
                await connection.execute(f"PRAGMA incremental_vacuum({pages})")
            else:
                # Full vacuum (locks database)
                await connection.execute("VACUUM")
            
            await connection.commit()
            logger.info("VACUUM completed successfully")
        except Exception as e:
            logger.error(f"VACUUM failed: {e}")
    
    @classmethod
    async def checkpoint_wal(
        cls,
        connection: aiosqlite.Connection,
        mode: str = "PASSIVE"
    ) -> Dict[str, int]:
        """
        Perform WAL checkpoint
        
        Args:
            connection: SQLite connection
            mode: Checkpoint mode (PASSIVE, FULL, RESTART, TRUNCATE)
            
        Returns:
            Checkpoint statistics
        """
        logger.info(f"Running WAL checkpoint ({mode})...")
        try:
            cursor = await connection.execute(f"PRAGMA wal_checkpoint({mode})")
            result = await cursor.fetchone()
            
            stats = {
                "busy": result[0] if result else 0,
                "log_frames": result[1] if result and len(result) > 1 else 0,
                "checkpointed_frames": result[2] if result and len(result) > 2 else 0
            }
            
            logger.info(f"WAL checkpoint completed: {stats}")
            return stats
        except Exception as e:
            logger.error(f"WAL checkpoint failed: {e}")
            return {"error": str(e)}
    
    @classmethod
    async def get_pragma_value(
        cls,
        connection: aiosqlite.Connection,
        pragma: str
    ) -> Optional[Any]:
        """
        Get current PRAGMA value
        
        Args:
            connection: SQLite connection
            pragma: PRAGMA name
            
        Returns:
            Current PRAGMA value
        """
        try:
            cursor = await connection.execute(f"PRAGMA {pragma}")
            result = await cursor.fetchone()
            return result[0] if result else None
        except Exception as e:
            logger.error(f"Failed to get PRAGMA {pragma}: {e}")
            return None
    
    @classmethod
    async def get_database_stats(
        cls,
        connection: aiosqlite.Connection
    ) -> Dict[str, Any]:
        """
        Get database statistics
        
        Args:
            connection: SQLite connection
            
        Returns:
            Database statistics
        """
        stats = {}
        
        # Get basic stats
        pragmas_to_check = [
            "page_count",
            "page_size",
            "cache_size",
            "journal_mode",
            "synchronous",
            "wal_autocheckpoint",
            "freelist_count",
            "cache_hit",
            "cache_miss",
            "cache_spill"
        ]
        
        for pragma in pragmas_to_check:
            value = await cls.get_pragma_value(connection, pragma)
            if value is not None:
                stats[pragma] = value
        
        # Calculate database size
        if "page_count" in stats and "page_size" in stats:
            stats["database_size_bytes"] = stats["page_count"] * stats["page_size"]
            stats["database_size_mb"] = round(stats["database_size_bytes"] / (1024 * 1024), 2)
        
        # Calculate cache hit rate
        if "cache_hit" in stats and "cache_miss" in stats:
            total = stats["cache_hit"] + stats["cache_miss"]
            if total > 0:
                stats["cache_hit_rate"] = round((stats["cache_hit"] / total) * 100, 2)
        
        # Get table counts
        try:
            cursor = await connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            )
            tables = await cursor.fetchall()
            
            stats["tables"] = {}
            for (table_name,) in tables:
                cursor = await connection.execute(f"SELECT COUNT(*) FROM {table_name}")
                count = await cursor.fetchone()
                stats["tables"][table_name] = count[0] if count else 0
        except Exception as e:
            logger.error(f"Failed to get table counts: {e}")
        
        return stats
    
    @classmethod
    async def optimize_queries(cls, connection: aiosqlite.Connection) -> None:
        """
        Optimize common queries with proper indexes
        
        Args:
            connection: SQLite connection
        """
        logger.info("Optimizing query performance with indexes...")
        
        # Additional indexes for performance
        performance_indexes = [
            # User queries
            "CREATE INDEX IF NOT EXISTS idx_users_email_active ON users(email) WHERE is_active = 1",
            "CREATE INDEX IF NOT EXISTS idx_users_username_active ON users(username) WHERE is_active = 1",
            
            # Session queries
            "CREATE INDEX IF NOT EXISTS idx_sessions_token_expires ON user_sessions(session_token, expires_at)",
            "CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON user_sessions(user_id) WHERE revoked_at IS NULL",
            
            # Task queries
            "CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON processing_tasks(user_id, status)",
            "CREATE INDEX IF NOT EXISTS idx_tasks_public ON processing_tasks(is_public) WHERE is_public = 1",
            "CREATE INDEX IF NOT EXISTS idx_tasks_created_desc ON processing_tasks(created_at DESC)",
            
            # Task shares
            "CREATE INDEX IF NOT EXISTS idx_shares_task_user ON task_shares(task_id, shared_with_user_id)",
            "CREATE INDEX IF NOT EXISTS idx_shares_user ON task_shares(shared_with_user_id)",
            
            # Status history
            "CREATE INDEX IF NOT EXISTS idx_history_task_time ON task_status_history(task_id, timestamp DESC)"
        ]
        
        for index_sql in performance_indexes:
            try:
                await connection.execute(index_sql)
                logger.debug(f"Created index: {index_sql[:50]}...")
            except Exception as e:
                logger.warning(f"Failed to create index: {e}")
        
        await connection.commit()
        logger.info("Query optimization completed")
    
    @classmethod
    async def setup_triggers(cls, connection: aiosqlite.Connection) -> None:
        """
        Set up database triggers for automatic maintenance
        
        Args:
            connection: SQLite connection
        """
        logger.info("Setting up database triggers...")
        
        triggers = [
            # Clean up expired sessions
            """
            CREATE TRIGGER IF NOT EXISTS cleanup_expired_sessions
            AFTER INSERT ON user_sessions
            BEGIN
                DELETE FROM user_sessions 
                WHERE expires_at < CURRENT_TIMESTAMP 
                AND revoked_at IS NULL
                AND id != NEW.id;
            END
            """
        ]
        
        for trigger_sql in triggers:
            try:
                await connection.execute(trigger_sql)
                logger.debug("Created trigger")
            except Exception as e:
                logger.warning(f"Failed to create trigger: {e}")
        
        await connection.commit()
        logger.info("Triggers set up successfully")
    
    @classmethod
    async def configure_for_testing(cls, connection: aiosqlite.Connection) -> None:
        """
        Configure SQLite for testing (in-memory optimizations)
        
        Args:
            connection: SQLite connection
        """
        test_pragmas = {
            "synchronous": "OFF",  # No sync for tests
            "journal_mode": "MEMORY",  # In-memory journal
            "temp_store": "MEMORY",
            "cache_size": -16000,  # 16MB cache for tests
            "foreign_keys": "ON"
        }
        
        for pragma, value in test_pragmas.items():
            await connection.execute(f"PRAGMA {pragma} = {value}")
        
        await connection.commit()
        logger.info("Configured SQLite for testing")


class MaintenanceScheduler:
    """
    Schedule and run database maintenance tasks
    """
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.last_analyze = datetime.utcnow()
        self.last_vacuum = datetime.utcnow()
        self.last_checkpoint = datetime.utcnow()
    
    async def run_maintenance(self, force: bool = False) -> Dict[str, Any]:
        """
        Run scheduled maintenance tasks
        
        Args:
            force: Force all maintenance tasks
            
        Returns:
            Maintenance results
        """
        results = {}
        
        async with aiosqlite.connect(self.db_path) as conn:
            optimizer = SQLiteOptimizer()
            
            # Apply optimizations
            await optimizer.optimize_connection(conn)
            
            # Run ANALYZE (daily)
            if force or (datetime.utcnow() - self.last_analyze) > timedelta(days=1):
                await optimizer.analyze_database(conn)
                self.last_analyze = datetime.utcnow()
                results["analyze"] = "completed"
            
            # Run incremental VACUUM (hourly)
            if force or (datetime.utcnow() - self.last_vacuum) > timedelta(hours=1):
                await optimizer.vacuum_database(conn, incremental=True)
                self.last_vacuum = datetime.utcnow()
                results["vacuum"] = "incremental"
            
            # Run WAL checkpoint (every 30 minutes)
            if force or (datetime.utcnow() - self.last_checkpoint) > timedelta(minutes=30):
                checkpoint_stats = await optimizer.checkpoint_wal(conn, mode="PASSIVE")
                self.last_checkpoint = datetime.utcnow()
                results["checkpoint"] = checkpoint_stats
            
            # Get current stats
            results["stats"] = await optimizer.get_database_stats(conn)
        
        return results
    
    async def full_optimization(self) -> Dict[str, Any]:
        """
        Run full database optimization (use sparingly)
        
        Returns:
            Optimization results
        """
        results = {}
        
        async with aiosqlite.connect(self.db_path) as conn:
            optimizer = SQLiteOptimizer()
            
            # Full optimization sequence
            await optimizer.optimize_connection(conn)
            await optimizer.optimize_queries(conn)
            await optimizer.setup_triggers(conn)
            await optimizer.analyze_database(conn)
            await optimizer.vacuum_database(conn, incremental=False)
            checkpoint_stats = await optimizer.checkpoint_wal(conn, mode="TRUNCATE")
            
            results["checkpoint"] = checkpoint_stats
            results["stats"] = await optimizer.get_database_stats(conn)
            results["status"] = "optimized"
        
        return results