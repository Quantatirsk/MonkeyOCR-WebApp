"""
Sync API endpoints for MonkeyOCR WebApp
Handles frontend-backend state synchronization
"""

import os
import hashlib
import time
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Header, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel

from models import APIResponse, ProcessingTask
from utils.file_handler import FileHandler

router = APIRouter(prefix="/api", tags=["sync"])

# Initialize utilities
file_handler = FileHandler()

# Use persistence manager for task storage
from utils.persistence import get_persistence_manager

# Note: persistence manager instance will be obtained when needed


class SyncCache:
    """Simple in-memory cache for sync operations"""
    
    def __init__(self, ttl_seconds: int = 60):
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.ttl_seconds = ttl_seconds
    
    def get(self, key: str) -> Optional[Any]:
        """Get cached value if not expired"""
        if key in self.cache:
            entry = self.cache[key]
            if time.time() - entry['timestamp'] < self.ttl_seconds:
                return entry['data']
            else:
                # Remove expired entry
                del self.cache[key]
        return None
    
    def set(self, key: str, data: Any) -> None:
        """Set cached value with timestamp"""
        self.cache[key] = {
            'data': data,
            'timestamp': time.time()
        }
    
    def clear(self) -> None:
        """Clear all cached entries"""
        self.cache.clear()
    
    def get_stats(self) -> Dict[str, int]:
        """Get cache statistics"""
        now = time.time()
        valid_entries = sum(1 for entry in self.cache.values() 
                          if now - entry['timestamp'] < self.ttl_seconds)
        return {
            'total_entries': len(self.cache),
            'valid_entries': valid_entries,
            'expired_entries': len(self.cache) - valid_entries
        }


# Global cache instance
sync_cache = SyncCache(ttl_seconds=30)  # 30 second cache for sync operations


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
    if_none_match: Optional[str] = Header(None, alias="if-none-match", description="ETag for cache validation")
):
    """
    Synchronize task states between frontend and backend with caching support
    
    - **last_sync**: ISO timestamp of last sync (for incremental sync)
    - **task_ids**: Comma-separated task IDs from client (for conflict detection)
    - **if_none_match**: ETag header for cache validation
    
    Returns all tasks or incremental changes based on parameters
    """
    try:
        # Create cache key based on parameters
        cache_key = f"sync_{last_sync or 'all'}_{task_ids or 'none'}"
        
        # Calculate current data hash for ETag
        current_hash = _calculate_data_hash()
        
        # Check ETag - if client has current version, return 304 Not Modified
        if if_none_match and if_none_match.strip('"') == current_hash:
            raise HTTPException(status_code=304, detail="Not Modified")
        
        # Check cache first
        cached_response = sync_cache.get(cache_key)
        if cached_response and cached_response.get('etag') == current_hash:
            # Return cached response with updated server timestamp
            cached_response['data']['server_timestamp'] = datetime.now()
            cached_response['message'] = f"{cached_response['message']} (cached)"
            return APIResponse(**cached_response)
        
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
        all_tasks = persistence_manager.get_tasks_with_metadata()
        
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
        
        # Set response headers for caching
        response.headers["ETag"] = f'"{current_hash}"'
        response.headers["Cache-Control"] = "private, max-age=30"  # Cache for 30 seconds
        
        # Cache the response
        cache_data = {
            'success': api_response.success,
            'data': sync_response.dict(),
            'message': api_response.message,
            'error': api_response.error,
            'etag': current_hash
        }
        sync_cache.set(cache_key, cache_data)
        
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
        stats = persistence_manager.get_task_stats()
        
        return APIResponse(
            success=True,
            data={
                "server_timestamp": datetime.now().isoformat(),
                "task_stats": stats,
                "data_hash": _calculate_data_hash()  # Simple data version indicator
            },
            message="Server status retrieved",
            error=None
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get status: {str(e)}")


@router.get("/files/{task_id}/original")
async def get_original_file(task_id: str, response: Response):
    """
    Get the original uploaded file for a task with caching support
    Used for file preview functionality after page refresh
    """
    try:
        # Check if task exists
        persistence_manager = get_persistence_manager()
        task = persistence_manager.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
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
async def get_task_preview(task_id: str):
    """
    Get preview information for a task
    Returns file metadata and preview URL
    """
    try:
        # Check if task exists
        persistence_manager = get_persistence_manager()
        task = persistence_manager.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
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
        if preview_info["file_exists"]:
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


def _calculate_data_hash() -> str:
    """
    Calculate a simple hash of current task data for change detection
    This can be used by clients to detect if server data has changed
    """
    try:
        persistence_manager = get_persistence_manager()
        all_tasks = persistence_manager.get_tasks_with_metadata()
        
        # Create a simple hash based on task IDs and statuses
        data_string = ""
        for task_id in sorted(all_tasks.keys()):
            task = all_tasks[task_id]
            data_string += f"{task_id}:{task.status}:{task.progress}:"
        
        return hashlib.md5(data_string.encode()).hexdigest()
    except Exception:
        return "error"




