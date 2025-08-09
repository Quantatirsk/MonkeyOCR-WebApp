"""
Session repository for user session management
"""

import logging
import secrets
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from database import DatabaseManager
from .base import BaseRepository

logger = logging.getLogger(__name__)


class SessionRepository(BaseRepository):
    """
    Repository for user session operations
    """
    
    def __init__(self, db_manager: DatabaseManager):
        super().__init__(db_manager, "user_sessions")
    
    async def create_session(
        self,
        user_id: int,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        expires_hours: int = 24
    ) -> Dict[str, Any]:
        """
        Create a new session for a user
        """
        session_token = secrets.token_urlsafe(32)
        refresh_token = secrets.token_urlsafe(32)
        expires_at = datetime.now() + timedelta(hours=expires_hours)
        
        data = {
            "user_id": user_id,
            "session_token": session_token,
            "refresh_token": refresh_token,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now().isoformat()
        }
        
        session_id = await self.create(data)
        
        return {
            "id": session_id,
            "session_token": session_token,
            "refresh_token": refresh_token,
            "expires_at": expires_at.isoformat(),
            **data
        }
    
    async def get_by_token(self, session_token: str) -> Optional[Dict[str, Any]]:
        """
        Get session by session token
        """
        query = """
            SELECT s.*, u.username, u.email, u.is_active, u.is_verified
            FROM user_sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.session_token = ? 
              AND s.revoked_at IS NULL
              AND datetime(s.expires_at) > datetime('now')
        """
        return await self.db.fetch_one(query, (session_token,))
    
    async def get_by_refresh_token(self, refresh_token: str) -> Optional[Dict[str, Any]]:
        """
        Get session by refresh token
        """
        query = """
            SELECT s.*, u.username, u.email, u.is_active, u.is_verified
            FROM user_sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.refresh_token = ?
              AND s.revoked_at IS NULL
        """
        return await self.db.fetch_one(query, (refresh_token,))
    
    async def refresh_session(
        self,
        session_id: int,
        expires_hours: int = 24
    ) -> Dict[str, Any]:
        """
        Refresh a session with new tokens
        """
        new_session_token = secrets.token_urlsafe(32)
        new_refresh_token = secrets.token_urlsafe(32)
        expires_at = datetime.now() + timedelta(hours=expires_hours)
        
        updates = {
            "session_token": new_session_token,
            "refresh_token": new_refresh_token,
            "expires_at": expires_at.isoformat()
        }
        
        await self.update("id", session_id, updates)
        
        return {
            "session_token": new_session_token,
            "refresh_token": new_refresh_token,
            "expires_at": expires_at.isoformat()
        }
    
    async def revoke_session(self, session_id: int) -> bool:
        """
        Revoke a session
        """
        return await self.update("id", session_id, {
            "revoked_at": datetime.now().isoformat()
        })
    
    async def revoke_by_token(self, session_token: str) -> bool:
        """
        Revoke a session by token
        """
        query = """
            UPDATE user_sessions 
            SET revoked_at = ? 
            WHERE session_token = ? AND revoked_at IS NULL
        """
        await self.db.execute(query, (datetime.now().isoformat(), session_token))
        return True
    
    async def revoke_all_user_sessions(self, user_id: int) -> int:
        """
        Revoke all sessions for a user
        """
        query = """
            UPDATE user_sessions 
            SET revoked_at = ? 
            WHERE user_id = ? AND revoked_at IS NULL
        """
        await self.db.execute(query, (datetime.now().isoformat(), user_id))
        
        # Return count of revoked sessions
        query = "SELECT COUNT(*) as count FROM user_sessions WHERE user_id = ? AND revoked_at IS NOT NULL"
        result = await self.db.fetch_one(query, (user_id,))
        return result['count'] if result else 0
    
    async def get_user_sessions(
        self,
        user_id: int,
        include_revoked: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Get all sessions for a user
        """
        query = """
            SELECT id, ip_address, user_agent, created_at, expires_at, revoked_at
            FROM user_sessions
            WHERE user_id = ?
        """
        
        if not include_revoked:
            query += " AND revoked_at IS NULL"
        
        query += " ORDER BY created_at DESC"
        
        return await self.db.fetch_all(query, (user_id,))
    
    async def cleanup_expired_sessions(self) -> int:
        """
        Clean up expired sessions
        """
        query = """
            DELETE FROM user_sessions
            WHERE datetime(expires_at) < datetime('now')
               OR (revoked_at IS NOT NULL AND datetime(revoked_at) < datetime('now', '-7 days'))
        """
        await self.db.execute(query)
        
        # Return count of cleaned sessions
        query = "SELECT changes() as count"
        result = await self.db.fetch_one(query)
        return result['count'] if result else 0
    
    async def extend_session(self, session_id: int, hours: int = 24) -> bool:
        """
        Extend session expiration
        """
        expires_at = datetime.now() + timedelta(hours=hours)
        return await self.update("id", session_id, {
            "expires_at": expires_at.isoformat()
        })
    
    async def is_session_valid(self, session_token: str) -> bool:
        """
        Check if a session is valid (not expired or revoked)
        """
        session = await self.get_by_token(session_token)
        return session is not None
    
    async def get_active_session_count(self, user_id: int) -> int:
        """
        Get count of active sessions for a user
        """
        query = """
            SELECT COUNT(*) as count
            FROM user_sessions
            WHERE user_id = ?
              AND revoked_at IS NULL
              AND datetime(expires_at) > datetime('now')
        """
        result = await self.db.fetch_one(query, (user_id,))
        return result['count'] if result else 0
    
    async def update_session_activity(
        self,
        session_id: int,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> bool:
        """
        Update session activity (IP, user agent)
        """
        updates = {}
        if ip_address:
            updates["ip_address"] = ip_address
        if user_agent:
            updates["user_agent"] = user_agent
            
        if updates:
            return await self.update("id", session_id, updates)
        return False