"""
Authentication middleware for FastAPI
"""

import logging
import time
from typing import Optional
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from services import TokenManager

logger = logging.getLogger(__name__)


class AuthenticationMiddleware(BaseHTTPMiddleware):
    """
    Middleware for handling authentication and session tracking
    """
    
    def __init__(self, app, excluded_paths: Optional[list] = None):
        super().__init__(app)
        self.token_manager = TokenManager()
        # Paths that don't require authentication
        self.excluded_paths = excluded_paths or [
            "/",
            "/health",
            "/api/auth/register",
            "/api/auth/login",
            "/api/auth/reset-password",
            "/api/health",
            "/static",
            "/assets",
            "/docs",
            "/openapi.json",
            "/redoc"
        ]
    
    async def dispatch(self, request: Request, call_next):
        """
        Process each request
        """
        start_time = time.time()
        
        # Skip authentication for excluded paths
        if self._is_excluded_path(request.url.path):
            response = await call_next(request)
            return self._add_timing_header(response, start_time)
        
        # Extract token from Authorization header
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]  # Remove "Bearer " prefix
            
            # Validate token
            payload = self.token_manager.decode_access_token(token)
            if payload:
                # Add user context to request state
                request.state.user_id = payload.get("sub")
                request.state.username = payload.get("username")
                request.state.email = payload.get("email")
                request.state.is_authenticated = True
                
                # Log authenticated request
                logger.debug(
                    f"Authenticated request: {request.method} {request.url.path} "
                    f"by user {request.state.username}"
                )
            else:
                # Invalid token
                request.state.is_authenticated = False
                
                # For protected endpoints, return 401
                if self._requires_authentication(request.url.path):
                    return JSONResponse(
                        status_code=401,
                        content={"detail": "Invalid or expired token"}
                    )
        else:
            request.state.is_authenticated = False
            
            # For protected endpoints, return 401
            if self._requires_authentication(request.url.path):
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Authentication required"}
                )
        
        # Process request
        response = await call_next(request)
        
        # Add timing and auth headers
        response = self._add_timing_header(response, start_time)
        response = self._add_auth_headers(response, request)
        
        return response
    
    def _is_excluded_path(self, path: str) -> bool:
        """
        Check if path is excluded from authentication
        """
        for excluded in self.excluded_paths:
            if path.startswith(excluded):
                return True
        return False
    
    def _requires_authentication(self, path: str) -> bool:
        """
        Check if path requires authentication
        """
        # Public endpoints that don't require auth
        public_endpoints = [
            "/api/sync",  # Can be accessed anonymously for public tasks
            "/api/upload",  # Can upload anonymously
            "/api/tasks",  # Can view public tasks
        ]
        
        for public in public_endpoints:
            if path.startswith(public):
                return False
        
        # All other /api endpoints require authentication
        return path.startswith("/api/")
    
    def _add_timing_header(self, response: Response, start_time: float) -> Response:
        """
        Add request processing time header
        """
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        return response
    
    def _add_auth_headers(self, response: Response, request: Request) -> Response:
        """
        Add authentication-related headers
        """
        if hasattr(request.state, "is_authenticated") and request.state.is_authenticated:
            response.headers["X-Authenticated"] = "true"
            if hasattr(request.state, "username"):
                response.headers["X-Username"] = request.state.username
        else:
            response.headers["X-Authenticated"] = "false"
        
        return response


class SessionTrackingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for tracking user sessions and activity
    """
    
    def __init__(self, app):
        super().__init__(app)
        self.active_sessions = {}  # In production, use Redis
    
    async def dispatch(self, request: Request, call_next):
        """
        Track user activity
        """
        # Update session activity if authenticated
        if hasattr(request.state, "is_authenticated") and request.state.is_authenticated:
            user_id = getattr(request.state, "user_id", None)
            if user_id:
                self._update_session_activity(user_id, request)
        
        response = await call_next(request)
        
        # Add session count header for monitoring
        response.headers["X-Active-Sessions"] = str(len(self.active_sessions))
        
        return response
    
    def _update_session_activity(self, user_id: str, request: Request):
        """
        Update session activity tracking
        """
        self.active_sessions[user_id] = {
            "last_activity": time.time(),
            "ip_address": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
            "last_path": request.url.path
        }
        
        # Clean up old sessions (inactive for more than 30 minutes)
        current_time = time.time()
        inactive_threshold = 30 * 60  # 30 minutes
        
        self.active_sessions = {
            uid: session for uid, session in self.active_sessions.items()
            if current_time - session["last_activity"] < inactive_threshold
        }


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Simple rate limiting middleware
    """
    
    def __init__(
        self,
        app,
        requests_per_minute: int = 60,
        burst_size: int = 10
    ):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.burst_size = burst_size
        self.request_counts = {}  # In production, use Redis
    
    async def dispatch(self, request: Request, call_next):
        """
        Apply rate limiting
        """
        # Get client identifier (user ID or IP)
        client_id = self._get_client_id(request)
        
        # Check rate limit
        if not self._check_rate_limit(client_id):
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded"}
            )
        
        response = await call_next(request)
        
        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(
            self._get_remaining_requests(client_id)
        )
        
        return response
    
    def _get_client_id(self, request: Request) -> str:
        """
        Get client identifier for rate limiting
        """
        # Prefer user ID if authenticated
        if hasattr(request.state, "user_id"):
            return f"user:{request.state.user_id}"
        
        # Fall back to IP address
        if request.client:
            return f"ip:{request.client.host}"
        
        return "unknown"
    
    def _check_rate_limit(self, client_id: str) -> bool:
        """
        Check if client has exceeded rate limit
        """
        current_time = time.time()
        minute_key = int(current_time / 60)
        
        if client_id not in self.request_counts:
            self.request_counts[client_id] = {}
        
        # Clean up old entries
        self.request_counts[client_id] = {
            k: v for k, v in self.request_counts[client_id].items()
            if k >= minute_key - 1
        }
        
        # Count requests in current minute
        current_count = self.request_counts[client_id].get(minute_key, 0)
        
        if current_count >= self.requests_per_minute:
            return False
        
        # Increment count
        self.request_counts[client_id][minute_key] = current_count + 1
        
        return True
    
    def _get_remaining_requests(self, client_id: str) -> int:
        """
        Get remaining requests for client
        """
        current_time = time.time()
        minute_key = int(current_time / 60)
        
        if client_id in self.request_counts:
            current_count = self.request_counts[client_id].get(minute_key, 0)
            return max(0, self.requests_per_minute - current_count)
        
        return self.requests_per_minute