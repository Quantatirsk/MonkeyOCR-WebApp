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
        # Load configuration from environment
        self.secret_key = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
        self.algorithm = os.getenv("JWT_ALGORITHM", "HS256")
        
        # Token expiration times
        self.access_token_expire_minutes = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
        self.refresh_token_expire_days = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
        
        # Token blacklist (in production, use Redis)
        self.blacklisted_tokens = set()
        
        if self.secret_key == "your-secret-key-change-in-production":
            logger.warning("Using default JWT secret key - CHANGE THIS IN PRODUCTION!")
    
    def create_access_token(
        self,
        user_id: int,
        username: str,
        email: str,
        additional_claims: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Create an access token
        
        Args:
            user_id: User ID
            username: Username
            email: User email
            additional_claims: Additional JWT claims
            
        Returns:
            JWT access token
        """
        expires_delta = timedelta(minutes=self.access_token_expire_minutes)
        expire = datetime.now(timezone.utc) + expires_delta
        
        payload = {
            "sub": str(user_id),  # Subject (user ID)
            "username": username,
            "email": email,
            "type": "access",
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "jti": self._generate_jti()  # JWT ID for blacklisting
        }
        
        if additional_claims:
            payload.update(additional_claims)
        
        encoded_jwt = jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt
    
    def create_refresh_token(
        self,
        user_id: int,
        session_token: str,
        additional_claims: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Create a refresh token
        
        Args:
            user_id: User ID
            session_token: Session token for validation
            additional_claims: Additional JWT claims
            
        Returns:
            JWT refresh token
        """
        expires_delta = timedelta(days=self.refresh_token_expire_days)
        expire = datetime.now(timezone.utc) + expires_delta
        
        payload = {
            "sub": str(user_id),
            "user_id": user_id,
            "session_token": session_token,
            "type": "refresh",
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "jti": self._generate_jti()
        }
        
        if additional_claims:
            payload.update(additional_claims)
        
        encoded_jwt = jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt
    
    def decode_access_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Decode and validate an access token
        
        Args:
            token: JWT access token
            
        Returns:
            Token payload if valid, None otherwise
        """
        try:
            # Check if token is blacklisted
            if self._is_token_blacklisted(token):
                logger.warning("Attempted to use blacklisted token")
                return None
            
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm]
            )
            
            # Verify token type
            if payload.get("type") != "access":
                logger.warning("Invalid token type for access token")
                return None
            
            return payload
            
        except JWTError as e:
            logger.debug(f"Token decode error: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error decoding token: {str(e)}")
            return None
    
    def decode_refresh_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Decode and validate a refresh token
        
        Args:
            token: JWT refresh token
            
        Returns:
            Token payload if valid, None otherwise
        """
        try:
            # Check if token is blacklisted
            if self._is_token_blacklisted(token):
                logger.warning("Attempted to use blacklisted refresh token")
                return None
            
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm]
            )
            
            # Verify token type
            if payload.get("type") != "refresh":
                logger.warning("Invalid token type for refresh token")
                return None
            
            return payload
            
        except JWTError as e:
            logger.debug(f"Refresh token decode error: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error decoding refresh token: {str(e)}")
            return None
    
    def verify_token(self, token: str, token_type: str = "access") -> bool:
        """
        Verify if a token is valid
        
        Args:
            token: JWT token
            token_type: Expected token type ("access" or "refresh")
            
        Returns:
            True if valid, False otherwise
        """
        if token_type == "access":
            payload = self.decode_access_token(token)
        elif token_type == "refresh":
            payload = self.decode_refresh_token(token)
        else:
            return False
        
        return payload is not None
    
    def blacklist_token(self, token: str) -> None:
        """
        Add a token to the blacklist
        
        Args:
            token: JWT token to blacklist
        """
        # In production, store in Redis with TTL
        try:
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm],
                options={"verify_exp": False}  # Don't verify expiration
            )
            jti = payload.get("jti")
            if jti:
                self.blacklisted_tokens.add(jti)
                logger.info(f"Token blacklisted: {jti}")
        except JWTError:
            # If we can't decode it, just blacklist the whole token
            self.blacklisted_tokens.add(token[:50])  # Store first 50 chars
            logger.info("Token blacklisted (could not decode)")
    
    def rotate_refresh_token(
        self,
        old_refresh_token: str
    ) -> Optional[str]:
        """
        Rotate a refresh token (invalidate old, create new)
        
        Args:
            old_refresh_token: Current refresh token
            
        Returns:
            New refresh token if successful, None otherwise
        """
        # Decode old token
        payload = self.decode_refresh_token(old_refresh_token)
        if not payload:
            return None
        
        # Blacklist old token
        self.blacklist_token(old_refresh_token)
        
        # Create new refresh token
        new_token = self.create_refresh_token(
            user_id=payload.get("user_id"),
            session_token=payload.get("session_token")
        )
        
        return new_token
    
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
        payload = self.decode_access_token(token)
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
    
    def _generate_jti(self) -> str:
        """Generate unique JWT ID"""
        import uuid
        return str(uuid.uuid4())
    
    def _is_token_blacklisted(self, token: str) -> bool:
        """Check if token is blacklisted"""
        # Try to get JTI from token
        try:
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm],
                options={"verify_exp": False, "verify_signature": False}
            )
            jti = payload.get("jti")
            if jti and jti in self.blacklisted_tokens:
                return True
        except JWTError:
            pass
        
        # Check if token itself is blacklisted (first 50 chars)
        return token[:50] in self.blacklisted_tokens