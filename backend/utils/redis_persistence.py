"""
Redis-based persistence manager for task storage
Provides high-performance task management with Redis backend
"""

import json
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import asyncio
from models.schemas import ProcessingTask, TaskStatusHistory
from utils.redis_client import CacheManager, TaskStorage

logger = logging.getLogger(__name__)


class RedisPersistenceManager:
    """
    Redis-based task persistence manager
    Provides async interface for task management with Redis backend
    """
    
    def __init__(self, ttl: int = 86400):  # 24 hours default TTL
        self.ttl = ttl
        self.task_prefix = "task"
        self.task_list_key = "task:list"
    
    async def save_task(self, task: ProcessingTask) -> bool:
        """Save task to Redis"""
        try:
            task_data = task.model_dump(mode='json')
            success = await TaskStorage.save_task(task.id, task_data, self.ttl)
            
            # Also maintain a list of task IDs
            if success:
                await self._add_to_task_list(task.id)
            
            return success
        except Exception as e:
            logger.error(f"Failed to save task {task.id} to Redis: {e}")
            return False
    
    async def get_task(self, task_id: str) -> Optional[ProcessingTask]:
        """Get task from Redis"""
        try:
            task_data = await TaskStorage.get_task(task_id)
            if task_data:
                return ProcessingTask(**task_data)
            return None
        except Exception as e:
            logger.error(f"Failed to get task {task_id} from Redis: {e}")
            return None
    
    async def update_task_status(
        self, 
        task_id: str, 
        status: str, 
        progress: Optional[int] = None,
        result: Optional[Dict] = None
    ) -> bool:
        """Update task status in Redis"""
        try:
            task = await self.get_task(task_id)
            if task:
                task.status = status
                if progress is not None:
                    task.progress = progress
                if result is not None:
                    task.result = result
                task.updated_at = datetime.utcnow()
                
                return await self.save_task(task)
            return False
        except Exception as e:
            logger.error(f"Failed to update task {task_id} status: {e}")
            return False
    
    async def get_all_tasks(self) -> List[ProcessingTask]:
        """Get all tasks from Redis"""
        try:
            task_ids = await self._get_task_list()
            tasks = []
            
            for task_id in task_ids:
                task = await self.get_task(task_id)
                if task:
                    tasks.append(task)
            
            return tasks
        except Exception as e:
            logger.error(f"Failed to get all tasks from Redis: {e}")
            return []
    
    async def get_processing_tasks(self) -> List[ProcessingTask]:
        """Get all processing tasks"""
        try:
            all_tasks = await self.get_all_tasks()
            return [t for t in all_tasks if t.status == "processing"]
        except Exception as e:
            logger.error(f"Failed to get processing tasks: {e}")
            return []
    
    async def delete_task(self, task_id: str) -> bool:
        """Delete task from Redis"""
        try:
            success = await TaskStorage.delete_task(task_id)
            if success:
                await self._remove_from_task_list(task_id)
            return success
        except Exception as e:
            logger.error(f"Failed to delete task {task_id}: {e}")
            return False
    
    async def cleanup_old_tasks(self, days: int = 7) -> int:
        """Cleanup tasks older than specified days"""
        try:
            all_tasks = await self.get_all_tasks()
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            deleted_count = 0
            
            for task in all_tasks:
                if task.created_at < cutoff_date and task.status in ["completed", "failed"]:
                    if await self.delete_task(task.id):
                        deleted_count += 1
            
            logger.info(f"Cleaned up {deleted_count} old tasks")
            return deleted_count
        except Exception as e:
            logger.error(f"Failed to cleanup old tasks: {e}")
            return 0
    
    async def get_task_stats(self) -> Dict[str, int]:
        """Get task statistics"""
        try:
            all_tasks = await self.get_all_tasks()
            stats = {
                "total": len(all_tasks),
                "pending": 0,
                "processing": 0,
                "completed": 0,
                "failed": 0
            }
            
            for task in all_tasks:
                if task.status in stats:
                    stats[task.status] += 1
            
            return stats
        except Exception as e:
            logger.error(f"Failed to get task stats: {e}")
            return {"total": 0, "pending": 0, "processing": 0, "completed": 0, "failed": 0}
    
    # Private methods for task list management
    async def _add_to_task_list(self, task_id: str) -> bool:
        """Add task ID to the task list"""
        try:
            task_ids = await self._get_task_list()
            if task_id not in task_ids:
                task_ids.append(task_id)
                return await CacheManager.set_json(self.task_list_key, task_ids, self.ttl * 7)  # Longer TTL for list
            return True
        except Exception as e:
            logger.error(f"Failed to add task {task_id} to list: {e}")
            return False
    
    async def _remove_from_task_list(self, task_id: str) -> bool:
        """Remove task ID from the task list"""
        try:
            task_ids = await self._get_task_list()
            if task_id in task_ids:
                task_ids.remove(task_id)
                return await CacheManager.set_json(self.task_list_key, task_ids, self.ttl * 7)
            return True
        except Exception as e:
            logger.error(f"Failed to remove task {task_id} from list: {e}")
            return False
    
    async def _get_task_list(self) -> List[str]:
        """Get list of all task IDs"""
        try:
            task_ids = await CacheManager.get_json(self.task_list_key)
            return task_ids if task_ids else []
        except Exception as e:
            logger.error(f"Failed to get task list: {e}")
            return []