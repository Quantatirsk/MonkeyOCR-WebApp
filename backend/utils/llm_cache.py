"""
LLM response caching utility
Caches LLM responses to reduce API calls and improve response time
"""

import hashlib
import json
import logging
from typing import Optional, Dict, Any, List
from utils.redis_client import CacheManager

logger = logging.getLogger(__name__)


class LLMCache:
    """
    LLM response cache manager
    Caches chat completions based on message content hash
    """
    
    def __init__(self, ttl: int = 3600):  # 1 hour default TTL
        self.ttl = ttl
        self.cache_prefix = "llm"
    
    def _generate_cache_key(self, messages: List[Dict], model: str, **kwargs) -> str:
        """
        Generate a unique cache key based on request parameters
        """
        # Create a stable hash from the request
        cache_data = {
            "messages": messages,
            "model": model,
            "temperature": kwargs.get("temperature", 0.7),
            "max_tokens": kwargs.get("max_tokens"),
            "top_p": kwargs.get("top_p", 1.0)
        }
        
        # Convert to stable JSON string
        cache_str = json.dumps(cache_data, sort_keys=True, ensure_ascii=True)
        
        # Generate SHA256 hash
        hash_obj = hashlib.sha256(cache_str.encode())
        hash_hex = hash_obj.hexdigest()[:16]  # Use first 16 chars for brevity
        
        return f"{self.cache_prefix}:{model}:{hash_hex}"
    
    async def get_cached_response(
        self, 
        messages: List[Dict], 
        model: str, 
        **kwargs
    ) -> Optional[Dict]:
        """
        Get cached LLM response if available
        """
        try:
            cache_key = self._generate_cache_key(messages, model, **kwargs)
            cached_data = await CacheManager.get_json(cache_key)
            
            if cached_data:
                logger.debug(f"Cache hit for LLM request: {cache_key}")
                return cached_data
            
            logger.debug(f"Cache miss for LLM request: {cache_key}")
            return None
        except Exception as e:
            logger.warning(f"Failed to get cached LLM response: {e}")
            return None
    
    async def cache_response(
        self, 
        messages: List[Dict], 
        model: str,
        response: Dict,
        **kwargs
    ) -> bool:
        """
        Cache LLM response
        """
        try:
            cache_key = self._generate_cache_key(messages, model, **kwargs)
            success = await CacheManager.set_json(cache_key, response, self.ttl)
            
            if success:
                logger.debug(f"Cached LLM response: {cache_key}")
            
            return success
        except Exception as e:
            logger.warning(f"Failed to cache LLM response: {e}")
            return False
    
    async def invalidate_cache(self, pattern: Optional[str] = None) -> int:
        """
        Invalidate cached responses
        If pattern is provided, only invalidate matching keys
        """
        # This would require implementing a pattern-based delete in CacheManager
        # For now, we can only delete specific keys
        logger.info("Cache invalidation requested")
        return 0
    
    async def get_cache_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics
        """
        # This would require implementing cache statistics in Redis
        return {
            "cache_enabled": True,
            "ttl": self.ttl,
            "prefix": self.cache_prefix
        }


# Global LLM cache instance
llm_cache = LLMCache()