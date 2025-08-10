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
    
    def _calculate_file_hash(self, file_content: bytes, extract_type: str = "standard", split_pages: bool = False) -> str:
        """
        Calculate a unique hash for file content and processing parameters
        """
        # Create hash input combining file content and processing parameters
        hash_input = file_content + f"_{extract_type}_{split_pages}".encode()
        
        # Generate SHA256 hash
        hash_obj = hashlib.sha256(hash_input)
        return hash_obj.hexdigest()[:16]  # Use first 16 chars for brevity
    
    def _generate_cache_key(self, file_hash: str, extract_type: str, split_pages: bool) -> str:
        """
        Generate cache key from file hash and parameters
        """
        return f"{self.cache_prefix}:{extract_type}:{split_pages}:{file_hash}"
    
    async def get_cached_result(
        self, 
        file_content: bytes, 
        extract_type: str = "standard",
        split_pages: bool = False
    ) -> Optional[Dict[str, Any]]:
        """
        Get cached OCR result if available
        
        Args:
            file_content: Raw file content bytes
            extract_type: OCR extraction type
            split_pages: Whether pages are split
            
        Returns:
            Cached result dict or None if not found
        """
        try:
            file_hash = self._calculate_file_hash(file_content, extract_type, split_pages)
            cache_key = self._generate_cache_key(file_hash, extract_type, split_pages)
            
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
        extract_type: str,
        split_pages: bool,
        result_data: Dict[str, Any]
    ) -> bool:
        """
        Cache OCR result
        
        Args:
            file_content: Raw file content bytes
            extract_type: OCR extraction type  
            split_pages: Whether pages are split
            result_data: OCR result to cache
            
        Returns:
            True if successfully cached, False otherwise
        """
        try:
            file_hash = self._calculate_file_hash(file_content, extract_type, split_pages)
            cache_key = self._generate_cache_key(file_hash, extract_type, split_pages)
            
            # Add metadata to cached result
            cache_data = {
                **result_data,
                "cached_at": int(__import__('time').time()),
                "file_hash": file_hash,
                "extract_type": extract_type,
                "split_pages": split_pages
            }
            
            success = await CacheManager.set_json(cache_key, cache_data, self.ttl)
            
            if success:
                logger.info(f"Cached OCR result for file hash: {file_hash}")
            
            return success
            
        except Exception as e:
            logger.warning(f"Failed to cache OCR result: {e}")
            return False
    
    async def get_cache_info(self, file_content: bytes, extract_type: str = "standard", split_pages: bool = False) -> Dict[str, Any]:
        """
        Get cache information for a file
        """
        file_hash = self._calculate_file_hash(file_content, extract_type, split_pages)
        cache_key = self._generate_cache_key(file_hash, extract_type, split_pages)
        
        exists = await CacheManager.exists(cache_key)
        
        return {
            "file_hash": file_hash,
            "cache_key": cache_key,
            "cached": exists,
            "extract_type": extract_type,
            "split_pages": split_pages
        }
    
    async def invalidate_cache(self, file_content: bytes, extract_type: str = "standard", split_pages: bool = False) -> bool:
        """
        Invalidate cache for specific file and parameters
        """
        try:
            file_hash = self._calculate_file_hash(file_content, extract_type, split_pages)
            cache_key = self._generate_cache_key(file_hash, extract_type, split_pages)
            
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