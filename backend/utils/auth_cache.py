"""
Redis caching layer for authentication system
Provides caching for user sessions, profiles, and task metadata
"""

import json
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import hashlib

from utils.redis_client import CacheManager, RedisClient

logger = logging.getLogger(__name__)


class AuthCacheManager:
    """
    Specialized cache manager for authentication-related data
    """
    
    # Cache TTL configurations (in seconds)
    SESSION_TTL = 86400  # 24 hours for user sessions
    USER_PROFILE_TTL = 3600  # 1 hour for user profiles
    TASK_METADATA_TTL = 1800  # 30 minutes for task metadata
    PERMISSION_TTL = 600  # 10 minutes for permission cache
    RATE_LIMIT_TTL = 60  # 1 minute for rate limit counters
    
    # Cache key prefixes
    PREFIX_SESSION = "auth:session"
    PREFIX_USER = "auth:user"
    PREFIX_TASK = "auth:task"
    PREFIX_PERMISSION = "auth:perm"
    PREFIX_RATE_LIMIT = "auth:rate"
    PREFIX_TOKEN_BLACKLIST = "auth:blacklist"
    
    # === User Session Caching ===
    
    @classmethod
    async def cache_user_session(
        cls,
        session_token: str,
        session_data: Dict[str, Any],
        ttl: Optional[int] = None
    ) -> bool:
        """
        Cache user session data
        
        Args:
            session_token: Session token
            session_data: Session information
            ttl: Custom TTL in seconds
        """
        key = CacheManager.generate_key(cls.PREFIX_SESSION, session_token)
        ttl = ttl or cls.SESSION_TTL
        
        # Add cache timestamp
        session_data["cached_at"] = datetime.utcnow().isoformat()
        
        success = await CacheManager.set_json(key, session_data, ttl)
        if success:
            logger.debug(f"Cached session for token: {session_token[:20]}...")
        return success
    
    @classmethod
    async def get_user_session(cls, session_token: str) -> Optional[Dict[str, Any]]:
        """
        Get cached user session
        
        Args:
            session_token: Session token
            
        Returns:
            Session data if found and valid
        """
        key = CacheManager.generate_key(cls.PREFIX_SESSION, session_token)
        session = await CacheManager.get_json(key)
        
        if session:
            logger.debug(f"Session cache hit for token: {session_token[:20]}...")
        return session
    
    @classmethod
    async def invalidate_user_session(cls, session_token: str) -> bool:
        """
        Invalidate cached user session
        
        Args:
            session_token: Session token to invalidate
        """
        key = CacheManager.generate_key(cls.PREFIX_SESSION, session_token)
        return await CacheManager.delete(key)
    
    @classmethod
    async def invalidate_all_user_sessions(cls, user_id: int) -> int:
        """
        Invalidate all sessions for a user
        
        Args:
            user_id: User ID
            
        Returns:
            Number of sessions invalidated
        """
        client = await RedisClient.get_client()
        if not client:
            return 0
        
        pattern = f"{cls.PREFIX_SESSION}:*"
        count = 0
        
        try:
            # Scan for all session keys
            async for key in client.scan_iter(match=pattern):
                session = await CacheManager.get_json(key)
                if session and session.get("user_id") == user_id:
                    await CacheManager.delete(key)
                    count += 1
        except Exception as e:
            logger.error(f"Error invalidating user sessions: {e}")
        
        return count
    
    # === User Profile Caching ===
    
    @classmethod
    async def cache_user_profile(
        cls,
        user_id: int,
        profile_data: Dict[str, Any],
        ttl: Optional[int] = None
    ) -> bool:
        """
        Cache user profile data
        
        Args:
            user_id: User ID
            profile_data: User profile information
            ttl: Custom TTL in seconds
        """
        key = CacheManager.generate_key(cls.PREFIX_USER, str(user_id))
        ttl = ttl or cls.USER_PROFILE_TTL
        
        # Add cache metadata
        profile_data["cached_at"] = datetime.utcnow().isoformat()
        profile_data["cache_version"] = "1.0"
        
        success = await CacheManager.set_json(key, profile_data, ttl)
        if success:
            logger.debug(f"Cached profile for user: {user_id}")
        return success
    
    @classmethod
    async def get_user_profile(cls, user_id: int) -> Optional[Dict[str, Any]]:
        """
        Get cached user profile
        
        Args:
            user_id: User ID
            
        Returns:
            User profile if found
        """
        key = CacheManager.generate_key(cls.PREFIX_USER, str(user_id))
        profile = await CacheManager.get_json(key)
        
        if profile:
            logger.debug(f"Profile cache hit for user: {user_id}")
        return profile
    
    @classmethod
    async def invalidate_user_profile(cls, user_id: int) -> bool:
        """
        Invalidate cached user profile
        
        Args:
            user_id: User ID
        """
        key = CacheManager.generate_key(cls.PREFIX_USER, str(user_id))
        return await CacheManager.delete(key)
    
    # === Task Metadata Caching ===
    
    @classmethod
    async def cache_task_metadata(
        cls,
        task_id: str,
        metadata: Dict[str, Any],
        ttl: Optional[int] = None
    ) -> bool:
        """
        Cache task metadata
        
        Args:
            task_id: Task ID
            metadata: Task metadata
            ttl: Custom TTL in seconds
        """
        key = CacheManager.generate_key(cls.PREFIX_TASK, task_id)
        ttl = ttl or cls.TASK_METADATA_TTL
        
        # Add cache metadata
        metadata["cached_at"] = datetime.utcnow().isoformat()
        
        success = await CacheManager.set_json(key, metadata, ttl)
        if success:
            logger.debug(f"Cached metadata for task: {task_id}")
        return success
    
    @classmethod
    async def get_task_metadata(cls, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Get cached task metadata
        
        Args:
            task_id: Task ID
            
        Returns:
            Task metadata if found
        """
        key = CacheManager.generate_key(cls.PREFIX_TASK, task_id)
        metadata = await CacheManager.get_json(key)
        
        if metadata:
            logger.debug(f"Task metadata cache hit: {task_id}")
        return metadata
    
    @classmethod
    async def invalidate_task_metadata(cls, task_id: str) -> bool:
        """
        Invalidate cached task metadata
        
        Args:
            task_id: Task ID
        """
        key = CacheManager.generate_key(cls.PREFIX_TASK, task_id)
        return await CacheManager.delete(key)
    
    @classmethod
    async def invalidate_user_tasks(cls, user_id: int) -> int:
        """
        Invalidate all task metadata for a user
        
        Args:
            user_id: User ID
            
        Returns:
            Number of tasks invalidated
        """
        client = await RedisClient.get_client()
        if not client:
            return 0
        
        pattern = f"{cls.PREFIX_TASK}:*"
        count = 0
        
        try:
            async for key in client.scan_iter(match=pattern):
                metadata = await CacheManager.get_json(key)
                if metadata and metadata.get("user_id") == user_id:
                    await CacheManager.delete(key)
                    count += 1
        except Exception as e:
            logger.error(f"Error invalidating user tasks: {e}")
        
        return count
    
    # === Permission Caching ===
    
    @classmethod
    async def cache_permission(
        cls,
        user_id: Optional[int],
        resource_id: str,
        permission: str,
        granted: bool,
        ttl: Optional[int] = None
    ) -> bool:
        """
        Cache permission check result
        
        Args:
            user_id: User ID (None for anonymous)
            resource_id: Resource ID (e.g., task_id)
            permission: Permission type
            granted: Whether permission is granted
            ttl: Custom TTL in seconds
        """
        user_key = str(user_id) if user_id else "anonymous"
        key = CacheManager.generate_key(cls.PREFIX_PERMISSION, user_key, resource_id, permission)
        ttl = ttl or cls.PERMISSION_TTL
        
        data = {
            "granted": granted,
            "cached_at": datetime.utcnow().isoformat()
        }
        
        return await CacheManager.set_json(key, data, ttl)
    
    @classmethod
    async def get_cached_permission(
        cls,
        user_id: Optional[int],
        resource_id: str,
        permission: str
    ) -> Optional[bool]:
        """
        Get cached permission check result
        
        Args:
            user_id: User ID (None for anonymous)
            resource_id: Resource ID
            permission: Permission type
            
        Returns:
            Permission granted status if cached
        """
        user_key = str(user_id) if user_id else "anonymous"
        key = CacheManager.generate_key(cls.PREFIX_PERMISSION, user_key, resource_id, permission)
        
        result = await CacheManager.get_json(key)
        if result:
            logger.debug(f"Permission cache hit: {user_key}:{resource_id}:{permission}")
            return result.get("granted")
        return None
    
    @classmethod
    async def invalidate_resource_permissions(cls, resource_id: str) -> int:
        """
        Invalidate all cached permissions for a resource
        
        Args:
            resource_id: Resource ID
            
        Returns:
            Number of permissions invalidated
        """
        client = await RedisClient.get_client()
        if not client:
            return 0
        
        pattern = f"{cls.PREFIX_PERMISSION}:*:{resource_id}:*"
        count = 0
        
        try:
            async for key in client.scan_iter(match=pattern):
                await CacheManager.delete(key)
                count += 1
        except Exception as e:
            logger.error(f"Error invalidating permissions: {e}")
        
        return count
    
    # === Rate Limiting ===
    
    @classmethod
    async def increment_rate_limit(
        cls,
        identifier: str,
        action: str,
        window_seconds: int = 60
    ) -> int:
        """
        Increment rate limit counter
        
        Args:
            identifier: User ID or IP address
            action: Action being rate limited
            window_seconds: Time window in seconds
            
        Returns:
            Current count in window
        """
        client = await RedisClient.get_client()
        if not client:
            return 0
        
        # Create time-based key
        current_minute = int(datetime.utcnow().timestamp() / window_seconds)
        key = CacheManager.generate_key(cls.PREFIX_RATE_LIMIT, identifier, action, str(current_minute))
        
        try:
            # Increment counter
            count = await client.incr(key)
            
            # Set expiration on first increment
            if count == 1:
                await client.expire(key, window_seconds + 10)  # Add buffer
            
            return count
        except Exception as e:
            logger.error(f"Rate limit error: {e}")
            return 0
    
    @classmethod
    async def check_rate_limit(
        cls,
        identifier: str,
        action: str,
        limit: int,
        window_seconds: int = 60
    ) -> bool:
        """
        Check if rate limit is exceeded
        
        Args:
            identifier: User ID or IP address
            action: Action being rate limited
            limit: Maximum allowed in window
            window_seconds: Time window in seconds
            
        Returns:
            True if within limit, False if exceeded
        """
        count = await cls.increment_rate_limit(identifier, action, window_seconds)
        return count <= limit
    
    # === Token Blacklisting ===
    
    @classmethod
    async def blacklist_token(cls, token: str, ttl: int = 86400) -> bool:
        """
        Add token to blacklist
        
        Args:
            token: JWT token to blacklist
            ttl: Time to keep in blacklist
        """
        # Hash token for storage
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        key = CacheManager.generate_key(cls.PREFIX_TOKEN_BLACKLIST, token_hash)
        
        data = {
            "blacklisted_at": datetime.utcnow().isoformat(),
            "reason": "user_logout"
        }
        
        return await CacheManager.set_json(key, data, ttl)
    
    @classmethod
    async def is_token_blacklisted(cls, token: str) -> bool:
        """
        Check if token is blacklisted
        
        Args:
            token: JWT token to check
            
        Returns:
            True if blacklisted
        """
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        key = CacheManager.generate_key(cls.PREFIX_TOKEN_BLACKLIST, token_hash)
        
        return await CacheManager.exists(key)
    
    # === Cache Statistics ===
    
    @classmethod
    async def get_cache_stats(cls) -> Dict[str, Any]:
        """
        Get cache statistics
        
        Returns:
            Cache statistics including hit rates and memory usage
        """
        client = await RedisClient.get_client()
        if not client:
            return {"redis_enabled": False, "using_memory_cache": True}
        
        try:
            info = await client.info("stats")
            memory_info = await client.info("memory")
            
            return {
                "redis_enabled": True,
                "connected": True,
                "keyspace_hits": info.get("keyspace_hits", 0),
                "keyspace_misses": info.get("keyspace_misses", 0),
                "hit_rate": cls._calculate_hit_rate(
                    info.get("keyspace_hits", 0),
                    info.get("keyspace_misses", 0)
                ),
                "used_memory_human": memory_info.get("used_memory_human", "N/A"),
                "total_keys": await client.dbsize()
            }
        except Exception as e:
            logger.error(f"Error getting cache stats: {e}")
            return {"redis_enabled": True, "connected": False, "error": str(e)}
    
    @staticmethod
    def _calculate_hit_rate(hits: int, misses: int) -> float:
        """Calculate cache hit rate percentage"""
        total = hits + misses
        if total == 0:
            return 0.0
        return round((hits / total) * 100, 2)
    
    # === Cache Warming ===
    
    @classmethod
    async def warm_user_cache(cls, user_id: int, user_data: Dict[str, Any]) -> None:
        """
        Warm cache with user data after login
        
        Args:
            user_id: User ID
            user_data: User profile and related data
        """
        # Cache user profile
        if "profile" in user_data:
            await cls.cache_user_profile(user_id, user_data["profile"])
        
        # Cache session if provided
        if "session" in user_data:
            session_token = user_data["session"].get("session_token")
            if session_token:
                await cls.cache_user_session(session_token, user_data["session"])
        
        logger.info(f"Cache warmed for user: {user_id}")
    
    @classmethod
    async def clear_user_cache(cls, user_id: int) -> Dict[str, int]:
        """
        Clear all cached data for a user
        
        Args:
            user_id: User ID
            
        Returns:
            Dictionary with counts of cleared items
        """
        results = {
            "sessions": await cls.invalidate_all_user_sessions(user_id),
            "profile": 1 if await cls.invalidate_user_profile(user_id) else 0,
            "tasks": await cls.invalidate_user_tasks(user_id)
        }
        
        logger.info(f"Cleared cache for user {user_id}: {results}")
        return results