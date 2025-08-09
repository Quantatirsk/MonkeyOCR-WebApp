"""
Authentication API endpoints
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field

from database import get_db_manager
from services import AuthenticationService
from dependencies.auth import get_current_user, get_current_user_optional

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
security = HTTPBearer()


# Request/Response models

class UserRegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Unique username")
    email: EmailStr = Field(..., description="Valid email address")
    password: str = Field(..., min_length=8, max_length=128, description="Strong password")


class UserLoginRequest(BaseModel):
    email_or_username: str = Field(..., description="Email or username")
    password: str = Field(..., description="Password")


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_verified: bool
    is_active: bool = True


class AuthResponse(BaseModel):
    user: UserResponse
    tokens: TokenResponse


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=8, max_length=128)


class ResetPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordConfirmRequest(BaseModel):
    reset_token: str
    new_password: str = Field(..., min_length=8, max_length=128)


class UpdateProfileRequest(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    preferences: Optional[dict] = None


class EmailVerificationRequest(BaseModel):
    verification_code: str


# Helper function to get auth service
async def get_auth_service():
    db_manager = get_db_manager()
    return AuthenticationService(db_manager)


# API Endpoints

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: UserRegisterRequest,
    auth_service: AuthenticationService = Depends(get_auth_service)
):
    """
    Register a new user account
    """
    try:
        result = await auth_service.register_user(
            username=request.username,
            email=request.email,
            password=request.password,
            auto_verify=False  # Require email verification
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        if "already registered" in str(e).lower() or "already taken" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(e)
            )
        logger.error(f"Registration error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )


@router.post("/login", response_model=AuthResponse)
async def login(
    request: UserLoginRequest,
    req: Request,
    auth_service: AuthenticationService = Depends(get_auth_service)
):
    """
    Login with email/username and password
    """
    try:
        # Get client info
        ip_address = req.client.host if req.client else None
        user_agent = req.headers.get("user-agent")
        
        result = await auth_service.login(
            email_or_username=request.email_or_username,
            password=request.password,
            ip_address=ip_address,
            user_agent=user_agent
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except Exception as e:
        if "locked" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=str(e)
            )
        if "deactivated" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=str(e)
            )
        logger.error(f"Login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    current_user: dict = Depends(get_current_user),
    auth_service: AuthenticationService = Depends(get_auth_service)
):
    """
    Logout current session
    """
    try:
        # Get session token from current user context
        session_token = current_user.get("session_token")
        if session_token:
            await auth_service.logout(session_token)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except Exception as e:
        logger.error(f"Logout error: {e}")
        # Still return success even if logout fails
        return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
async def logout_all_sessions(
    current_user: dict = Depends(get_current_user),
    auth_service: AuthenticationService = Depends(get_auth_service)
):
    """
    Logout from all sessions
    """
    try:
        user_id = current_user.get("user_id")
        await auth_service.logout_all_sessions(user_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except Exception as e:
        logger.error(f"Logout all error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to logout all sessions"
        )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(
    request: RefreshTokenRequest,
    req: Request,
    auth_service: AuthenticationService = Depends(get_auth_service)
):
    """
    Refresh access and refresh tokens
    """
    try:
        # Get client info
        ip_address = req.client.host if req.client else None
        user_agent = req.headers.get("user-agent")
        
        result = await auth_service.refresh_tokens(
            refresh_token=request.refresh_token,
            ip_address=ip_address,
            user_agent=user_agent
        )
        return TokenResponse(**result)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token refresh failed"
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: dict = Depends(get_current_user),
    auth_service: AuthenticationService = Depends(get_auth_service)
):
    """
    Get current user profile
    """
    try:
        user_id = current_user.get("user_id")
        profile = await auth_service.get_user_profile(user_id)
        
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return UserResponse(
            id=profile["id"],
            username=profile["username"],
            email=profile["email"],
            is_verified=profile["is_verified"],
            is_active=profile["is_active"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get profile error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get profile"
        )


@router.put("/me")
async def update_current_user_profile(
    request: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
    auth_service: AuthenticationService = Depends(get_auth_service)
):
    """
    Update current user profile
    """
    try:
        user_id = current_user.get("user_id")
        
        updates = {}
        if request.username is not None:
            updates["username"] = request.username
        if request.preferences is not None:
            updates["preferences"] = request.preferences
        
        success = await auth_service.update_user_profile(user_id, updates)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to update profile"
            )
        
        # Return updated profile
        profile = await auth_service.get_user_profile(user_id)
        return UserResponse(
            id=profile["id"],
            username=profile["username"],
            email=profile["email"],
            is_verified=profile["is_verified"],
            is_active=profile["is_active"]
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update profile error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile"
        )


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    request: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    auth_service: AuthenticationService = Depends(get_auth_service)
):
    """
    Change password for current user
    """
    try:
        user_id = current_user.get("user_id")
        
        success = await auth_service.change_password(
            user_id=user_id,
            old_password=request.old_password,
            new_password=request.new_password
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to change password"
            )
        
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Change password error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change password"
        )


@router.post("/verify-email", status_code=status.HTTP_204_NO_CONTENT)
async def verify_email(
    request: EmailVerificationRequest,
    current_user: dict = Depends(get_current_user),
    auth_service: AuthenticationService = Depends(get_auth_service)
):
    """
    Verify email address
    """
    try:
        user_id = current_user.get("user_id")
        
        success = await auth_service.verify_email(
            user_id=user_id,
            verification_code=request.verification_code
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code"
            )
        
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Email verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Email verification failed"
        )


@router.post("/reset-password")
async def request_password_reset(
    request: ResetPasswordRequest,
    auth_service: AuthenticationService = Depends(get_auth_service)
):
    """
    Request password reset email
    """
    try:
        reset_token = await auth_service.request_password_reset(request.email)
        
        # Don't reveal if email exists
        return {
            "message": "If the email exists, a password reset link has been sent"
        }
    except Exception as e:
        logger.error(f"Password reset request error: {e}")
        # Still return success to not reveal email existence
        return {
            "message": "If the email exists, a password reset link has been sent"
        }


@router.post("/reset-password-confirm", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password_confirm(
    request: ResetPasswordConfirmRequest,
    auth_service: AuthenticationService = Depends(get_auth_service)
):
    """
    Reset password with reset token
    """
    try:
        success = await auth_service.reset_password(
            reset_token=request.reset_token,
            new_password=request.new_password
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token"
            )
        
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password reset confirm error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password reset failed"
        )


@router.get("/check", response_model=dict)
async def check_auth_status(
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Check authentication status
    """
    if current_user:
        return {
            "authenticated": True,
            "user_id": current_user.get("user_id"),
            "username": current_user.get("username"),
            "email": current_user.get("email")
        }
    else:
        return {
            "authenticated": False
        }