"""
Rate limiting middleware - simple rate limiting only
"""

import logging
from typing import Dict
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from utils.memory_rate_limiter import get_rate_limiter

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple rate limiting middleware"""
    
    # Rate limits per endpoint (increased 10x for better user experience)
    LIMITS = {
        "/api/auth/login": {"limit": 50, "window": 60},      # 5 -> 50
        "/api/auth/register": {"limit": 30, "window": 60},   # 3 -> 30
        "/api/upload": {"limit": 100, "window": 60},         # 10 -> 100
        "default": {"limit": 600, "window": 60}              # 60 -> 600
    }
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for static files and health checks
        path = request.url.path
        if path.startswith("/static") or path in ["/health", "/docs", "/openapi.json"]:
            return await call_next(request)
        
        # Get rate limit config
        config = self._get_config(path)
        
        # Get identifier (user ID or IP)
        identifier = self._get_identifier(request)
        
        # Check rate limit using in-memory limiter
        rate_limiter = get_rate_limiter()
        within_limit = await rate_limiter.check_rate_limit(
            identifier=identifier,
            action=path,
            limit=config["limit"],
            window_seconds=config["window"]
        )
            
        
        if not within_limit:
            logger.warning(f"Rate limit exceeded: {identifier} on {path}")
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded"},
                headers={"Retry-After": str(config["window"])}
            )
        
        return await call_next(request)
    
    def _get_config(self, path: str) -> Dict[str, int]:
        """Get rate limit config for path"""
        return self.LIMITS.get(path, self.LIMITS["default"])
    
    def _get_identifier(self, request: Request) -> str:
        """Get identifier for rate limiting"""
        # Use user ID if authenticated
        if hasattr(request.state, "user_id"):
            return f"user:{request.state.user_id}"
        
        # Use IP address
        client_ip = request.client.host if request.client else "unknown"
        if forwarded := request.headers.get("X-Forwarded-For"):
            client_ip = forwarded.split(",")[0].strip()
        
        return f"ip:{client_ip}"