"""
Authentication dependencies for FastAPI
"""

import logging
from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from database import get_db_manager, DatabaseManager
from services.auth import AuthService
from services.token_manager import TokenManager

logger = logging.getLogger(__name__)

# Security scheme
security = HTTPBearer(auto_error=False)


async def get_db_session() -> DatabaseManager:
    """
    Get database manager instance
    """
    return get_db_manager()


async def get_token_from_header(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[str]:
    """
    Extract token from Authorization header
    """
    logger.debug(f"get_token_from_header - credentials present: {credentials is not None}")
    if credentials:
        logger.debug(f"get_token_from_header - scheme: {credentials.scheme}")
        if credentials.scheme == "Bearer":
            logger.debug(f"get_token_from_header - token extracted, length: {len(credentials.credentials)}")
            return credentials.credentials
        else:
            logger.warning(f"get_token_from_header - Wrong scheme: {credentials.scheme}, expected Bearer")
    else:
        logger.debug("get_token_from_header - No credentials in request")
    return None


async def get_current_user(
    token: Optional[str] = Depends(get_token_from_header),
    db: DatabaseManager = Depends(get_db_session)
) -> Dict[str, Any]:
    """
    Get current authenticated user (required)
    
    Returns:
        User information dict
        
    Raises:
        HTTPException: If not authenticated or token invalid
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Validate token and get user info
    auth_service = AuthService(db)
    user_info = await auth_service.validate_token(token)
    
    if not user_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Token is valid, return user info
    return {
        "user_id": user_info["user_id"],
        "username": user_info["username"],
        "email": user_info["email"],
        "token": token
    }


async def get_current_user_optional(
    token: Optional[str] = Depends(get_token_from_header),
    db: DatabaseManager = Depends(get_db_session)
) -> Optional[Dict[str, Any]]:
    """
    Get current authenticated user (optional)
    
    Returns:
        User information dict if authenticated, None otherwise
    """
    logger.debug(f"get_current_user_optional - token present: {token is not None}")
    if token:
        logger.debug(f"get_current_user_optional - token prefix: {token[:20] if len(token) > 20 else token}...")
    
    if not token:
        logger.debug("get_current_user_optional - No token, returning None")
        return None
    
    try:
        user = await get_current_user(token, db)
        logger.info(f"get_current_user_optional - Authenticated user: {user.get('email')} (ID: {user.get('user_id')})")
        return user
    except HTTPException as e:
        logger.warning(f"get_current_user_optional - Token validation failed: {e.detail}")
        return None




async def get_current_active_user(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db_session)
) -> Dict[str, Any]:
    """
    Get current active user with fresh data from database
    
    Returns:
        User information dict with latest data
    """
    auth_service = AuthService(db)
    user_profile = await auth_service.get_user_profile(current_user["user_id"])
    
    if not user_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if not user_profile.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )
    
    # Merge with token data
    return {
        **current_user,
        **user_profile
    }


class RateLimiter:
    """
    Simple rate limiting dependency
    (In production, use Redis for distributed rate limiting)
    """
    
    def __init__(self, requests_per_minute: int = 60):
        self.requests_per_minute = requests_per_minute
        self.requests = {}  # user_id -> list of timestamps
    
    async def __call__(
        self,
        current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
    ):
        """
        Check rate limit for current user or IP
        """
        # For now, just pass through
        # TODO: Implement actual rate limiting with Redis
        return True


# Pre-configured rate limiters
rate_limit_auth = RateLimiter(requests_per_minute=10)  # Strict for auth endpoints
rate_limit_api = RateLimiter(requests_per_minute=60)   # Normal for API endpoints
rate_limit_upload = RateLimiter(requests_per_minute=30) # Moderate for uploads


async def check_task_ownership(
    task_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db_session)
) -> bool:
    """
    Check if current user owns the task
    
    Args:
        task_id: Task ID to check
        current_user: Current authenticated user
        db: Database manager
        
    Returns:
        True if user owns task
        
    Raises:
        HTTPException: If task not found or access denied
    """
    # Query task ownership
    query = """
        SELECT user_id, is_public 
        FROM processing_tasks 
        WHERE id = ?
    """
    
    result = await db.fetch_one(query, (task_id,))
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    task_user_id = result.get("user_id")
    is_public = result.get("is_public", False)
    
    # Check ownership or public access
    if task_user_id != current_user["user_id"] and not is_public:
        # Check if task is shared with user
        share_query = """
            SELECT 1 FROM task_shares 
            WHERE task_id = ? AND shared_with_user_id = ?
        """
        share_result = await db.fetch_one(
            share_query, 
            (task_id, current_user["user_id"])
        )
        
        if not share_result:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    return True


async def get_user_task_filter(
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
) -> Optional[Dict[str, Any]]:
    """
    Get task filter for current user
    
    Returns:
        Filter dict for database queries
    """
    if current_user:
        return {"user_id": current_user["user_id"]}
    return None