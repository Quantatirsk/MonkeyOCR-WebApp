"""
SQLite-based persistence manager
Replaces the JSON file-based persistence with SQLite database
"""

import json
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from pathlib import Path

from models.schemas import ProcessingTask, TaskStatusHistory
from database import get_db_manager

logger = logging.getLogger(__name__)


class SQLitePersistenceManager:
    """
    Task state persistence using SQLite database
    Provides the same interface as the old PersistenceManager for compatibility
    """
    
    def __init__(self):
        self.db = get_db_manager()
    
    async def add_task(self, task: ProcessingTask, user_id: Optional[int] = None) -> None:
        """
        Add a new task to the database
        """
        try:
            # Prepare task data for insertion
            metadata_json = self.db.to_json(task.metadata) if task.metadata else None
            
            query = """
                INSERT INTO processing_tasks (
                    id, user_id, filename, file_type, file_hash, file_size,
                    status, progress, extraction_type, split_pages,
                    total_pages, created_at, metadata, is_public
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            params = (
                task.id,
                user_id,
                task.filename,
                task.file_type,
                task.file_hash,
                task.file_size,
                task.status,
                task.progress,
                task.extraction_type,
                task.split_pages,
                task.total_pages,
                task.created_at,
                metadata_json,
                1 if task.is_public else 0  # Convert boolean to SQLite integer
            )
            
            await self.db.execute(query, params)
            
            # Add initial status history
            await self._add_status_history(task.id, task.status, "Task created")
            
            logger.info(f"Added task {task.id}: {task.filename}")
            
        except Exception as e:
            logger.error(f"Failed to add task {task.id}: {e}")
            raise
    
    async def update_task(self, task_id: str, updates: Dict[str, Any]) -> Optional[ProcessingTask]:
        """
        Update task fields
        """
        try:
            # Build dynamic update query
            set_clauses = []
            params = []
            
            for key, value in updates.items():
                if key == 'metadata':
                    value = self.db.to_json(value)
                elif key == 'status_history':
                    # Skip, handled separately
                    continue
                    
                set_clauses.append(f"{key} = ?")
                params.append(value)
            
            if not set_clauses:
                return await self.get_task(task_id)
            
            # Add task_id for WHERE clause
            params.append(task_id)
            
            query = f"""
                UPDATE processing_tasks 
                SET {', '.join(set_clauses)}
                WHERE id = ?
            """
            
            await self.db.execute(query, tuple(params))
            
            # Handle status change history
            if 'status' in updates:
                message = updates.get('error_message', '') if updates['status'] == 'failed' else None
                await self._add_status_history(task_id, updates['status'], message)
            
            # Return updated task
            return await self.get_task(task_id)
            
        except Exception as e:
            logger.error(f"Failed to update task {task_id}: {e}")
            return None
    
    async def get_task(self, task_id: str) -> Optional[ProcessingTask]:
        """
        Get a task by ID
        """
        try:
            query = "SELECT * FROM processing_tasks WHERE id = ?"
            result = await self.db.fetch_one(query, (task_id,))
            
            if not result:
                return None
            
            # Get status history
            history = await self._get_status_history(task_id)
            
            # Convert to ProcessingTask
            task_data = dict(result)
            task_data['metadata'] = self.db.from_json(task_data.get('metadata'))
            task_data['status_history'] = history
            
            # Ensure all datetime fields are strings
            for field in ['created_at', 'updated_at', 'completed_at', 'processing_started_at']:
                value = task_data.get(field)
                if value:
                    if isinstance(value, str):
                        # Already a string, keep as is
                        pass
                    elif hasattr(value, 'isoformat'):
                        # Has isoformat method (datetime object)
                        task_data[field] = value.isoformat()
                    else:
                        # Convert to string
                        task_data[field] = str(value)
            
            return ProcessingTask(**task_data)
            
        except Exception as e:
            logger.error(f"Failed to get task {task_id}: {e}")
            return None
    
    async def get_all_tasks(self, user_id: Optional[int] = None) -> List[ProcessingTask]:
        """
        Get all tasks, optionally filtered by user
        """
        try:
            if user_id is not None:
                # For authenticated users, only show their own tasks (not public tasks)
                # This ensures proper data isolation between users
                query = """
                    SELECT * FROM processing_tasks 
                    WHERE user_id = ?
                    ORDER BY created_at DESC
                """
                params = (user_id,)
                logger.info(f"Fetching tasks for user_id={user_id}")
            else:
                # For anonymous users, don't show any tasks
                # This prevents data leakage
                query = """
                    SELECT * FROM processing_tasks 
                    WHERE 1=0
                """
                params = ()
                logger.info("Anonymous user - returning no tasks")
            
            results = await self.db.fetch_all(query, params)
            
            tasks = []
            for row in results:
                try:
                    # Get status history for each task
                    history = await self._get_status_history(row['id'])
                    
                    task_data = dict(row)
                    task_data['metadata'] = self.db.from_json(task_data.get('metadata'))
                    task_data['status_history'] = history
                    
                    # Ensure datetime fields are strings
                    for field in ['created_at', 'updated_at', 'completed_at', 'processing_started_at']:
                        value = task_data.get(field)
                        if value:
                            if isinstance(value, str):
                                pass
                            elif hasattr(value, 'isoformat'):
                                task_data[field] = value.isoformat()
                            else:
                                task_data[field] = str(value)
                    
                    tasks.append(ProcessingTask(**task_data))
                except Exception as e:
                    logger.error(f"Failed to parse task data: {e}")
                    continue
            
            return tasks
            
        except Exception as e:
            logger.error(f"Failed to get all tasks: {e}")
            return []
    
    async def delete_task(self, task_id: str) -> bool:
        """
        Delete a task (cascade deletes history and shares)
        """
        try:
            query = "DELETE FROM processing_tasks WHERE id = ?"
            await self.db.execute(query, (task_id,))
            logger.info(f"Deleted task {task_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete task {task_id}: {e}")
            return False
    
    async def get_tasks_by_status(self, status: str, user_id: Optional[int] = None) -> List[ProcessingTask]:
        """
        Get tasks by status
        """
        try:
            if user_id is not None:
                query = """
                    SELECT * FROM processing_tasks 
                    WHERE status = ? AND (user_id = ? OR is_public = 1)
                    ORDER BY created_at DESC
                """
                params = (status, user_id)
            else:
                query = """
                    SELECT * FROM processing_tasks 
                    WHERE status = ? AND (user_id IS NULL OR is_public = 1)
                    ORDER BY created_at DESC
                """
                params = (status,)
            
            results = await self.db.fetch_all(query, params)
            
            tasks = []
            for row in results:
                try:
                    history = await self._get_status_history(row['id'])
                    task_data = dict(row)
                    task_data['metadata'] = self.db.from_json(task_data.get('metadata'))
                    task_data['status_history'] = history
                    
                    # Ensure datetime fields are strings
                    for field in ['created_at', 'updated_at', 'completed_at', 'processing_started_at']:
                        value = task_data.get(field)
                        if value:
                            if isinstance(value, str):
                                pass
                            elif hasattr(value, 'isoformat'):
                                task_data[field] = value.isoformat()
                            else:
                                task_data[field] = str(value)
                    
                    tasks.append(ProcessingTask(**task_data))
                except Exception as e:
                    logger.error(f"Failed to parse task data: {e}")
                    continue
            
            return tasks
            
        except Exception as e:
            logger.error(f"Failed to get tasks by status {status}: {e}")
            return []
    
    async def get_processing_tasks(self) -> List[ProcessingTask]:
        """
        Get all tasks currently processing
        """
        return await self.get_tasks_by_status('processing')
    
    async def get_task_count(self, user_id: Optional[int] = None) -> int:
        """
        Get total task count
        """
        try:
            if user_id is not None:
                query = "SELECT COUNT(*) as count FROM processing_tasks WHERE user_id = ?"
                result = await self.db.fetch_one(query, (user_id,))
            else:
                query = "SELECT COUNT(*) as count FROM processing_tasks"
                result = await self.db.fetch_one(query)
            
            return result['count'] if result else 0
            
        except Exception as e:
            logger.error(f"Failed to get task count: {e}")
            return 0
    
    async def get_task_stats(self, user_id: Optional[int] = None) -> Dict[str, int]:
        """
        Get task statistics
        """
        try:
            base_query = "SELECT status, COUNT(*) as count FROM processing_tasks"
            
            if user_id is not None:
                query = f"{base_query} WHERE user_id = ? GROUP BY status"
                results = await self.db.fetch_all(query, (user_id,))
            else:
                query = f"{base_query} GROUP BY status"
                results = await self.db.fetch_all(query)
            
            stats = {
                'total': 0,
                'pending': 0,
                'processing': 0,
                'completed': 0,
                'failed': 0
            }
            
            for row in results:
                status = row['status']
                count = row['count']
                if status in stats:
                    stats[status] = count
                stats['total'] += count
            
            return stats
            
        except Exception as e:
            logger.error(f"Failed to get task stats: {e}")
            return {'total': 0}
    
    async def validate_data(self) -> Dict[str, Any]:
        """
        Validate database integrity
        """
        try:
            # Check if tables exist
            tables = ['processing_tasks', 'task_status_history', 'users', 'user_sessions', 'task_shares']
            missing_tables = []
            
            for table in tables:
                if not await self.db.table_exists(table):
                    missing_tables.append(table)
            
            # Get database stats
            stats = await self.db.get_stats()
            
            return {
                'valid': len(missing_tables) == 0,
                'errors': missing_tables,
                'stats': stats
            }
            
        except Exception as e:
            logger.error(f"Failed to validate data: {e}")
            return {'valid': False, 'errors': [str(e)]}
    
    async def _add_status_history(self, task_id: str, status: str, message: Optional[str] = None) -> None:
        """
        Add status history entry
        """
        query = """
            INSERT INTO task_status_history (task_id, status, message)
            VALUES (?, ?, ?)
        """
        await self.db.execute(query, (task_id, status, message))
    
    async def get_user_tasks(self, user_id: int) -> List[ProcessingTask]:
        """
        Get tasks for a specific user
        """
        try:
            query = """
                SELECT * FROM processing_tasks 
                WHERE user_id = ?
                ORDER BY created_at DESC
            """
            results = await self.db.fetch_all(query, (user_id,))
            
            tasks = []
            for row in results:
                try:
                    history = await self._get_status_history(row['id'])
                    task_data = dict(row)
                    task_data['metadata'] = self.db.from_json(task_data.get('metadata'))
                    task_data['status_history'] = history
                    
                    # Ensure datetime fields are strings
                    for field in ['created_at', 'updated_at', 'completed_at', 'processing_started_at']:
                        value = task_data.get(field)
                        if value:
                            if isinstance(value, str):
                                pass
                            elif hasattr(value, 'isoformat'):
                                task_data[field] = value.isoformat()
                            else:
                                task_data[field] = str(value)
                    
                    tasks.append(ProcessingTask(**task_data))
                except Exception as e:
                    logger.error(f"Failed to parse task data: {e}")
                    continue
            
            return tasks
            
        except Exception as e:
            logger.error(f"Failed to get user tasks: {e}")
            return []
    
    async def get_public_tasks(self) -> List[ProcessingTask]:
        """
        Get all public tasks
        """
        try:
            query = """
                SELECT * FROM processing_tasks 
                WHERE is_public = 1
                ORDER BY created_at DESC
            """
            results = await self.db.fetch_all(query, ())
            
            tasks = []
            for row in results:
                try:
                    history = await self._get_status_history(row['id'])
                    task_data = dict(row)
                    task_data['metadata'] = self.db.from_json(task_data.get('metadata'))
                    task_data['status_history'] = history
                    
                    # Ensure datetime fields are strings
                    for field in ['created_at', 'updated_at', 'completed_at', 'processing_started_at']:
                        value = task_data.get(field)
                        if value:
                            if isinstance(value, str):
                                pass
                            elif hasattr(value, 'isoformat'):
                                task_data[field] = value.isoformat()
                            else:
                                task_data[field] = str(value)
                    
                    tasks.append(ProcessingTask(**task_data))
                except Exception as e:
                    logger.error(f"Failed to parse task data: {e}")
                    continue
            
            return tasks
            
        except Exception as e:
            logger.error(f"Failed to get public tasks: {e}")
            return []
    
    async def _get_status_history(self, task_id: str) -> List[TaskStatusHistory]:
        """
        Get status history for a task
        """
        query = """
            SELECT status, message, timestamp 
            FROM task_status_history 
            WHERE task_id = ?
            ORDER BY timestamp ASC
        """
        results = await self.db.fetch_all(query, (task_id,))
        
        history = []
        for row in results:
            history.append(TaskStatusHistory(
                status=row['status'],
                message=row['message'],
                timestamp=row['timestamp'].isoformat() if hasattr(row['timestamp'], 'isoformat') else str(row['timestamp']) if row['timestamp'] else None
            ))
        
        return history
    
    def force_save(self) -> None:
        """
        Compatibility method - no longer needed with SQLite
        """
        pass


# Global persistence manager instance
_persistence_manager: Optional[SQLitePersistenceManager] = None


def get_persistence_manager() -> SQLitePersistenceManager:
    """
    Get the global persistence manager instance
    """
    global _persistence_manager
    if _persistence_manager is None:
        _persistence_manager = SQLitePersistenceManager()
    return _persistence_manager


async def init_persistence() -> SQLitePersistenceManager:
    """
    Initialize persistence manager
    """
    # Initialize database first
    from database import init_database
    await init_database()
    
    # Return persistence manager
    return get_persistence_manager()