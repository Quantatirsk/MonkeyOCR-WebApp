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
        
        # Content Security Policy - 完全解除限制以提供更大灵活性
        # 注意：在生产环境中建议启用适当的 CSP 策略
        # response.headers["Content-Security-Policy"] = "default-src *; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline';"
        
        # 完全移除 CSP 限制
        # 如果需要恢复，取消注释上面的行
        
        # Cache control
        if request.url.path.startswith('/static/'):
            response.headers["Cache-Control"] = "public, max-age=31536000"
        else:
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        
        return response