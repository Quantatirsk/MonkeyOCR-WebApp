"""
Password hashing and validation service
"""

import os
import re
import secrets
import logging
from typing import Tuple, Optional, List
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
        
        # Password requirements
        self.min_length = int(os.getenv("PASSWORD_MIN_LENGTH", "8"))
        self.max_length = int(os.getenv("PASSWORD_MAX_LENGTH", "128"))
        self.require_uppercase = os.getenv("PASSWORD_REQUIRE_UPPERCASE", "true").lower() == "true"
        self.require_lowercase = os.getenv("PASSWORD_REQUIRE_LOWERCASE", "true").lower() == "true"
        self.require_digit = os.getenv("PASSWORD_REQUIRE_DIGIT", "true").lower() == "true"
        self.require_special = os.getenv("PASSWORD_REQUIRE_SPECIAL", "false").lower() == "true"
        
        # Common passwords list (in production, load from file)
        self.common_passwords = {
            "password", "123456", "password123", "admin", "qwerty",
            "letmein", "welcome", "monkey", "dragon", "master"
        }
        
        # Password history tracking
        self.password_history_size = int(os.getenv("PASSWORD_HISTORY_SIZE", "5"))
    
    def hash_password(self, password: str) -> Tuple[str, str]:
        """
        Hash a password with salt
        
        Args:
            password: Plain text password
            
        Returns:
            Tuple of (password_hash, salt)
        """
        # Generate salt
        salt = secrets.token_hex(32)
        
        # Combine password with salt
        salted_password = password + salt
        
        # Hash the salted password
        password_hash = self.pwd_context.hash(salted_password)
        
        return password_hash, salt
    
    def verify_password(
        self,
        plain_password: str,
        password_hash: str,
        salt: str
    ) -> bool:
        """
        Verify a password against its hash
        
        Args:
            plain_password: Plain text password to verify
            password_hash: Stored password hash
            salt: Stored salt
            
        Returns:
            True if password matches, False otherwise
        """
        # Combine password with salt
        salted_password = plain_password + salt
        
        # Verify against hash
        try:
            return self.pwd_context.verify(salted_password, password_hash)
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
        
        # Check for common passwords
        if password.lower() in self.common_passwords:
            errors.append("Password is too common")
        
        # Check for sequential characters
        if self._has_sequential_chars(password):
            errors.append("Password contains too many sequential characters")
        
        # Check for repeated characters
        if self._has_excessive_repeats(password):
            errors.append("Password contains too many repeated characters")
        
        if errors:
            raise ValueError("; ".join(errors))
    
    def check_password_history(
        self,
        new_password: str,
        password_history: List[Tuple[str, str]]
    ) -> bool:
        """
        Check if password was recently used
        
        Args:
            new_password: New password to check
            password_history: List of (hash, salt) tuples
            
        Returns:
            True if password is in history, False otherwise
        """
        for password_hash, salt in password_history[:self.password_history_size]:
            if self.verify_password(new_password, password_hash, salt):
                return True
        return False
    
    def generate_secure_password(
        self,
        length: int = 16,
        include_special: bool = True
    ) -> str:
        """
        Generate a secure random password
        
        Args:
            length: Password length
            include_special: Include special characters
            
        Returns:
            Generated password
        """
        # Character sets
        lowercase = "abcdefghijklmnopqrstuvwxyz"
        uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        digits = "0123456789"
        special = "!@#$%^&*()_+-=[]{}|;:,.<>?"
        
        # Build character pool
        char_pool = lowercase + uppercase + digits
        if include_special:
            char_pool += special
        
        # Ensure password meets requirements
        password = []
        password.append(secrets.choice(lowercase))
        password.append(secrets.choice(uppercase))
        password.append(secrets.choice(digits))
        if include_special:
            password.append(secrets.choice(special))
        
        # Fill remaining length
        for _ in range(len(password), length):
            password.append(secrets.choice(char_pool))
        
        # Shuffle to avoid predictable patterns
        secrets.SystemRandom().shuffle(password)
        
        return ''.join(password)
    
    def calculate_password_score(self, password: str) -> int:
        """
        Calculate password strength score (0-100)
        
        Args:
            password: Password to score
            
        Returns:
            Strength score
        """
        score = 0
        
        # Length scoring (max 30 points)
        length_score = min(len(password) * 2, 30)
        score += length_score
        
        # Character diversity (max 40 points)
        if any(c.islower() for c in password):
            score += 10
        if any(c.isupper() for c in password):
            score += 10
        if any(c.isdigit() for c in password):
            score += 10
        if any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
            score += 10
        
        # Pattern penalties
        if self._has_sequential_chars(password):
            score -= 10
        if self._has_excessive_repeats(password):
            score -= 10
        if password.lower() in self.common_passwords:
            score -= 20
        
        # Entropy bonus (max 30 points)
        unique_chars = len(set(password))
        entropy_score = min(unique_chars * 2, 30)
        score += entropy_score
        
        return max(0, min(100, score))
    
    def get_password_feedback(self, password: str) -> List[str]:
        """
        Get feedback for improving password
        
        Args:
            password: Password to analyze
            
        Returns:
            List of improvement suggestions
        """
        feedback = []
        score = self.calculate_password_score(password)
        
        if score < 40:
            feedback.append("Your password is very weak")
        elif score < 60:
            feedback.append("Your password is weak")
        elif score < 80:
            feedback.append("Your password is moderate")
        else:
            feedback.append("Your password is strong")
        
        # Specific suggestions
        if len(password) < 12:
            feedback.append("Consider using a longer password (12+ characters)")
        
        if not any(c.isupper() for c in password):
            feedback.append("Add uppercase letters for better security")
        
        if not any(c.isdigit() for c in password):
            feedback.append("Include numbers to increase strength")
        
        if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
            feedback.append("Add special characters for maximum security")
        
        if self._has_sequential_chars(password):
            feedback.append("Avoid sequential characters (abc, 123)")
        
        if self._has_excessive_repeats(password):
            feedback.append("Avoid repeated characters")
        
        return feedback
    
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
    
    def check_password_breach(self, password: str) -> bool:
        """
        Check if password has been in a data breach
        (Using Have I Been Pwned API in production)
        
        Args:
            password: Password to check
            
        Returns:
            True if password is breached, False otherwise
        """
        # TODO: Implement HIBP API check
        # For now, just check against common passwords
        return password.lower() in self.common_passwords