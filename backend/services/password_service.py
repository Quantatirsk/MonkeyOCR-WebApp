"""
Password hashing and validation service
"""

import os
import re
import secrets
import logging
from typing import Optional
from passlib.context import CryptContext

logger = logging.getLogger(__name__)


class PasswordService:
    """
    Service for password hashing, verification, and validation
    """
    
    def __init__(self):
        # Configure password hashing
        self.pwd_context = CryptContext(
            schemes=["bcrypt"],
            deprecated="auto",
            bcrypt__rounds=12  # Adjust rounds for security/performance balance
        )
        
        # Password requirements (simplified for better UX)
        self.min_length = int(os.getenv("PASSWORD_MIN_LENGTH", "6"))
        self.max_length = int(os.getenv("PASSWORD_MAX_LENGTH", "128"))
        self.require_uppercase = os.getenv("PASSWORD_REQUIRE_UPPERCASE", "false").lower() == "true"
        self.require_lowercase = os.getenv("PASSWORD_REQUIRE_LOWERCASE", "false").lower() == "true"
        self.require_digit = os.getenv("PASSWORD_REQUIRE_DIGIT", "false").lower() == "true"
        self.require_special = os.getenv("PASSWORD_REQUIRE_SPECIAL", "false").lower() == "true"
        
        # Common passwords list (in production, load from file)
        self.common_passwords = {
            "password", "123456", "password123", "admin", "qwerty",
            "letmein", "welcome", "monkey", "dragon", "master"
        }
        
    
    def hash_password(self, password: str) -> str:
        """
        Hash a password (bcrypt includes salt internally)
        
        Args:
            password: Plain text password
            
        Returns:
            Password hash with salt included
        """
        # bcrypt automatically handles salting
        password_hash = self.pwd_context.hash(password)
        return password_hash
    
    def verify_password(
        self,
        plain_password: str,
        password_hash: str
    ) -> bool:
        """
        Verify a password against its hash
        
        Args:
            plain_password: Plain text password to verify
            password_hash: Stored password hash (includes salt)
            
        Returns:
            True if password matches, False otherwise
        """
        try:
            return self.pwd_context.verify(plain_password, password_hash)
        except Exception as e:
            logger.error(f"Password verification error: {str(e)}")
            return False
    
    def validate_password_strength(self, password: str) -> None:
        """
        Validate password strength against requirements
        
        Args:
            password: Password to validate
            
        Raises:
            ValueError: If password doesn't meet requirements
        """
        errors = []
        
        # Check length
        if len(password) < self.min_length:
            errors.append(f"Password must be at least {self.min_length} characters long")
        if len(password) > self.max_length:
            errors.append(f"Password must be less than {self.max_length} characters")
        
        # Check character requirements
        if self.require_uppercase and not any(c.isupper() for c in password):
            errors.append("Password must contain at least one uppercase letter")
        
        if self.require_lowercase and not any(c.islower() for c in password):
            errors.append("Password must contain at least one lowercase letter")
        
        if self.require_digit and not any(c.isdigit() for c in password):
            errors.append("Password must contain at least one digit")
        
        if self.require_special:
            special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?"
            if not any(c in special_chars for c in password):
                errors.append("Password must contain at least one special character")
        
        # Check for common passwords (only if password is very short)
        if len(password) <= 6 and password.lower() in self.common_passwords:
            errors.append("Password is too common")
        
        # Skip sequential and repeat checks for better UX
        # Users can choose their own password complexity
        
        if errors:
            raise ValueError("; ".join(errors))
    
    
    
    
    
    # Private helper methods
    
    def _has_sequential_chars(self, password: str, max_sequence: int = 3) -> bool:
        """Check for sequential characters"""
        password_lower = password.lower()
        
        # Check alphabetic sequences
        for i in range(len(password_lower) - max_sequence + 1):
            substr = password_lower[i:i + max_sequence]
            if all(ord(substr[j]) == ord(substr[j-1]) + 1 for j in range(1, len(substr))):
                return True
        
        # Check numeric sequences
        for i in range(len(password) - max_sequence + 1):
            substr = password[i:i + max_sequence]
            if substr.isdigit():
                if all(int(substr[j]) == int(substr[j-1]) + 1 for j in range(1, len(substr))):
                    return True
        
        return False
    
    def _has_excessive_repeats(self, password: str, max_repeats: int = 3) -> bool:
        """Check for excessive character repetition"""
        for i in range(len(password) - max_repeats + 1):
            if password[i] * max_repeats == password[i:i + max_repeats]:
                return True
        return False
    
