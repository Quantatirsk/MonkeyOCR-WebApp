"""
Sync API endpoints for MonkeyOCR WebApp
Handles frontend-backend state synchronization
"""

import os
import hashlib
import time
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Header, Response, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel

from models import APIResponse, ProcessingTask
from utils.file_handler import FileHandler
from dependencies.auth import get_current_user_optional

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["sync"])

# Initialize utilities
file_handler = FileHandler()

# Use SQLite persistence manager for task storage
from utils.sqlite_persistence import get_persistence_manager

# Note: persistence manager instance will be obtained when needed


# Note: Removed SyncCache class and related caching logic as per requirement
# Redis should only cache OCR and LLM tasks, not auth-related data


class SyncRequest(BaseModel):
    """Request model for sync operations"""
    last_sync_timestamp: Optional[datetime] = None
    client_task_ids: Optional[List[str]] = None


class SyncResponse(BaseModel):
    """Response model for sync operations"""
    tasks: List[ProcessingTask]
    server_timestamp: datetime
    total_count: int
    sync_type: str  # "full" or "incremental"


@router.get("/sync", response_model=APIResponse[SyncResponse])
async def sync_tasks(
    response: Response,
    last_sync: Optional[str] = Query(None, description="Last sync timestamp in ISO format"),
    task_ids: Optional[str] = Query(None, description="Comma-separated list of client task IDs"),
    if_none_match: Optional[str] = Header(None, alias="if-none-match", description="ETag for cache validation"),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Synchronize task states between frontend and backend with caching support
    
    - **last_sync**: ISO timestamp of last sync (for incremental sync)
    - **task_ids**: Comma-separated task IDs from client (for conflict detection)
    - **if_none_match**: ETag header for cache validation
    
    Returns all tasks or incremental changes based on parameters
    """
    try:
        # Note: Removed caching for sync operations as per requirement
        # Redis should only cache OCR and LLM tasks, not auth-related data
        
        # Calculate current data hash for ETag
        current_hash = await _calculate_data_hash()
        
        # Check ETag - if client has current version, return 304 Not Modified
        if if_none_match and if_none_match.strip('"') == current_hash:
            raise HTTPException(status_code=304, detail="Not Modified")
        
        # Parse parameters
        last_sync_timestamp = None
        if last_sync:
            try:
                last_sync_timestamp = datetime.fromisoformat(last_sync.replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid last_sync timestamp format")
        
        client_task_ids = []
        if task_ids:
            client_task_ids = [tid.strip() for tid in task_ids.split(',') if tid.strip()]
        
        # Get all tasks from persistence (optimized call)
        persistence_manager = get_persistence_manager()
        user_id = current_user.get("user_id") if current_user else None
        all_tasks_list = await persistence_manager.get_all_tasks(user_id=user_id)
        all_tasks = {task.id: task for task in all_tasks_list}
        
        # Determine sync type and filter tasks
        sync_type = "full"
        filtered_tasks = list(all_tasks.values())
        
        if last_sync_timestamp and len(filtered_tasks) > 0:
            # Incremental sync: filter tasks modified after last_sync
            sync_type = "incremental"
            filtered_tasks = [
                task for task in filtered_tasks
                if (hasattr(task, 'last_modified') and task.last_modified and
                    datetime.fromisoformat(task.last_modified) > last_sync_timestamp) or
                   (hasattr(task, 'created_at') and
                    datetime.fromisoformat(task.created_at) > last_sync_timestamp)
            ]
        
        # Sort by creation order (most recent first for better UX)
        filtered_tasks.sort(key=lambda t: t.created_at if hasattr(t, 'created_at') else t.id, reverse=True)
        
        sync_response = SyncResponse(
            tasks=filtered_tasks,
            server_timestamp=datetime.now(),
            total_count=len(filtered_tasks),
            sync_type=sync_type
        )
        
        api_response = APIResponse(
            success=True,
            data=sync_response,
            message=f"Sync completed ({sync_type}): {len(filtered_tasks)} tasks",
            error=None
        )
        
        # Set response headers for caching (client-side only)
        response.headers["ETag"] = f'"{current_hash}"'
        response.headers["Cache-Control"] = "private, no-cache"  # No caching, always revalidate
        
        # Note: Removed server-side caching as per requirement
        # Redis should only cache OCR and LLM tasks, not auth-related data
        
        return api_response
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


@router.get("/sync/status")
async def get_sync_status():
    """
    Get current server status for sync operations
    """
    try:
        persistence_manager = get_persistence_manager()
        stats = await persistence_manager.get_task_stats()
        
        return APIResponse(
            success=True,
            data={
                "server_timestamp": datetime.now().isoformat(),
                "task_stats": stats,
                "data_hash": await _calculate_data_hash()  # Simple data version indicator
            },
            message="Server status retrieved",
            error=None
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get status: {str(e)}")


@router.get("/files/{task_id}/original")
async def get_original_file(
    task_id: str, 
    response: Response,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get the original uploaded file for a task with caching support
    Used for file preview functionality after page refresh
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Check if task exists
        persistence_manager = get_persistence_manager()
        task = await persistence_manager.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Check access permissions - simplified logic
        # Allow access if any of these conditions are true:
        # 1. Task is public
        # 2. Task has no user_id (anonymous/legacy task)
        # 3. Current user owns the task
        if task.is_public:
            # Public tasks are accessible to everyone
            pass
        elif task.user_id is None:
            # Anonymous/legacy tasks are accessible to everyone
            pass
        elif current_user and task.user_id == current_user.get("user_id"):
            # User owns the task
            pass
        else:
            # Access denied
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get original file path using file handler
        original_file_path = file_handler.get_original_file(task_id)
        if not original_file_path or not os.path.exists(original_file_path):
            raise HTTPException(status_code=404, detail="Original file not found")
        
        # Get file stats for caching
        file_stat = os.stat(original_file_path)
        file_mtime = int(file_stat.st_mtime)
        file_size = file_stat.st_size
        
        # Create ETag based on file path, mtime, and size
        etag = hashlib.md5(f"{original_file_path}:{file_mtime}:{file_size}".encode()).hexdigest()
        
        # Set cache headers
        response.headers["ETag"] = f'"{etag}"'
        response.headers["Cache-Control"] = "private, max-age=3600"  # Cache for 1 hour
        response.headers["Last-Modified"] = datetime.fromtimestamp(file_mtime).strftime("%a, %d %b %Y %H:%M:%S GMT")
        
        # Determine MIME type based on file extension
        file_ext = os.path.splitext(original_file_path)[1].lower()
        mime_type_map = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp',
            '.webp': 'image/webp'
        }
        
        media_type = mime_type_map.get(file_ext, 'application/octet-stream')
        
        # Return the original file
        return FileResponse(
            path=original_file_path,
            filename=task.filename,
            media_type=media_type,
            headers={
                "ETag": f'"{etag}"',
                "Cache-Control": "private, max-age=3600",
                "Last-Modified": datetime.fromtimestamp(file_mtime).strftime("%a, %d %b %Y %H:%M:%S GMT")
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get original file: {str(e)}")


@router.get("/tasks/{task_id}/preview")
async def get_task_preview(
    task_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get preview information for a task
    Returns file metadata and preview URL
    """
    try:
        # Check if task exists
        persistence_manager = get_persistence_manager()
        task = await persistence_manager.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Check access permission
        user_id = current_user.get("user_id") if current_user else None
        task_user_id = task.user_id if hasattr(task, 'user_id') else task.get('user_id')
        
        # Only allow access to own tasks (unless task is public in the future)
        if task_user_id and task_user_id != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get original file info
        original_file_path = file_handler.get_original_file(task_id)
        preview_info = {
            "task_id": task_id,
            "filename": task.filename,
            "status": task.status,
            "file_exists": original_file_path and os.path.exists(original_file_path),
            "preview_url": f"/api/files/{task_id}/original" if original_file_path else None,
            "file_size": None,
            "file_type": None,
            "total_pages": task.total_pages
        }
        
        # Add file metadata if file exists
        if preview_info["file_exists"] and original_file_path:
            file_stat = os.stat(original_file_path)
            preview_info["file_size"] = file_stat.st_size
            
            # Determine file type
            file_ext = os.path.splitext(task.filename)[1].lower()
            if file_ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']:
                preview_info["file_type"] = "image"
            elif file_ext == '.pdf':
                preview_info["file_type"] = "pdf"
            else:
                preview_info["file_type"] = "document"
        
        return APIResponse(
            success=True,
            data=preview_info,
            message="Preview information retrieved",
            error=None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get preview: {str(e)}")


async def _calculate_data_hash() -> str:
    """
    Calculate a simple hash of current task data for change detection
    This can be used by clients to detect if server data has changed
    """
    try:
        persistence_manager = get_persistence_manager()
        all_tasks_list = await persistence_manager.get_all_tasks()
        all_tasks = {task.id: task for task in all_tasks_list}
        
        # Create a simple hash based on task IDs and statuses
        data_string = ""
        for task_id in sorted(all_tasks.keys()):
            task = all_tasks[task_id]
            data_string += f"{task_id}:{task.status}:{task.progress}:"
        
        return hashlib.md5(data_string.encode()).hexdigest()
    except Exception:
        return "error"




