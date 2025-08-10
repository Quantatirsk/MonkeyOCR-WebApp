"""
In-memory rate limiting utility
Simple and efficient rate limiter without Redis dependency
"""

import logging
from collections import defaultdict, deque
from time import time
from typing import Dict, Deque
import asyncio

logger = logging.getLogger(__name__)


class InMemoryRateLimiter:
    """
    Simple in-memory rate limiter using sliding window algorithm
    Perfect for single-instance deployments
    """
    
    def __init__(self):
        # Store request timestamps for each identifier
        self._windows: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()
        
    async def check_rate_limit(
        self,
        identifier: str,
        action: str,
        limit: int,
        window_seconds: int = 60
    ) -> bool:
        """
        Check if rate limit is exceeded
        
        Args:
            identifier: IP address or user identifier
            action: Action being rate limited (e.g., endpoint path)
            limit: Maximum allowed in window
            window_seconds: Time window in seconds
            
        Returns:
            True if within limit, False if exceeded
        """
        key = f"{identifier}:{action}"
        now = time()
        window_start = now - window_seconds
        
        async with self._lock:
            # Get or create window for this key
            window = self._windows[key]
            
            # Remove expired entries
            while window and window[0] < window_start:
                window.popleft()
            
            # Check if limit exceeded
            if len(window) >= limit:
                logger.warning(f"Rate limit exceeded for {key}: {len(window)}/{limit}")
                return False
            
            # Add current request
            window.append(now)
            return True
    
    def clear(self):
        """Clear all rate limit data"""
        self._windows.clear()
    
    def get_stats(self) -> Dict[str, int]:
        """Get current rate limit statistics"""
        return {
            "total_keys": len(self._windows),
            "total_requests": sum(len(w) for w in self._windows.values())
        }
    
    async def cleanup_expired(self, max_age_seconds: int = 300):
        """
        Cleanup expired entries periodically
        Should be called periodically to prevent memory growth
        
        Args:
            max_age_seconds: Remove entries older than this
        """
        now = time()
        cutoff = now - max_age_seconds
        
        async with self._lock:
            # Remove old entries from each window
            for window in self._windows.values():
                while window and window[0] < cutoff:
                    window.popleft()
            
            # Remove empty windows
            empty_keys = [k for k, v in self._windows.items() if not v]
            for key in empty_keys:
                del self._windows[key]
            
            if empty_keys:
                logger.debug(f"Cleaned up {len(empty_keys)} empty rate limit windows")


# Global instance for application-wide use
_rate_limiter = InMemoryRateLimiter()


def get_rate_limiter() -> InMemoryRateLimiter:
    """Get the global rate limiter instance"""
    return _rate_limiter


# Convenience function matching the old interface
async def check_rate_limit(
    identifier: str,
    action: str,
    limit: int,
    window_seconds: int = 60
) -> bool:
    """
    Check rate limit using the global instance
    Maintains compatibility with existing code
    """
    return await _rate_limiter.check_rate_limit(
        identifier, action, limit, window_seconds
    )