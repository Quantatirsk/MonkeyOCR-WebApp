"""
User repository for authentication and user management
"""

import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from database import DatabaseManager
from .base import BaseRepository

logger = logging.getLogger(__name__)


class UserRepository(BaseRepository):
    """
    Repository for user operations
    """
    
    def __init__(self, db_manager: DatabaseManager):
        super().__init__(db_manager, "users")
    
    async def create_user(
        self,
        username: str,
        email: str,
        password_hash: str,
        salt: Optional[str] = None,  # Optional for backward compatibility
        is_active: bool = True,
        is_verified: bool = False
    ) -> int:
        """
        Create a new user
        """
        data = {
            "username": username,
            "email": email.lower(),
            "password_hash": password_hash,
            "is_active": 1 if is_active else 0,
            "is_verified": 1 if is_verified else 0,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        # Only include salt if provided (for backward compatibility)
        if salt is not None:
            data["salt"] = salt
        
        return await self.create(data)
    
    async def get_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """
        Get user by email address
        """
        query = "SELECT * FROM users WHERE LOWER(email) = LOWER(?)"
        return await self.db.fetch_one(query, (email,))
    
    async def get_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        """
        Get user by username
        """
        query = "SELECT * FROM users WHERE LOWER(username) = LOWER(?)"
        return await self.db.fetch_one(query, (username,))
    
    async def get_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        """
        Get user by ID
        """
        return await super().get_by_id("id", user_id)
    
    async def update_user(self, user_id: int, updates: Dict[str, Any]) -> bool:
        """
        Update user information
        """
        # Always update the updated_at timestamp
        updates["updated_at"] = datetime.now().isoformat()
        
        # Handle boolean conversions
        if "is_active" in updates:
            updates["is_active"] = 1 if updates["is_active"] else 0
        if "is_verified" in updates:
            updates["is_verified"] = 1 if updates["is_verified"] else 0
            
        return await self.update("id", user_id, updates)
    
    async def update_password(
        self, 
        user_id: int, 
        password_hash: str,
        salt: Optional[str] = None
    ) -> bool:
        """
        Update user password
        """
        update_data = {"password_hash": password_hash}
        
        # Set salt to NULL for new bcrypt-only passwords
        if salt is None:
            update_data["salt"] = None
        else:
            update_data["salt"] = salt
            
        return await self.update_user(user_id, update_data)
    
    async def update_last_login(self, user_id: int) -> bool:
        """
        Update user's last login timestamp
        """
        return await self.update_user(user_id, {
            "last_login_at": datetime.now().isoformat()
        })
    
    async def update_preferences(self, user_id: int, preferences: Dict[str, Any]) -> bool:
        """
        Update user preferences (stored as JSON)
        """
        preferences_json = self.db.to_json(preferences)
        return await self.update_user(user_id, {
            "preferences": preferences_json
        })
    
    async def verify_user(self, user_id: int) -> bool:
        """
        Mark user as verified
        """
        return await self.update_user(user_id, {"is_verified": True})
    
    async def deactivate_user(self, user_id: int) -> bool:
        """
        Deactivate a user account
        """
        return await self.update_user(user_id, {"is_active": False})
    
    async def activate_user(self, user_id: int) -> bool:
        """
        Activate a user account
        """
        return await self.update_user(user_id, {"is_active": True})
    
    async def email_exists(self, email: str) -> bool:
        """
        Check if email already exists
        """
        query = "SELECT 1 FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1"
        result = await self.db.fetch_one(query, (email,))
        return result is not None
    
    async def username_exists(self, username: str) -> bool:
        """
        Check if username already exists
        """
        query = "SELECT 1 FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1"
        result = await self.db.fetch_one(query, (username,))
        return result is not None
    
    async def search_users(
        self,
        search_term: str,
        limit: int = 20,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Search users by username or email
        """
        query = """
            SELECT id, username, email, is_active, is_verified, 
                   created_at, last_login_at
            FROM users 
            WHERE LOWER(username) LIKE LOWER(?) 
               OR LOWER(email) LIKE LOWER(?)
            ORDER BY username
            LIMIT ? OFFSET ?
        """
        search_pattern = f"%{search_term}%"
        return await self.db.fetch_all(
            query, 
            (search_pattern, search_pattern, limit, offset)
        )
    
    async def get_user_stats(self, user_id: int) -> Dict[str, Any]:
        """
        Get user statistics (task counts, etc.)
        """
        stats = {}
        
        # Get task counts by status
        query = """
            SELECT status, COUNT(*) as count 
            FROM processing_tasks 
            WHERE user_id = ?
            GROUP BY status
        """
        results = await self.db.fetch_all(query, (user_id,))
        
        task_stats = {
            "total": 0,
            "pending": 0,
            "processing": 0,
            "completed": 0,
            "failed": 0
        }
        
        for row in results:
            status = row['status']
            count = row['count']
            if status in task_stats:
                task_stats[status] = count
            task_stats['total'] += count
        
        stats['tasks'] = task_stats
        
        # Get total shared tasks
        query = """
            SELECT COUNT(*) as count
            FROM task_shares
            WHERE shared_by_user_id = ?
        """
        result = await self.db.fetch_one(query, (user_id,))
        stats['shared_tasks'] = result['count'] if result else 0
        
        return stats
    
    async def get_active_users(
        self,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get all active users
        """
        query = """
            SELECT id, username, email, created_at, last_login_at
            FROM users
            WHERE is_active = 1
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        """
        return await self.db.fetch_all(query, (limit, offset))
    
    async def count_active_users(self) -> int:
        """
        Count total active users
        """
        return await self.count("is_active = 1")