"""
Security middleware for MonkeyOCR WebApp
"""
import time
from collections import defaultdict, deque
from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import logging

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses"""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; "
            "font-src 'self'; "
            "connect-src 'self'; "
            "media-src 'self'; "
            "object-src 'none'; "
            "frame-ancestors 'none';"
        )
        
        # Cache control for static resources
        if request.url.path.startswith('/static/'):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        else:
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple rate limiting middleware"""
    
    def __init__(self, app: ASGIApp, calls: int = 10000, period: int = 60):
        super().__init__(app)
        self.calls = calls
        self.period = period
        self.clients = defaultdict(lambda: deque())
    
    def get_client_id(self, request: Request) -> str:
        """Get client identifier (IP address)"""
        # Try to get real IP from headers (for reverse proxy setups)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fallback to direct client IP
        return request.client.host if request.client else "unknown"
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks
        if request.url.path in ["/health", "/", "/docs", "/redoc"]:
            return await call_next(request)
        
        client_id = self.get_client_id(request)
        now = time.time()
        
        # Clean old entries
        client_calls = self.clients[client_id]
        while client_calls and client_calls[0] <= now - self.period:
            client_calls.popleft()
        
        # Check rate limit
        if len(client_calls) >= self.calls:
            logger.warning(f"Rate limit exceeded for client {client_id}")
            return Response(
                content="Rate limit exceeded. Too many requests.",
                status_code=429,
                headers={"Retry-After": str(self.period)}
            )
        
        # Add current request
        client_calls.append(now)
        
        return await call_next(request)


def add_security_middleware(app: FastAPI):
    """Add all security middleware to the FastAPI app"""
    logger.info("Adding security middleware...")
    
    # Add rate limiting (10000 requests per minute per IP)
    app.add_middleware(RateLimitMiddleware, calls=10000, period=60)
    
    # Add security headers
    app.add_middleware(SecurityHeadersMiddleware)
    
    logger.info("Security middleware added successfully")