"""
Authentication service for user management and authentication
"""

import logging
import secrets
from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from email_validator import validate_email, EmailNotValidError

from database import DatabaseManager
from repositories import UserRepository, SessionRepository
from models.schemas import ProcessingTask
from .token_manager import TokenManager
from .password_service import PasswordService
# from utils.auth_cache import AuthCacheManager  # Disabled: Redis should only cache OCR and LLM tasks

logger = logging.getLogger(__name__)


class AuthenticationService:
    """
    Service for handling authentication and user management
    """
    
    def __init__(self, db_manager: DatabaseManager):
        self.db = db_manager
        self.user_repo = UserRepository(db_manager)
        self.session_repo = SessionRepository(db_manager)
        self.token_manager = TokenManager()
        self.password_service = PasswordService()
        
        # Rate limiting configuration
        self.max_login_attempts = 5
        self.lockout_duration_minutes = 30
        
    async def register_user(
        self,
        username: str,
        email: str,
        password: str,
        auto_verify: bool = False
    ) -> Dict[str, Any]:
        """
        Register a new user
        
        Args:
            username: Unique username
            email: Valid email address
            password: Plain text password (will be hashed)
            auto_verify: Skip email verification (for testing)
            
        Returns:
            User data with tokens
            
        Raises:
            ValueError: If validation fails
            Exception: If user already exists
        """
        # Validate email
        try:
            valid_email = validate_email(email)
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
        
        # Validate password strength
        self.password_service.validate_password_strength(password)
        
        # Check if user exists
        if await self.user_repo.email_exists(email):
            raise Exception("Email already registered")
        if await self.user_repo.username_exists(username):
            raise Exception("Username already taken")
        
        # Hash password
        password_hash, salt = self.password_service.hash_password(password)
        
        # Create user
        user_id = await self.user_repo.create_user(
            username=username,
            email=email,
            password_hash=password_hash,
            salt=salt,
            is_active=True,
            is_verified=auto_verify
        )
        
        # Get created user
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise Exception("Failed to create user")
        
        # Create session
        session = await self.session_repo.create_session(
            user_id=user_id,
            expires_hours=24
        )
        
        # Generate JWT tokens
        access_token = self.token_manager.create_access_token(
            user_id=user_id,
            username=username,
            email=email
        )
        
        refresh_token = self.token_manager.create_refresh_token(
            user_id=user_id,
            session_token=session['session_token']
        )
        
        # Send verification email if needed
        if not auto_verify:
            await self._send_verification_email(email, user_id)
        
        return {
            "user": {
                "id": user_id,
                "username": username,
                "email": email,
                "is_verified": auto_verify
            },
            "tokens": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer"
            }
        }
    
    async def login(
        self,
        email_or_username: str,
        password: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Authenticate user and create session
        
        Args:
            email_or_username: Email or username
            password: Plain text password
            ip_address: Client IP address
            user_agent: Client user agent
            
        Returns:
            User data with tokens
            
        Raises:
            ValueError: Invalid credentials
            Exception: Account locked or not verified
        """
        # Find user by email or username
        user = None
        if "@" in email_or_username:
            user = await self.user_repo.get_by_email(email_or_username)
        else:
            user = await self.user_repo.get_by_username(email_or_username)
        
        if not user:
            # Log failed attempt
            logger.warning(f"Login attempt failed: user not found for {email_or_username}")
            raise ValueError("Invalid credentials")
        
        # Check if account is locked
        if await self._is_account_locked(user['id']):
            raise Exception("Account temporarily locked due to too many failed attempts")
        
        # Check if account is active
        if not user['is_active']:
            raise Exception("Account is deactivated")
        
        # Verify password
        if not self.password_service.verify_password(
            password,
            user['password_hash'],
            user['salt']
        ):
            # Log failed attempt
            await self._log_failed_login(user['id'])
            logger.warning(f"Login attempt failed: invalid password for user {user['id']}")
            raise ValueError("Invalid credentials")
        
        # Check if email is verified
        if not user['is_verified']:
            # Allow login but flag the unverified status
            logger.info(f"User {user['id']} logged in with unverified email")
        
        # Update last login
        await self.user_repo.update_last_login(user['id'])
        
        # Create session
        session = await self.session_repo.create_session(
            user_id=user['id'],
            ip_address=ip_address,
            user_agent=user_agent,
            expires_hours=24
        )
        
        # Note: Session caching disabled - Redis for OCR/LLM only
        
        # Note: Profile caching disabled - Redis for OCR/LLM only
        
        # Generate JWT tokens
        access_token = self.token_manager.create_access_token(
            user_id=user['id'],
            username=user['username'],
            email=user['email']
        )
        
        refresh_token = self.token_manager.create_refresh_token(
            user_id=user['id'],
            session_token=session['session_token']
        )
        
        return {
            "user": {
                "id": user['id'],
                "username": user['username'],
                "email": user['email'],
                "is_verified": bool(user['is_verified'])
            },
            "tokens": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer"
            }
        }
    
    async def logout(self, session_token: str) -> bool:
        """
        Logout user by revoking session
        
        Args:
            session_token: Session token to revoke
            
        Returns:
            Success status
        """
        # Invalidate cached session
        # Session cache invalidation disabled - Redis for OCR/LLM only
        
        # Revoke session in database
        return await self.session_repo.revoke_by_token(session_token)
    
    async def logout_all_sessions(self, user_id: int) -> int:
        """
        Logout user from all sessions
        
        Args:
            user_id: User ID
            
        Returns:
            Number of sessions revoked
        """
        # Invalidate all cached sessions for user
        # Session cache invalidation disabled - Redis for OCR/LLM only
        
        # Invalidate user profile cache
        # Profile cache invalidation disabled - Redis for OCR/LLM only
        
        # Revoke all sessions in database
        return await self.session_repo.revoke_all_user_sessions(user_id)
    
    async def refresh_tokens(
        self,
        refresh_token: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Refresh access and refresh tokens
        
        Args:
            refresh_token: Current refresh token
            ip_address: Client IP address
            user_agent: Client user agent
            
        Returns:
            New tokens
            
        Raises:
            ValueError: Invalid refresh token
        """
        # Decode refresh token
        payload = self.token_manager.decode_refresh_token(refresh_token)
        if not payload:
            raise ValueError("Invalid refresh token")
        
        user_id = payload.get("user_id")
        session_token = payload.get("session_token")
        
        # Validate session
        session = await self.session_repo.get_by_token(session_token)
        if not session:
            raise ValueError("Session not found or expired")
        
        # Update session activity
        if ip_address or user_agent:
            await self.session_repo.update_session_activity(
                session['id'],
                ip_address=ip_address,
                user_agent=user_agent
            )
        
        # Refresh session tokens
        new_session = await self.session_repo.refresh_session(
            session['id'],
            expires_hours=24
        )
        
        # Get user data
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise ValueError("User not found")
        
        # Generate new tokens
        access_token = self.token_manager.create_access_token(
            user_id=user['id'],
            username=user['username'],
            email=user['email']
        )
        
        new_refresh_token = self.token_manager.create_refresh_token(
            user_id=user['id'],
            session_token=new_session['session_token']
        )
        
        return {
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer"
        }
    
    async def verify_email(self, user_id: int, verification_code: str) -> bool:
        """
        Verify user email address
        
        Args:
            user_id: User ID
            verification_code: Verification code from email
            
        Returns:
            Success status
        """
        # TODO: Implement verification code validation
        # For now, just mark as verified
        return await self.user_repo.verify_user(user_id)
    
    async def request_password_reset(self, email: str) -> str:
        """
        Request password reset
        
        Args:
            email: User email
            
        Returns:
            Reset token
            
        Raises:
            ValueError: User not found
        """
        user = await self.user_repo.get_by_email(email)
        if not user:
            # Don't reveal if email exists
            logger.info(f"Password reset requested for non-existent email: {email}")
            return secrets.token_urlsafe(32)
        
        # Generate reset token
        reset_token = secrets.token_urlsafe(32)
        
        # Store reset token (expires in 1 hour)
        # TODO: Store in database with expiration
        
        # Send reset email
        await self._send_password_reset_email(email, reset_token)
        
        return reset_token
    
    async def reset_password(
        self,
        reset_token: str,
        new_password: str
    ) -> bool:
        """
        Reset password using reset token
        
        Args:
            reset_token: Password reset token
            new_password: New password
            
        Returns:
            Success status
        """
        # TODO: Validate reset token from database
        
        # Validate new password
        self.password_service.validate_password_strength(new_password)
        
        # Hash new password
        password_hash, salt = self.password_service.hash_password(new_password)
        
        # TODO: Get user_id from reset token
        # For now, this is a placeholder
        user_id = 1
        
        # Update password
        success = await self.user_repo.update_password(user_id, password_hash, salt)
        
        if success:
            # Revoke all sessions to force re-login
            await self.session_repo.revoke_all_user_sessions(user_id)
        
        return success
    
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
            
        Raises:
            ValueError: Invalid old password
        """
        # Get user
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise ValueError("User not found")
        
        # Verify old password
        if not self.password_service.verify_password(
            old_password,
            user['password_hash'],
            user['salt']
        ):
            raise ValueError("Invalid current password")
        
        # Validate new password
        self.password_service.validate_password_strength(new_password)
        
        # Hash new password
        password_hash, salt = self.password_service.hash_password(new_password)
        
        # Update password
        return await self.user_repo.update_password(user_id, password_hash, salt)
    
    async def get_user_profile(self, user_id: int) -> Optional[Dict[str, Any]]:
        """
        Get user profile
        
        Args:
            user_id: User ID
            
        Returns:
            User profile data
        """
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            return None
        
        # Get user statistics
        stats = await self.user_repo.get_user_stats(user_id)
        
        # Get active sessions
        sessions = await self.session_repo.get_user_sessions(user_id)
        
        return {
            "id": user['id'],
            "username": user['username'],
            "email": user['email'],
            "is_verified": bool(user['is_verified']),
            "is_active": bool(user['is_active']),
            "created_at": user['created_at'],
            "last_login_at": user.get('last_login_at'),
            "preferences": user.get('preferences', {}),
            "stats": stats,
            "active_sessions": len(sessions)
        }
    
    async def update_user_profile(
        self,
        user_id: int,
        updates: Dict[str, Any]
    ) -> bool:
        """
        Update user profile
        
        Args:
            user_id: User ID
            updates: Profile updates
            
        Returns:
            Success status
        """
        # Filter allowed updates
        allowed_fields = ['username', 'preferences']
        filtered_updates = {
            k: v for k, v in updates.items() 
            if k in allowed_fields
        }
        
        # Validate username if being updated
        if 'username' in filtered_updates:
            username = filtered_updates['username']
            if not username or len(username) < 3:
                raise ValueError("Username must be at least 3 characters")
            if len(username) > 50:
                raise ValueError("Username must be less than 50 characters")
            
            # Check if username is taken
            existing = await self.user_repo.get_by_username(username)
            if existing and existing['id'] != user_id:
                raise ValueError("Username already taken")
        
        return await self.user_repo.update_user(user_id, filtered_updates)
    
    async def validate_session(self, session_token: str) -> Optional[Dict[str, Any]]:
        """
        Validate session and return user data
        
        Args:
            session_token: Session token
            
        Returns:
            User data if valid, None otherwise
        """
        session = await self.session_repo.get_by_token(session_token)
        if not session:
            return None
        
        return {
            "user_id": session['user_id'],
            "username": session['username'],
            "email": session['email'],
            "is_active": bool(session['is_active']),
            "is_verified": bool(session['is_verified'])
        }
    
    # Private helper methods
    
    async def _is_account_locked(self, user_id: int) -> bool:
        """Check if account is locked due to failed login attempts"""
        # TODO: Implement login attempt tracking in database
        return False
    
    async def _log_failed_login(self, user_id: int) -> None:
        """Log failed login attempt"""
        # TODO: Implement login attempt logging in database
        pass
    
    async def _send_verification_email(self, email: str, user_id: int) -> None:
        """Send email verification"""
        # TODO: Implement email service
        logger.info(f"Would send verification email to {email} for user {user_id}")
    
    async def _send_password_reset_email(self, email: str, reset_token: str) -> None:
        """Send password reset email"""
        # TODO: Implement email service
        logger.info(f"Would send password reset email to {email} with token {reset_token}")