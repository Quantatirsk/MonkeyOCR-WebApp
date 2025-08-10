"""
Task repository for OCR task management
"""

import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from database import DatabaseManager
from .base import BaseRepository

logger = logging.getLogger(__name__)


class TaskRepository(BaseRepository):
    """
    Repository for processing task operations
    """
    
    def __init__(self, db_manager: DatabaseManager):
        super().__init__(db_manager, "processing_tasks")
    
    async def create_task(
        self,
        task_id: str,
        user_id: Optional[int],
        filename: str,
        file_type: str,
        file_hash: Optional[str] = None,
        file_size: Optional[int] = None,
        extraction_type: Optional[str] = None,
        split_pages: bool = False,
        is_public: bool = False
    ) -> str:
        """
        Create a new processing task
        """
        data = {
            "id": task_id,
            "user_id": user_id,
            "filename": filename,
            "file_type": file_type,
            "file_hash": file_hash,
            "file_size": file_size,
            "status": "pending",
            "progress": 0,
            "extraction_type": extraction_type,
            "split_pages": 1 if split_pages else 0,
            "is_public": 1 if is_public else 0,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        # Insert task (id is string, not auto-increment)
        query = f"""
            INSERT INTO {self.table_name} ({', '.join(data.keys())})
            VALUES ({', '.join(['?' for _ in data])})
        """
        await self.db.execute(query, tuple(data.values()))
        return task_id
    
    async def get_user_tasks(
        self,
        user_id: int,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get tasks for a specific user
        """
        query = f"""
            SELECT * FROM {self.table_name}
            WHERE user_id = ?
        """
        params = [user_id]
        
        if status:
            query += " AND status = ?"
            params.append(status)
        
        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        return await self.db.fetch_all(query, tuple(params))
    
    async def get_public_tasks(
        self,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get all public tasks
        """
        query = f"""
            SELECT * FROM {self.table_name}
            WHERE is_public = 1
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        """
        return await self.db.fetch_all(query, (limit, offset))
    
    async def get_task_by_id(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Get task by ID
        """
        return await self.get_by_id("id", task_id)
    
    async def update_task_status(
        self,
        task_id: str,
        status: str,
        progress: Optional[int] = None,
        error_message: Optional[str] = None
    ) -> bool:
        """
        Update task status
        """
        updates = {
            "status": status,
            "updated_at": datetime.now().isoformat()
        }
        
        if progress is not None:
            updates["progress"] = progress
        
        if error_message:
            updates["error_message"] = error_message
        
        if status == "completed":
            updates["completed_at"] = datetime.now().isoformat()
        elif status == "processing" and "processing_started_at" not in updates:
            updates["processing_started_at"] = datetime.now().isoformat()
        
        return await self.update("id", task_id, updates)
    
    async def update_task_result(
        self,
        task_id: str,
        result_url: str,
        processing_duration: Optional[float] = None,
        from_cache: bool = False
    ) -> bool:
        """
        Update task with processing results
        """
        updates = {
            "result_url": result_url,
            "from_cache": 1 if from_cache else 0,
            "updated_at": datetime.now().isoformat()
        }
        
        if processing_duration:
            updates["processing_duration"] = processing_duration
        
        return await self.update("id", task_id, updates)
    
    async def check_task_access(
        self,
        task_id: str,
        user_id: Optional[int]
    ) -> bool:
        """
        Check if user has access to task
        """
        task = await self.get_task_by_id(task_id)
        if not task:
            return False
        
        # Public tasks are accessible to all
        if task.get("is_public"):
            return True
        
        # Private tasks only accessible to owner
        if user_id and task.get("user_id") == user_id:
            return True
        
        # Check if task is shared with user
        query = """
            SELECT 1 FROM task_shares
            WHERE task_id = ? AND shared_with_user_id = ?
            LIMIT 1
        """
        result = await self.db.fetch_one(query, (task_id, user_id))
        return result is not None
    
    async def share_task(
        self,
        task_id: str,
        shared_by_user_id: int,
        shared_with_user_id: Optional[int] = None,
        shared_with_email: Optional[str] = None,
        permission_level: str = "read"
    ) -> int:
        """
        Share a task with another user
        """
        data = {
            "task_id": task_id,
            "shared_by_user_id": shared_by_user_id,
            "shared_with_user_id": shared_with_user_id,
            "shared_with_email": shared_with_email,
            "permission_level": permission_level,
            "created_at": datetime.now().isoformat()
        }
        
        query = """
            INSERT INTO task_shares (
                task_id, shared_by_user_id, shared_with_user_id,
                shared_with_email, permission_level, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        """
        
        return await self.db.insert_returning_id(
            query,
            tuple(data.values())
        )
    
    async def get_shared_tasks(
        self,
        user_id: int,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get tasks shared with a user
        """
        query = """
            SELECT t.*, s.permission_level, s.created_at as shared_at
            FROM processing_tasks t
            JOIN task_shares s ON t.id = s.task_id
            WHERE s.shared_with_user_id = ?
            ORDER BY s.created_at DESC
            LIMIT ? OFFSET ?
        """
        return await self.db.fetch_all(query, (user_id, limit, offset))
    
    async def delete_task(self, task_id: str) -> bool:
        """
        Delete a task (cascades to history and shares)
        """
        return await self.delete("id", task_id)
    
    async def get_task_statistics(self, user_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Get task statistics
        """
        base_query = """
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN from_cache = 1 THEN 1 ELSE 0 END) as from_cache,
                AVG(processing_duration) as avg_duration
            FROM processing_tasks
        """
        
        if user_id:
            query = base_query + " WHERE user_id = ?"
            result = await self.db.fetch_one(query, (user_id,))
        else:
            result = await self.db.fetch_one(base_query)
        
        if result:
            return {
                "total": result["total"] or 0,
                "completed": result["completed"] or 0,
                "failed": result["failed"] or 0,
                "processing": result["processing"] or 0,
                "pending": result["pending"] or 0,
                "from_cache": result["from_cache"] or 0,
                "avg_duration": result["avg_duration"] or 0
            }
        
        return {
            "total": 0,
            "completed": 0,
            "failed": 0,
            "processing": 0,
            "pending": 0,
            "from_cache": 0,
            "avg_duration": 0
        }
    
    async def search_tasks(
        self,
        user_id: Optional[int],
        search_term: str,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Search tasks by filename
        """
        query = f"""
            SELECT * FROM {self.table_name}
            WHERE (user_id = ? OR is_public = 1)
            AND LOWER(filename) LIKE LOWER(?)
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        """
        
        search_pattern = f"%{search_term}%"
        return await self.db.fetch_all(
            query,
            (user_id, search_pattern, limit, offset)
        )
    
    async def cleanup_old_tasks(self, days: int = 30) -> int:
        """
        Clean up old completed tasks
        """
        query = f"""
            DELETE FROM {self.table_name}
            WHERE status = 'completed'
            AND datetime(completed_at) < datetime('now', '-{days} days')
        """
        await self.db.execute(query)
        
        # Return count of deleted tasks
        query = "SELECT changes() as count"
        result = await self.db.fetch_one(query)
        return result['count'] if result else 0