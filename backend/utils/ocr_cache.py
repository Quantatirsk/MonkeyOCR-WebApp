"""
OCR result caching utility
Caches OCR results based on file content hash to avoid redundant processing
"""

import hashlib
import json
import logging
import os
from typing import Optional, Dict, Any
from pathlib import Path
from utils.redis_client import CacheManager

logger = logging.getLogger(__name__)


class OCRCache:
    """
    OCR result cache manager
    Caches OCR results based on file content hash and processing parameters
    """
    
    def __init__(self, ttl: int = 86400 * 30):  # 30 days default TTL
        self.ttl = ttl
        self.cache_prefix = "ocr"
    
    def _calculate_file_hash(self, file_content: bytes) -> str:
        """
        Calculate a unique hash for file content
        """
        # Generate SHA256 hash from file content only
        hash_obj = hashlib.sha256(file_content)
        return hash_obj.hexdigest()[:16]  # Use first 16 chars for brevity
    
    def _generate_cache_key(self, file_hash: str) -> str:
        """
        Generate cache key from file hash
        """
        return f"{self.cache_prefix}:{file_hash}"
    
    async def get_cached_result(
        self, 
        file_content: bytes
    ) -> Optional[Dict[str, Any]]:
        """
        Get cached OCR result if available
        
        Args:
            file_content: Raw file content bytes
            
        Returns:
            Cached result dict or None if not found
        """
        try:
            file_hash = self._calculate_file_hash(file_content)
            cache_key = self._generate_cache_key(file_hash)
            
            cached_data = await CacheManager.get_json(cache_key)
            
            if cached_data:
                logger.info(f"OCR cache hit for file hash: {file_hash}")
                return cached_data
            
            logger.debug(f"OCR cache miss for file hash: {file_hash}")
            return None
            
        except Exception as e:
            logger.warning(f"Failed to get cached OCR result: {e}")
            return None
    
    async def cache_result(
        self,
        file_content: bytes,
        result_data: Dict[str, Any]
    ) -> bool:
        """
        Cache OCR result
        
        Args:
            file_content: Raw file content bytes
            result_data: OCR result to cache
            
        Returns:
            True if successfully cached, False otherwise
        """
        try:
            file_hash = self._calculate_file_hash(file_content)
            cache_key = self._generate_cache_key(file_hash)
            
            # Add metadata to cached result
            cache_data = {
                **result_data,
                "cached_at": int(__import__('time').time()),
                "file_hash": file_hash
            }
            
            success = await CacheManager.set_json(cache_key, cache_data, self.ttl)
            
            if success:
                logger.info(f"Cached OCR result for file hash: {file_hash}")
            
            return success
            
        except Exception as e:
            logger.warning(f"Failed to cache OCR result: {e}")
            return False
    
    async def get_cache_info(self, file_content: bytes) -> Dict[str, Any]:
        """
        Get cache information for a file
        """
        file_hash = self._calculate_file_hash(file_content)
        cache_key = self._generate_cache_key(file_hash)
        
        exists = await CacheManager.exists(cache_key)
        
        return {
            "file_hash": file_hash,
            "cache_key": cache_key,
            "cached": exists
        }
    
    async def invalidate_cache(self, file_content: bytes) -> bool:
        """
        Invalidate cache for specific file
        """
        try:
            file_hash = self._calculate_file_hash(file_content)
            cache_key = self._generate_cache_key(file_hash)
            
            success = await CacheManager.delete(cache_key)
            
            if success:
                logger.info(f"Invalidated OCR cache for file hash: {file_hash}")
            
            return success
            
        except Exception as e:
            logger.warning(f"Failed to invalidate OCR cache: {e}")
            return False
    
    async def get_cache_stats(self) -> Dict[str, Any]:
        """
        Get OCR cache statistics
        """
        return {
            "cache_enabled": True,
            "ttl_days": self.ttl // 86400,
            "prefix": self.cache_prefix,
            "hash_algorithm": "SHA256"
        }


# Global OCR cache instance
ocr_cache = OCRCache()