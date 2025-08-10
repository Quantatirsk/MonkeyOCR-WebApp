"""
Security headers middleware - adds security headers only
"""

import os
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware


class SecurityMiddleware(BaseHTTPMiddleware):
    """Simple security headers middleware"""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Content Security Policy
        csp_sources = os.getenv("CSP_CONNECT_SOURCES", "").strip()
        connect_src = f"'self' {csp_sources}" if csp_sources else "'self'"
        
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob: https:; "
            "font-src 'self' data:; "
            f"connect-src {connect_src}; "
            "media-src 'self'; "
            "object-src 'none'; "
            "frame-ancestors 'none';"
        )
        
        # Cache control
        if request.url.path.startswith('/static/'):
            response.headers["Cache-Control"] = "public, max-age=31536000"
        else:
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        
        return response