"""
Simplified Authentication Service
Combines authentication and authorization into a single, streamlined service
"""

import os
import logging
from typing import Optional, Dict, Any
from datetime import datetime
from email_validator import validate_email, EmailNotValidError

from database import DatabaseManager
from repositories import UserRepository, TaskRepository
from .token_manager import TokenManager
from .password_service import PasswordService

logger = logging.getLogger(__name__)


class AuthService:
    """
    Unified authentication and authorization service
    """
    
    def __init__(self, db_manager: DatabaseManager):
        self.db = db_manager
        self.user_repo = UserRepository(db_manager)
        self.task_repo = TaskRepository(db_manager)
        self.token_manager = TokenManager()
        self.password_service = PasswordService()
        
    async def register(
        self,
        email: str,
        username: str,
        password: str
    ) -> Dict[str, Any]:
        """
        Register a new user and return user info with JWT token
        
        Args:
            email: User email address
            username: Unique username
            password: Plain text password
            
        Returns:
            Dict with user info and JWT token
            
        Raises:
            ValueError: If validation fails or user exists
        """
        # Validate email (skip deliverability check for development)
        try:
            valid_email = validate_email(email, check_deliverability=False)
            email = valid_email.normalized
        except EmailNotValidError as e:
            raise ValueError(f"Invalid email: {str(e)}")
        
        # Validate username
        if not username or len(username) < 3:
            raise ValueError("Username must be at least 3 characters")
        if len(username) > 50:
            raise ValueError("Username must be less than 50 characters")
        if not username.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username can only contain letters, numbers, hyphens and underscores")
        
        # Validate password
        self.password_service.validate_password_strength(password)
        
        # Check if user exists
        if await self.user_repo.email_exists(email):
            raise ValueError("Email already registered")
        if await self.user_repo.username_exists(username):
            raise ValueError("Username already taken")
        
        # Hash password (bcrypt includes salt)
        password_hash = self.password_service.hash_password(password)
        
        # Create user (include empty salt for backward compatibility)
        query = """
            INSERT INTO users (email, username, password_hash, salt, is_active, created_at)
            VALUES (?, ?, ?, '', 1, CURRENT_TIMESTAMP)
        """
        result = await self.db.execute(query, (email, username, password_hash))
        user_id = result.lastrowid if hasattr(result, 'lastrowid') else None
        
        if not user_id:
            # For databases that don't support lastrowid, fetch the created user
            user = await self.user_repo.get_by_email(email)
            if not user:
                raise Exception("Failed to create user")
            user_id = user['id']
        
        # Generate JWT token
        token = self.token_manager.create_token(
            user_id=user_id,
            username=username,
            email=email
        )
        
        logger.info(f"User registered: {username} ({email})")
        
        # Return user info with token
        return {
            "user": {
                "id": user_id,
                "username": username,
                "email": email,
                "is_verified": True,  # New users are auto-verified for now
                "is_active": True
            },
            "token": token
        }
    
    async def login(
        self,
        email_or_username: str,
        password: str
    ) -> Dict[str, Any]:
        """
        Authenticate user and return user info with JWT token
        
        Args:
            email_or_username: Email or username
            password: Plain text password
            
        Returns:
            Dict with user info and JWT token
            
        Raises:
            ValueError: Invalid credentials
        """
        # Find user
        user = None
        if "@" in email_or_username:
            user = await self.user_repo.get_by_email(email_or_username)
        else:
            user = await self.user_repo.get_by_username(email_or_username)
        
        if not user:
            logger.warning(f"Login attempt failed: user not found for {email_or_username}")
            raise ValueError("Invalid credentials")
        
        # Check if account is active
        if not user.get('is_active'):
            raise ValueError("Account is deactivated")
        
        # Verify password (simplified - no separate salt)
        # For backward compatibility, check if salt column exists
        if 'salt' in user and user['salt']:
            # Old method with separate salt (for migration period)
            salted_password = password + user['salt']
            if not self.password_service.pwd_context.verify(salted_password, user['password_hash']):
                logger.warning(f"Login attempt failed: invalid password for user {user['id']}")
                raise ValueError("Invalid credentials")
        else:
            # New method - bcrypt handles salt internally
            if not self.password_service.verify_password(password, user['password_hash']):
                logger.warning(f"Login attempt failed: invalid password for user {user['id']}")
                raise ValueError("Invalid credentials")
        
        # Update last login
        await self.user_repo.update_last_login(user['id'])
        
        # Generate JWT token
        token = self.token_manager.create_token(
            user_id=user['id'],
            username=user['username'],
            email=user['email']
        )
        
        logger.info(f"User logged in: {user['username']} ({user['email']})")
        
        # Return user info with token
        return {
            "user": {
                "id": user['id'],
                "username": user['username'],
                "email": user['email'],
                "is_verified": user.get('is_verified', True),
                "is_active": user.get('is_active', True)
            },
            "token": token
        }
    
    async def validate_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Validate JWT token and return user info
        
        Args:
            token: JWT token
            
        Returns:
            User info if valid, None otherwise
        """
        payload = self.token_manager.decode_token(token)
        if not payload:
            return None
        
        return {
            "user_id": int(payload.get("sub")),
            "username": payload.get("username"),
            "email": payload.get("email")
        }
    
    async def renew_token(self, token: str) -> Optional[str]:
        """
        Renew a token before it expires
        
        Args:
            token: Current valid token
            
        Returns:
            New token if successful, None otherwise
        """
        return self.token_manager.renew_token(token)
    
    async def change_password(
        self,
        user_id: int,
        old_password: str,
        new_password: str
    ) -> bool:
        """
        Change user password
        
        Args:
            user_id: User ID
            old_password: Current password
            new_password: New password
            
        Returns:
            Success status
        """
        # Get user
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise ValueError("User not found")
        
        # Verify old password
        # Check for backward compatibility with salt column
        if 'salt' in user and user['salt']:
            # Old method
            salted_password = old_password + user['salt']
            if not self.password_service.pwd_context.verify(salted_password, user['password_hash']):
                raise ValueError("Invalid current password")
        else:
            # New method
            if not self.password_service.verify_password(old_password, user['password_hash']):
                raise ValueError("Invalid current password")
        
        # Validate new password
        self.password_service.validate_password_strength(new_password)
        
        # Hash new password (no separate salt needed)
        new_password_hash = self.password_service.hash_password(new_password)
        
        # Update password (set salt to NULL for new method)
        query = """
            UPDATE users 
            SET password_hash = ?, salt = NULL
            WHERE id = ?
        """
        await self.db.execute(query, (new_password_hash, user_id))
        
        logger.info(f"Password changed for user {user_id}")
        return True
    
    async def get_user_profile(self, user_id: int) -> Optional[Dict[str, Any]]:
        """
        Get user profile information
        
        Args:
            user_id: User ID
            
        Returns:
            User profile data
        """
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            return None
        
        # Get task statistics
        stats_query = """
            SELECT 
                COUNT(*) as total_tasks,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
                COUNT(CASE WHEN is_public = 1 THEN 1 END) as public_tasks
            FROM processing_tasks
            WHERE user_id = ?
        """
        stats = await self.db.fetch_one(stats_query, (user_id,))
        
        return {
            "id": user['id'],
            "username": user['username'],
            "email": user['email'],
            "is_active": bool(user.get('is_active', True)),
            "created_at": user.get('created_at'),
            "last_login_at": user.get('last_login_at'),
            "stats": {
                "total_tasks": stats['total_tasks'] if stats else 0,
                "completed_tasks": stats['completed_tasks'] if stats else 0,
                "public_tasks": stats['public_tasks'] if stats else 0
            }
        }
    
    async def check_task_access(
        self,
        user_id: Optional[int],
        task_id: str
    ) -> bool:
        """
        Check if user has access to a task
        
        Args:
            user_id: User ID (None for anonymous)
            task_id: Task ID
            
        Returns:
            True if access granted, False otherwise
        """
        # Get task
        task = await self.task_repo.get_task_by_id(task_id)
        if not task:
            return False
        
        # Public tasks are accessible to all
        if task.get('is_public'):
            return True
        
        # Anonymous users can only access public tasks
        if not user_id:
            return False
        
        # Task owner has access
        if task.get('user_id') == user_id:
            return True
        
        # Check if task is shared via token (simplified sharing)
        share_query = """
            SELECT 1 FROM share_tokens
            WHERE task_id = ? AND expires_at > CURRENT_TIMESTAMP
            LIMIT 1
        """
        share_result = await self.db.fetch_one(share_query, (task_id,))
        
        return bool(share_result)
    
    async def create_share_token(
        self,
        task_id: str,
        user_id: int,
        expires_hours: int = 24
    ) -> str:
        """
        Create a share token for a task
        
        Args:
            task_id: Task to share
            user_id: User creating the share
            expires_hours: Token validity in hours
            
        Returns:
            Share token
        """
        # Verify user owns the task
        task = await self.task_repo.get_task_by_id(task_id)
        if not task or task.get('user_id') != user_id:
            raise ValueError("Task not found or access denied")
        
        # Generate share token
        import secrets
        token = secrets.token_urlsafe(32)
        
        # Store token
        query = """
            INSERT INTO share_tokens (token, task_id, created_by, expires_at)
            VALUES (?, ?, ?, datetime('now', '+{} hours'))
        """.format(expires_hours)
        
        await self.db.execute(query, (token, task_id, user_id))
        
        logger.info(f"Share token created for task {task_id} by user {user_id}")
        return token