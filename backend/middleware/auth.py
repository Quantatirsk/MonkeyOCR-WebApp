"""
Authentication middleware - handles token validation only
"""

import logging
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from services.token_manager import TokenManager

logger = logging.getLogger(__name__)


class AuthMiddleware(BaseHTTPMiddleware):
    """Simple authentication middleware"""
    
    # Paths that don't require authentication
    PUBLIC_PATHS = [
        "/", "/health", "/docs", "/openapi.json", "/redoc",
        "/api/auth/login", "/api/auth/register",
        "/static", "/api/sync", "/favicon.ico", "/assets"
    ]
    
    def __init__(self, app):
        super().__init__(app)
        self.token_manager = TokenManager()
    
    async def dispatch(self, request: Request, call_next):
        # Skip auth for public paths
        path = request.url.path
        if any(path.startswith(p) for p in self.PUBLIC_PATHS):
            return await call_next(request)
        
        # Skip auth for OPTIONS requests
        if request.method == "OPTIONS":
            return await call_next(request)
        
        # Check Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Authentication required"}
            )
        
        # Validate token
        token = auth_header[7:]  # Remove "Bearer " prefix
        try:
            payload = self.token_manager.decode_token(token)
            request.state.user_id = payload.get("user_id")
            request.state.username = payload.get("username")
            request.state.email = payload.get("email")
        except Exception as e:
            logger.debug(f"Token validation failed: {e}")
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or expired token"}
            )
        
        return await call_next(request)