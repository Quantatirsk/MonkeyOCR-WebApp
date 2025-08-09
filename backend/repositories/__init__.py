"""
Repository pattern implementation for MonkeyOCR WebApp
"""

from .base import BaseRepository
from .user_repository import UserRepository
from .session_repository import SessionRepository
from .task_repository import TaskRepository

__all__ = [
    'BaseRepository',
    'UserRepository', 
    'SessionRepository',
    'TaskRepository'
]