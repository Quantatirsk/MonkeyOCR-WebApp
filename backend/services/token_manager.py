"""
JWT Token management service
"""

import os
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError

logger = logging.getLogger(__name__)


class TokenManager:
    """
    Manager for JWT token generation and validation
    """
    
    def __init__(self):
        # Load configuration from environment - REQUIRED
        self.secret_key = os.getenv("JWT_SECRET_KEY")
        if not self.secret_key:
            raise ValueError(
                "JWT_SECRET_KEY environment variable is required. "
                "Generate a secure key with: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
            )
        
        self.algorithm = os.getenv("JWT_ALGORITHM", "HS256")
        
        # Simplified token configuration - single token type with 24h expiry
        self.token_expire_hours = int(os.getenv("TOKEN_EXPIRE_HOURS", "24"))
        
        logger.info(f"TokenManager initialized with {self.algorithm} algorithm")
    
    def create_token(
        self,
        user_id: int,
        username: str,
        email: str
    ) -> str:
        """
        Create a JWT token
        
        Args:
            user_id: User ID
            username: Username
            email: User email
            
        Returns:
            JWT token
        """
        expires_delta = timedelta(hours=self.token_expire_hours)
        expire = datetime.now(timezone.utc) + expires_delta
        
        payload = {
            "sub": str(user_id),  # Subject (user ID)
            "username": username,
            "email": email,
            "exp": expire,
            "iat": datetime.now(timezone.utc)
        }
        
        encoded_jwt = jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt
    
    def renew_token(
        self,
        token: str
    ) -> Optional[str]:
        """
        Renew a token with same claims but new expiry
        
        Args:
            token: Current valid token
            
        Returns:
            New token if successful, None otherwise
        """
        payload = self.decode_token(token)
        if not payload:
            return None
        
        # Create new token with same claims but new expiry
        return self.create_token(
            user_id=int(payload.get("sub")),
            username=payload.get("username"),
            email=payload.get("email")
        )
    
    def decode_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Decode and validate a token
        
        Args:
            token: JWT token
            
        Returns:
            Token payload if valid, None otherwise
        """
        try:
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm]
            )
            return payload
            
        except JWTError as e:
            logger.debug(f"Token decode error: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error decoding token: {str(e)}")
            return None
    
    
    def verify_token(self, token: str) -> bool:
        """
        Verify if a token is valid
        
        Args:
            token: JWT token
            
        Returns:
            True if valid, False otherwise
        """
        payload = self.decode_token(token)
        return payload is not None
    
    
    
    def get_token_expiry(self, token: str) -> Optional[datetime]:
        """
        Get token expiration time
        
        Args:
            token: JWT token
            
        Returns:
            Expiration datetime if valid, None otherwise
        """
        try:
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm],
                options={"verify_exp": False}
            )
            exp = payload.get("exp")
            if exp:
                return datetime.fromtimestamp(exp, tz=timezone.utc)
            return None
        except JWTError:
            return None
    
    def extract_user_id(self, token: str) -> Optional[int]:
        """
        Extract user ID from token
        
        Args:
            token: JWT token
            
        Returns:
            User ID if valid, None otherwise
        """
        payload = self.decode_token(token)
        if payload:
            try:
                return int(payload.get("sub"))
            except (TypeError, ValueError):
                return None
        return None
    
    def create_email_verification_token(
        self,
        user_id: int,
        email: str
    ) -> str:
        """
        Create email verification token
        
        Args:
            user_id: User ID
            email: Email to verify
            
        Returns:
            Verification token
        """
        expires_delta = timedelta(hours=24)
        expire = datetime.now(timezone.utc) + expires_delta
        
        payload = {
            "sub": str(user_id),
            "email": email,
            "type": "email_verification",
            "exp": expire,
            "iat": datetime.now(timezone.utc)
        }
        
        encoded_jwt = jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt
    
    def create_password_reset_token(
        self,
        user_id: int,
        email: str
    ) -> str:
        """
        Create password reset token
        
        Args:
            user_id: User ID
            email: User email
            
        Returns:
            Reset token
        """
        expires_delta = timedelta(hours=1)
        expire = datetime.now(timezone.utc) + expires_delta
        
        payload = {
            "sub": str(user_id),
            "email": email,
            "type": "password_reset",
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "jti": self._generate_jti()
        }
        
        encoded_jwt = jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt
    
    def validate_email_verification_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Validate email verification token
        
        Args:
            token: Verification token
            
        Returns:
            Token payload if valid
        """
        try:
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm]
            )
            
            if payload.get("type") != "email_verification":
                return None
            
            return payload
        except JWTError:
            return None
    
    def validate_password_reset_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Validate password reset token
        
        Args:
            token: Reset token
            
        Returns:
            Token payload if valid
        """
        try:
            # Check if token is blacklisted
            if self._is_token_blacklisted(token):
                return None
            
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm]
            )
            
            if payload.get("type") != "password_reset":
                return None
            
            return payload
        except JWTError:
            return None
    
    # Private helper methods
    
