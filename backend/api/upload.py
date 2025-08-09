"""
Upload API endpoints for MonkeyOCR WebApp
Handles file uploads and MonkeyOCR API integration
"""

import os
import uuid
import logging
from datetime import datetime
from typing import List
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
import aiofiles

logger = logging.getLogger(__name__)

from models import ProcessingTask, APIResponse
from utils.monkeyocr_client import MonkeyOCRClient
from utils.file_handler import FileHandler
from utils.persistence import get_persistence_manager
from utils.ocr_cache import ocr_cache
from config import settings

router = APIRouter(prefix="/api", tags=["upload"])

# Initialize clients
monkeyocr_client = MonkeyOCRClient()
file_handler = FileHandler()

# Note: persistence manager instance will be obtained when needed

# Supported file types
SUPPORTED_FILE_TYPES = {
    "application/pdf": [".pdf"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/webp": [".webp"]
}

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


@router.post("/upload", response_model=APIResponse[ProcessingTask])
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    extract_type: str = Form("standard"),
    split_pages: bool = Form(False)
):
    """
    Upload a file for OCR processing
    """
    try:
        # Validate file type
        if file.content_type not in SUPPORTED_FILE_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file.content_type}. Supported types: {list(SUPPORTED_FILE_TYPES.keys())}"
            )
        
        # Validate file size
        file_content = await file.read()
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB"
            )
        
        # Reset file pointer
        await file.seek(0)
        
        # Generate task ID
        task_id = str(uuid.uuid4())
        
        # Extract PDF page count if it's a PDF file
        total_pages = None
        if file.content_type == "application/pdf":
            total_pages = file_handler.get_pdf_page_count(file_content)
        
        # Create task record
        task = ProcessingTask(
            id=task_id,
            filename=file.filename or "unknown",
            file_type="pdf" if file.content_type == "application/pdf" else "image",
            status="pending",
            progress=0,
            created_at=datetime.now().isoformat(),
            completed_at=None,
            error_message=None,
            result_url=None,
            total_pages=total_pages,
            extraction_type=extract_type,
            split_pages=split_pages,
            file_hash=None,
            file_size=len(file_content),
            last_modified=datetime.now().isoformat(),
            processing_duration=None,
            from_cache=False,
            updated_at=datetime.now().isoformat()
        )
        
        # Store task
        persistence_manager = get_persistence_manager()
        persistence_manager.add_task(task)
        
        # Save original file for later access
        try:
            await file_handler.save_original_file(task_id, file_content, task.filename)
        except Exception as e:
            logger.warning(f"Failed to save original file for task {task_id}: {e}")
        
        # Check OCR cache BEFORE starting background task
        cache_hit = False
        if settings.redis_enabled:
            try:
                cached_result = await ocr_cache.get_cached_result(
                    file_content, extract_type, split_pages
                )
                
                if cached_result:
                    # Cache hit! Process immediately in main thread
                    logger.info(f"OCR cache hit for task {task_id}, processing immediately")
                    
                    # Update status to processing briefly (for UI feedback)
                    persistence_manager.update_task(task_id, {
                        "status": "processing",
                        "progress": 50
                    })
                    
                    # Try to copy cached files
                    copied_successfully = False
                    if cached_result.get("local_result_path"):
                        try:
                            cached_files = {
                                "local_result_path": cached_result["local_result_path"]
                            }
                            copied_successfully = await file_handler.copy_cached_files(task_id, cached_files)
                        except Exception as e:
                            logger.warning(f"Failed to copy cached files: {e}")
                    
                    if copied_successfully:
                        # Process the ZIP to extract static files
                        result_file_path = await file_handler.get_result_file(task_id)
                        if result_file_path and os.path.exists(result_file_path):
                            try:
                                document_result = await file_handler.process_result_zip(result_file_path, task_id)
                                logger.info(f"Processed cached ZIP: {len(document_result.images)} images")
                            except Exception as e:
                                logger.warning(f"Failed to process cached ZIP: {e}")
                        
                        # Mark task as completed with cache flag
                        persistence_manager.update_task(task_id, {
                            "status": "completed",
                            "progress": 100,
                            "result_url": f"/api/download/{task_id}",
                            "completed_at": datetime.now().isoformat(),
                            "from_cache": True,
                            "processing_duration": 0.1  # Near-instant for cached results
                        })
                        
                        cache_hit = True
                        logger.info(f"Task {task_id} completed from cache immediately")
                    else:
                        # Cache files unavailable, invalidate and proceed normally
                        logger.warning(f"Cached files unavailable, invalidating cache")
                        try:
                            await ocr_cache.invalidate_cache(file_content, extract_type, split_pages)
                        except:
                            pass
            except Exception as e:
                logger.warning(f"Cache check failed: {e}")
        
        # Only start background processing if cache miss
        if not cache_hit:
            background_tasks.add_task(
                process_file_async,
                task_id,
                file_content,
                file.filename or "unknown",
                file.content_type or "application/octet-stream",
                extract_type,
                split_pages
            )
            
            return APIResponse(
                success=True,
                data=task,
                message="File uploaded successfully, processing started",
                error=None
            )
        else:
            # Cache hit, task already completed
            # Reload task to get updated status
            updated_task = persistence_manager.get_task(task_id)
            return APIResponse(
                success=True,
                data=updated_task,
                message="File processed from cache",
                error=None
            )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/tasks/{task_id}/status", response_model=APIResponse[ProcessingTask])
async def get_task_status(task_id: str):
    """
    Get the status of a processing task
    """
    try:
        persistence_manager = get_persistence_manager()
        task = persistence_manager.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        return APIResponse(
            success=True,
            data=task,
            message="Task status retrieved",
            error=None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get task status: {str(e)}")


@router.get("/tasks", response_model=APIResponse[List[ProcessingTask]])
async def get_all_tasks():
    """
    Get all tasks
    """
    try:
        persistence_manager = get_persistence_manager()
        tasks_list = persistence_manager.get_all_tasks()
        # Already sorted by creation time, newest first
        
        return APIResponse(
            success=True,
            data=tasks_list,
            message=f"Retrieved {len(tasks_list)} tasks",
            error=None
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get tasks: {str(e)}")


@router.delete("/tasks/{task_id}", response_model=APIResponse[None])
async def delete_task(task_id: str):
    """
    Delete a task and its associated files with cache cleanup
    """
    try:
        persistence_manager = get_persistence_manager()
        task = persistence_manager.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Clean up OCR cache if Redis is enabled and we have original file
        if settings.redis_enabled:
            try:
                original_file_path = file_handler.get_original_file(task_id, task.filename)
                if original_file_path and os.path.exists(original_file_path):
                    # Read original file content
                    async with aiofiles.open(original_file_path, 'rb') as f:
                        file_content = await f.read()
                    
                    # Get task processing parameters (use defaults if not available)
                    extract_type = getattr(task, 'extraction_type', 'standard')
                    split_pages = getattr(task, 'split_pages', False)
                    
                    # Clear OCR cache
                    cache_cleared = await ocr_cache.invalidate_cache(
                        file_content, extract_type, split_pages
                    )
                    
                    if cache_cleared:
                        logger.info(f"Cleared OCR cache for deleted task {task_id}")
                    else:
                        logger.warning(f"Failed to clear OCR cache for task {task_id}")
                else:
                    logger.warning(f"Original file not found for task {task_id}, skipping cache cleanup")
                    
            except Exception as cache_error:
                # Don't fail the deletion if cache cleanup fails
                logger.warning(f"Cache cleanup failed for task {task_id}: {cache_error}")
        
        # Clean up files
        await file_handler.cleanup_task_files(task_id)
        
        # Remove from storage
        persistence_manager = get_persistence_manager()
        persistence_manager.delete_task(task_id)
        
        return APIResponse(
            success=True,
            data=None,
            message="Task and associated cache deleted successfully",
            error=None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete task: {str(e)}")


async def process_file_async(
    task_id: str,
    file_content: bytes,
    filename: str,
    _content_type: str,  # Unused parameter, kept for API compatibility
    extract_type: str,
    split_pages: bool
):
    """
    Background task to process file with MonkeyOCR API (cache miss cases only)
    """
    try:
        persistence_manager = get_persistence_manager()
        
        # This function is only called for cache misses
        # Cache hits are handled in the main thread now
        logger.info(f"Processing task {task_id} with MonkeyOCR API")
        
        # Update task status to processing
        persistence_manager.update_task(task_id, {
            "status": "processing", 
            "progress": 10
        })
        
        # Save file temporarily
        temp_file_path = await file_handler.save_temp_file(file_content, filename)
        
        try:
            # Update progress
            persistence_manager = get_persistence_manager()
            persistence_manager.update_task(task_id, {"progress": 30})
            
            # Call MonkeyOCR API
            result = await monkeyocr_client.process_file(
                temp_file_path,
                extract_type=extract_type,
                split_pages=split_pages
            )
            
            # Update progress
            persistence_manager = get_persistence_manager()
            persistence_manager.update_task(task_id, {"progress": 70})
            
            # Download and process result
            if result.get("download_url"):
                result_path = await monkeyocr_client.download_result(
                    result["download_url"],
                    task_id
                )
                
                # Process the result ZIP to extract static files
                if result_path:
                    try:
                        document_result = await file_handler.process_result_zip(result_path, task_id)
                        logger.info(f"Processed result ZIP for task {task_id}: {len(document_result.images)} images extracted")
                    except Exception as e:
                        logger.warning(f"Failed to process result ZIP for task {task_id}: {e}")
                        # Continue anyway, the ZIP file is still downloadable
                
                # Update task with result
                persistence_manager = get_persistence_manager()
                persistence_manager.update_task(task_id, {
                    "status": "completed",
                    "progress": 100,
                    "completed_at": datetime.now().isoformat(),
                    "result_url": f"/api/download/{task_id}"
                })
                
                # Cache the result for future use (only if Redis is enabled)
                if settings.redis_enabled:
                    try:
                        # Prepare result data for caching
                        cache_data = {
                            **result,
                            "local_result_path": str(result_path) if result_path else None,
                            "task_completed_at": datetime.now().isoformat(),
                            "cached_download_url": f"/api/download/{task_id}"
                        }
                        
                        await ocr_cache.cache_result(
                            file_content, extract_type, split_pages, cache_data
                        )
                        logger.info(f"Cached OCR result for task {task_id}")
                        
                    except Exception as cache_error:
                        logger.warning(f"Failed to cache OCR result for task {task_id}: {cache_error}")
                        # Don't fail the main process if caching fails
                        
            else:
                raise ValueError("No download URL received from MonkeyOCR API")
                
        finally:
            # Clean up temp file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
                
    except Exception as e:
        # Update task with error
        persistence_manager = get_persistence_manager()
        persistence_manager.update_task(task_id, {
            "status": "failed",
            "error_message": str(e),
            "completed_at": datetime.now().isoformat()
        })
        
        print(f"Processing failed for task {task_id}: {e}")


@router.get("/download/{task_id}")
@router.head("/download/{task_id}")
async def download_result(task_id: str):
    """
    Download the result file for a task (supports GET and HEAD methods)
    """
    try:
        persistence_manager = get_persistence_manager()
        task = persistence_manager.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        if task.status != "completed":
            raise HTTPException(status_code=400, detail="Task not completed yet")
        
        # Get result file path
        result_file = await file_handler.get_result_file(task_id)
        if not result_file or not os.path.exists(result_file):
            raise HTTPException(status_code=404, detail="Result file not found")
        
        # Return file response (FastAPI handles HEAD method automatically)
        from fastapi.responses import FileResponse
        return FileResponse(
            path=result_file,
            filename=f"{task.filename}_result.zip",
            media_type="application/zip"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")


# Health check endpoint
@router.get("/health")
async def health_check():
    """
    Health check endpoint
    """
    return {"status": "healthy", "service": "MonkeyOCR WebApp API"}