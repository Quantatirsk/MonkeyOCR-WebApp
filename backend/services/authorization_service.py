"""
Authorization service for access control and permissions
"""

import logging
from typing import Optional, Dict, Any, List
from enum import Enum

from database import DatabaseManager
from repositories import TaskRepository, UserRepository
# from utils.auth_cache import AuthCacheManager  # Disabled: Redis should only cache OCR and LLM tasks

logger = logging.getLogger(__name__)


class Permission(Enum):
    """Permission levels"""
    READ = "read"
    WRITE = "write"
    DELETE = "delete"
    SHARE = "share"
    ADMIN = "admin"


class AuthorizationService:
    """
    Service for handling authorization and access control
    """
    
    def __init__(self, db_manager: DatabaseManager):
        self.db = db_manager
        self.task_repo = TaskRepository(db_manager)
        self.user_repo = UserRepository(db_manager)
        
        # Permission cache (in production, use Redis)
        self.permission_cache: Dict[str, Dict[str, Any]] = {}
    
    async def check_task_access(
        self,
        user_id: Optional[int],
        task_id: str,
        required_permission: Permission = Permission.READ
    ) -> bool:
        """
        Check if user has access to a task
        
        Args:
            user_id: User ID (None for anonymous)
            task_id: Task ID
            required_permission: Required permission level
            
        Returns:
            True if access granted, False otherwise
        """
        # Note: Removed permission caching as per requirement
        # Redis should only cache OCR and LLM tasks, not auth-related data
        
        # Get task details
        task = await self.task_repo.get_task_by_id(task_id)
        if not task:
            return False
        
        # Public tasks allow read access to all
        if task.get("is_public") and required_permission == Permission.READ:
            # Permission caching disabled - Redis for OCR/LLM only
            return True
        
        # Anonymous users can only access public tasks for reading
        if not user_id:
            result = task.get("is_public") and required_permission == Permission.READ
            # Permission caching disabled - Redis for OCR/LLM only
            return result
        
        # Task owner has full access
        if task.get("user_id") == user_id:
            # Permission caching disabled - Redis for OCR/LLM only
            return True
        
        # Check shared permissions
        share_query = """
            SELECT permission_level
            FROM task_shares
            WHERE task_id = ? AND shared_with_user_id = ?
        """
        share_result = await self.db.fetch_one(share_query, (task_id, user_id))
        
        if share_result:
            granted = self._check_permission_level(
                share_result["permission_level"],
                required_permission
            )
            # Permission caching disabled - Redis for OCR/LLM only
            return granted
        
        # Permission caching disabled - Redis for OCR/LLM only
        return False
    
    async def check_user_permission(
        self,
        requesting_user_id: Optional[int],
        target_user_id: int,
        required_permission: Permission
    ) -> bool:
        """
        Check if a user has permission to access another user's data
        
        Args:
            requesting_user_id: User making the request
            target_user_id: Target user
            required_permission: Required permission
            
        Returns:
            True if access granted
        """
        # Users can always access their own data
        if requesting_user_id == target_user_id:
            return True
        
        # For now, users can only access their own data
        # Future: implement admin roles, organization permissions, etc.
        return False
    
    async def grant_task_access(
        self,
        task_id: str,
        granting_user_id: int,
        target_user_id: Optional[int] = None,
        target_email: Optional[str] = None,
        permission_level: str = "read"
    ) -> bool:
        """
        Grant access to a task
        
        Args:
            task_id: Task to share
            granting_user_id: User granting access
            target_user_id: User to grant access to
            target_email: Email to grant access to
            permission_level: Permission level to grant
            
        Returns:
            True if successful
        """
        # Verify granting user owns the task or has share permission
        can_share = await self.check_task_access(
            granting_user_id,
            task_id,
            Permission.SHARE
        )
        
        if not can_share:
            logger.warning(f"User {granting_user_id} cannot share task {task_id}")
            return False
        
        # If target_email provided but no user_id, try to find user
        if target_email and not target_user_id:
            target_user = await self.user_repo.get_by_email(target_email)
            if target_user:
                target_user_id = target_user["id"]
        
        # Grant access
        try:
            await self.task_repo.share_task(
                task_id=task_id,
                shared_by_user_id=granting_user_id,
                shared_with_user_id=target_user_id,
                shared_with_email=target_email,
                permission_level=permission_level
            )
            
            # Clear cache for target user
            if target_user_id:
                self._clear_user_cache(target_user_id)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to grant access: {e}")
            return False
    
    async def revoke_task_access(
        self,
        task_id: str,
        revoking_user_id: int,
        target_user_id: int
    ) -> bool:
        """
        Revoke access to a task
        
        Args:
            task_id: Task ID
            revoking_user_id: User revoking access
            target_user_id: User to revoke access from
            
        Returns:
            True if successful
        """
        # Verify revoking user owns the task
        task = await self.task_repo.get_task_by_id(task_id)
        if not task or task.get("user_id") != revoking_user_id:
            return False
        
        # Revoke access
        query = """
            DELETE FROM task_shares
            WHERE task_id = ? AND shared_with_user_id = ?
        """
        await self.db.execute(query, (task_id, target_user_id))
        
        # Clear cache
        self._clear_user_cache(target_user_id)
        
        return True
    
    async def get_shared_users(
        self,
        task_id: str,
        requesting_user_id: int
    ) -> List[Dict[str, Any]]:
        """
        Get list of users a task is shared with
        
        Args:
            task_id: Task ID
            requesting_user_id: User making request
            
        Returns:
            List of shared users with permissions
        """
        # Verify requesting user owns the task
        task = await self.task_repo.get_task_by_id(task_id)
        if not task or task.get("user_id") != requesting_user_id:
            return []
        
        query = """
            SELECT 
                s.id,
                s.shared_with_user_id,
                s.shared_with_email,
                s.permission_level,
                s.created_at,
                u.username,
                u.email
            FROM task_shares s
            LEFT JOIN users u ON s.shared_with_user_id = u.id
            WHERE s.task_id = ?
            ORDER BY s.created_at DESC
        """
        
        results = await self.db.fetch_all(query, (task_id,))
        
        return [
            {
                "share_id": row["id"],
                "user_id": row["shared_with_user_id"],
                "email": row["email"] or row["shared_with_email"],
                "username": row["username"],
                "permission_level": row["permission_level"],
                "shared_at": row["created_at"]
            }
            for row in results
        ]
    
    async def check_rate_limit(
        self,
        user_id: Optional[int],
        action: str,
        limit: int,
        window_seconds: int
    ) -> bool:
        """
        Check if user has exceeded rate limit
        
        Args:
            user_id: User ID (None for IP-based limiting)
            action: Action being rate limited
            limit: Maximum allowed actions
            window_seconds: Time window in seconds
            
        Returns:
            True if within limits, False if exceeded
        """
        # TODO: Implement proper rate limiting with Redis
        # For now, always allow
        return True
    
    def _check_permission_level(
        self,
        granted_level: str,
        required_permission: Permission
    ) -> bool:
        """
        Check if granted level satisfies required permission
        """
        permission_hierarchy = {
            "read": [Permission.READ],
            "write": [Permission.READ, Permission.WRITE],
            "delete": [Permission.READ, Permission.WRITE, Permission.DELETE],
            "share": [Permission.READ, Permission.WRITE, Permission.SHARE],
            "admin": [Permission.READ, Permission.WRITE, Permission.DELETE, 
                     Permission.SHARE, Permission.ADMIN]
        }
        
        allowed_permissions = permission_hierarchy.get(granted_level, [])
        return required_permission in allowed_permissions
    
    def _cache_permission(self, cache_key: str, granted: bool) -> None:
        """
        Cache permission result
        """
        self.permission_cache[cache_key] = {
            "granted": granted,
            "cached_at": datetime.now()
        }
        
        # Limit cache size
        if len(self.permission_cache) > 1000:
            # Remove oldest entries
            sorted_items = sorted(
                self.permission_cache.items(),
                key=lambda x: x[1]["cached_at"]
            )
            self.permission_cache = dict(sorted_items[-500:])
    
    def _clear_user_cache(self, user_id: int) -> None:
        """
        Clear permission cache for a user
        """
        keys_to_remove = [
            key for key in self.permission_cache
            if key.startswith(f"{user_id}:")
        ]
        for key in keys_to_remove:
            del self.permission_cache[key]
    
    def clear_cache(self) -> None:
        """
        Clear all permission cache
        """
        self.permission_cache.clear()


from datetime import datetime