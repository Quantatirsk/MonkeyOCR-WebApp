"""
Redis client utility for general caching and task storage
"""
import json
import logging
from typing import Optional, Any, Dict
import redis.asyncio as redis
from redis.exceptions import RedisError
from config import settings

logger = logging.getLogger(__name__)


class RedisClient:
    """Redis client singleton for application-wide caching"""
    
    _instance: Optional[redis.Redis] = None
    _enabled: bool = False
    
    @classmethod
    async def initialize(cls) -> bool:
        """Initialize Redis connection"""
        if not settings.redis_enabled:
            logger.info("Redis is disabled in configuration")
            cls._enabled = False
            return False
            
        try:
            cls._instance = redis.from_url(
                settings.get_redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            await cls._instance.ping()
            cls._enabled = True
            logger.info("Redis connection established successfully")
            return True
        except Exception as e:
            logger.warning(f"Failed to connect to Redis: {e}. Using in-memory cache.")
            cls._enabled = False
            return False
    
    @classmethod
    async def get_client(cls) -> Optional[redis.Redis]:
        """Get Redis client instance"""
        if not cls._enabled:
            return None
        if cls._instance is None:
            await cls.initialize()
        return cls._instance if cls._enabled else None
    
    @classmethod
    async def close(cls):
        """Close Redis connection"""
        if cls._instance:
            await cls._instance.close()
            cls._instance = None
            cls._enabled = False
    
    @classmethod
    def is_enabled(cls) -> bool:
        """Check if Redis is enabled and connected"""
        return cls._enabled


class CacheManager:
    """Cache manager with Redis backend and in-memory fallback"""
    
    # In-memory fallback cache
    _memory_cache: Dict[str, Any] = {}
    
    @staticmethod
    def generate_key(*args) -> str:
        """Generate cache key from arguments"""
        return ":".join(str(arg) for arg in args if arg)
    
    @classmethod
    async def get(cls, key: str) -> Optional[Any]:
        """Get value from cache (Redis or memory)"""
        # Try Redis first
        client = await RedisClient.get_client()
        if client:
            try:
                value = await client.get(key)
                if value:
                    # Try to parse JSON if possible
                    try:
                        return json.loads(value)
                    except (json.JSONDecodeError, TypeError):
                        return value
            except RedisError as e:
                logger.warning(f"Redis get error: {e}")
        
        # Fallback to memory cache
        return cls._memory_cache.get(key)
    
    @classmethod
    async def set(cls, key: str, value: Any, ttl: int = 3600) -> bool:
        """Set value in cache (Redis or memory)"""
        # Serialize complex objects to JSON
        if isinstance(value, (dict, list)):
            value = json.dumps(value)
        
        # Try Redis first
        client = await RedisClient.get_client()
        if client:
            try:
                await client.setex(key, ttl, value)
                return True
            except RedisError as e:
                logger.warning(f"Redis set error: {e}")
        
        # Fallback to memory cache
        cls._memory_cache[key] = value
        return True
    
    @classmethod
    async def delete(cls, key: str) -> bool:
        """Delete value from cache"""
        # Try Redis first
        client = await RedisClient.get_client()
        if client:
            try:
                await client.delete(key)
            except RedisError as e:
                logger.warning(f"Redis delete error: {e}")
        
        # Also delete from memory cache
        cls._memory_cache.pop(key, None)
        return True
    
    @classmethod
    async def exists(cls, key: str) -> bool:
        """Check if key exists in cache"""
        # Try Redis first
        client = await RedisClient.get_client()
        if client:
            try:
                return await client.exists(key) > 0
            except RedisError as e:
                logger.warning(f"Redis exists error: {e}")
        
        # Fallback to memory cache
        return key in cls._memory_cache
    
    @classmethod
    async def set_json(cls, key: str, value: dict, ttl: int = 3600) -> bool:
        """Set JSON value in cache"""
        return await cls.set(key, json.dumps(value), ttl)
    
    @classmethod
    async def get_json(cls, key: str) -> Optional[dict]:
        """Get JSON value from cache"""
        value = await cls.get(key)
        if value:
            if isinstance(value, str):
                try:
                    return json.loads(value)
                except json.JSONDecodeError:
                    pass
            elif isinstance(value, dict):
                return value
        return None
    
    @classmethod
    def clear_memory_cache(cls):
        """Clear in-memory cache"""
        cls._memory_cache.clear()


# TaskStorage class has been removed as part of cache optimization
# Tasks are now stored only in SQLite database via SQLitePersistenceManager
# This reduces complexity and avoids data duplication between Redis and SQLite