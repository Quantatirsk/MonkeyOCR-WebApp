"""
Authentication API endpoints
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field

from database import get_db_manager
from services.auth import AuthService
from dependencies.auth import get_current_user, get_current_user_optional

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
security = HTTPBearer()


# Request/Response models

class UserRegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Unique username")
    email: EmailStr = Field(..., description="Valid email address")
    password: str = Field(..., min_length=6, max_length=128, description="Password")


class UserLoginRequest(BaseModel):
    email_or_username: str = Field(..., description="Email or username")
    password: str = Field(..., description="Password")


class TokenResponse(BaseModel):
    token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_verified: bool
    is_active: bool = True


class AuthResponse(BaseModel):
    user: UserResponse
    token: str




class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=6, max_length=128)


class ResetPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordConfirmRequest(BaseModel):
    reset_token: str
    new_password: str = Field(..., min_length=6, max_length=128)


class UpdateProfileRequest(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    preferences: Optional[dict] = None


class EmailVerificationRequest(BaseModel):
    verification_code: str


# Helper function to get auth service
async def get_auth_service():
    db_manager = get_db_manager()
    return AuthService(db_manager)


# API Endpoints

@router.post("/register")
async def register(
    request: UserRegisterRequest,
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Register a new user account
    """
    try:
        result = await auth_service.register(
            email=request.email,
            username=request.username,
            password=request.password
        )
        return result  # AuthService now returns the complete response
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/login")
async def login(
    request: UserLoginRequest,
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Login with email/username and password
    """
    try:
        result = await auth_service.login(
            email_or_username=request.email_or_username,
            password=request.password
        )
        return result  # AuthService now returns the complete response
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )


# Logout is handled client-side with JWT (stateless)




@router.post("/token/renew", response_model=TokenResponse)
async def renew_token(
    current_user: dict = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Renew token before expiry
    """
    try:
        new_token = await auth_service.renew_token(current_user["token"])
        if not new_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Failed to renew token"
            )
        return TokenResponse(token=new_token)
    except Exception as e:
        logger.error(f"Token renewal error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token renewal failed"
        )


@router.get("/me")
async def get_current_user_profile(
    current_user: dict = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Get current user profile
    """
    try:
        profile = await auth_service.get_user_profile(current_user["user_id"])
        
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return profile
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get profile error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get profile"
        )




@router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    request: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Change password for current user
    """
    try:
        success = await auth_service.change_password(
            user_id=current_user["user_id"],
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








@router.get("/validate")
async def validate_token(
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Validate current token
    """
    if current_user:
        return {
            "valid": True,
            "user": {
                "id": current_user.get("user_id"),
                "username": current_user.get("username"),
                "email": current_user.get("email")
            }
        }
    else:
        return {
            "valid": False
        }