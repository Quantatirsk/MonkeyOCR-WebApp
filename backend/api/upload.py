"""
Upload API endpoints for MonkeyOCR WebApp
Handles file uploads and MonkeyOCR API integration
"""

import os
import uuid
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks, Depends
import aiofiles

logger = logging.getLogger(__name__)

from models import ProcessingTask, APIResponse
from utils.monkeyocr_client import MonkeyOCRClient
from utils.file_handler import FileHandler
from utils.sqlite_persistence import get_persistence_manager
from utils.ocr_cache import ocr_cache
from config import settings
from dependencies.auth import get_current_user_optional, get_current_user

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


@router.post("/upload-url", response_model=APIResponse[ProcessingTask])
async def upload_from_url(
    background_tasks: BackgroundTasks,
    pdf_url: str = Form(...),
    is_public: str = Form("false"),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Download and process a PDF from a URL
    
    Args:
        pdf_url: URL of the PDF to download
        is_public: Make task publicly accessible (requires auth)
        current_user: Current authenticated user (optional)
    """
    import httpx
    import re
    
    try:
        # Extract filename from URL
        filename = "document.pdf"
        url_parts = pdf_url.split('/')
        last_part = url_parts[-1] if url_parts else ""
        
        # Check if it's an ArXiv ID in the URL
        if 'arxiv.org' in pdf_url and last_part:
            # Extract ArXiv ID and create filename
            arxiv_match = re.search(r'(\d{4}\.\d{4,5}(?:v\d+)?)', last_part)
            if arxiv_match:
                filename = f"arxiv_{arxiv_match.group(1)}.pdf"
            elif last_part.endswith('.pdf'):
                filename = last_part
        elif last_part and (last_part.endswith('.pdf') or '.' in last_part):
            # Use the last part if it looks like a filename
            filename = last_part.split('?')[0]  # Remove query parameters
        
        logger.info(f"Downloading PDF from URL: {pdf_url}")
        
        # Download the PDF file
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(pdf_url)
            response.raise_for_status()
            
            # Check content type
            content_type = response.headers.get('content-type', '')
            if not ('pdf' in content_type.lower() or 'octet-stream' in content_type.lower()):
                logger.warning(f"Unexpected content-type: {content_type}, proceeding anyway")
            
            file_content = response.content
        
        # Validate file size
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB"
            )
        
        # Generate task ID
        task_id = str(uuid.uuid4())
        
        # Extract PDF page count
        total_pages = file_handler.get_pdf_page_count(file_content)
        
        # Get user ID if authenticated
        user_id = current_user.get("user_id") if current_user else None
        
        # Parse is_public from string to boolean
        is_public_bool = is_public.lower() in ['true', '1', 'yes']
        
        # Only authenticated users can make tasks public
        if is_public_bool and not current_user:
            is_public_bool = False
        
        # Create task record
        task = ProcessingTask(
            id=task_id,
            filename=filename,
            file_type="pdf",
            status="pending",
            progress=0,
            created_at=datetime.now().isoformat(),
            completed_at=None,
            error_message=None,
            result_url=None,
            total_pages=total_pages,
            file_hash=None,
            file_size=len(file_content),
            last_modified=datetime.now().isoformat(),
            processing_duration=None,
            from_cache=False,
            updated_at=datetime.now().isoformat(),
            user_id=user_id,
            is_public=is_public_bool
        )
        
        # Store task with user context
        persistence_manager = get_persistence_manager()
        await persistence_manager.add_task(task, user_id=user_id)
        
        # Save original file for later access
        try:
            await file_handler.save_original_file(task_id, file_content, task.filename)
        except Exception as e:
            logger.warning(f"Failed to save original file for task {task_id}: {e}")
        
        # Check OCR cache
        cache_hit = False
        if settings.redis_enabled:
            try:
                cached_result = await ocr_cache.get_cached_result(file_content)
                
                if cached_result:
                    # Cache hit! Process immediately
                    logger.info(f"OCR cache hit for task {task_id}, processing immediately")
                    
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
                        # Process the ZIP to extract media files
                        result_file_path = await file_handler.get_result_file(task_id)
                        if result_file_path and os.path.exists(result_file_path):
                            try:
                                document_result = await file_handler.process_result_zip(result_file_path, task_id)
                                logger.info(f"Processed cached ZIP: {len(document_result.images)} images")
                            except Exception as e:
                                logger.warning(f"Failed to process cached ZIP: {e}")
                        
                        # Mark task as completed with cache flag
                        updated_task = await persistence_manager.update_task(task_id, {
                            "status": "completed",
                            "progress": 100,
                            "result_url": f"/api/download/{task_id}",
                            "completed_at": datetime.now().isoformat(),
                            "from_cache": True,
                            "processing_duration": 0.1,
                            "updated_at": datetime.now().isoformat()
                        })
                        
                        if updated_task:
                            logger.info(f"Task {task_id} updated in DB - status: {updated_task.status}")
                        
                        cache_hit = True
                        
                        # Update the task object to reflect the new status
                        task.status = "completed"
                        task.progress = 100
                        task.result_url = f"/api/download/{task_id}"
                        task.completed_at = datetime.now().isoformat()
                        task.from_cache = True
                        task.processing_duration = 0.1
                    else:
                        # Cache files unavailable, invalidate and proceed normally
                        logger.warning(f"Cached files unavailable, invalidating cache")
                        try:
                            await ocr_cache.invalidate_cache(file_content)
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
                filename,
                "application/pdf"
            )
            
            return APIResponse(
                success=True,
                data=task,
                message="PDF downloaded and processing started",
                error=None
            )
        else:
            # Cache hit, task already completed
            return APIResponse(
                success=True,
                data=task,
                message="PDF processed from cache",
                error=None
            )
        
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to download PDF: HTTP {e.response.status_code}"
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=400,
            detail="Download timeout - the file may be too large or the server is slow"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"URL upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process URL: {str(e)}")


@router.post("/upload", response_model=APIResponse[ProcessingTask])
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    is_public: str = Form("false"),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Upload a file for OCR processing
    
    Args:
        file: File to upload
        is_public: Make task publicly accessible (requires auth)
        current_user: Current authenticated user (optional)
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
        
        # Get user ID if authenticated
        user_id = current_user.get("user_id") if current_user else None
        
        # Parse is_public from string to boolean
        logger.info(f"Received is_public value: {is_public} (type: {type(is_public)})")
        is_public_bool = is_public.lower() in ['true', '1', 'yes']
        logger.info(f"Parsed is_public_bool: {is_public_bool}")
        
        # Only authenticated users can make tasks public
        if is_public_bool and not current_user:
            logger.info("User not authenticated, setting is_public to False")
            is_public_bool = False
        
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
            file_hash=None,
            file_size=len(file_content),
            last_modified=datetime.now().isoformat(),
            processing_duration=None,
            from_cache=False,
            updated_at=datetime.now().isoformat(),
            user_id=user_id,  # Associate with user if authenticated
            is_public=is_public_bool  # Public access flag
        )
        
        # Store task with user context
        persistence_manager = get_persistence_manager()
        await persistence_manager.add_task(task, user_id=user_id)
        
        # Save original file for later access
        try:
            await file_handler.save_original_file(task_id, file_content, task.filename)
        except Exception as e:
            logger.warning(f"Failed to save original file for task {task_id}: {e}")
        
        # Check OCR cache BEFORE starting background task
        cache_hit = False
        if settings.redis_enabled:
            try:
                cached_result = await ocr_cache.get_cached_result(file_content)
                
                if cached_result:
                    # Cache hit! Process immediately in main thread
                    logger.info(f"OCR cache hit for task {task_id}, processing immediately")
                    
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
                        # Process the ZIP to extract media files
                        result_file_path = await file_handler.get_result_file(task_id)
                        if result_file_path and os.path.exists(result_file_path):
                            try:
                                document_result = await file_handler.process_result_zip(result_file_path, task_id)
                                logger.info(f"Processed cached ZIP: {len(document_result.images)} images")
                            except Exception as e:
                                logger.warning(f"Failed to process cached ZIP: {e}")
                        
                        # Mark task as completed with cache flag
                        updated_task = await persistence_manager.update_task(task_id, {
                            "status": "completed",
                            "progress": 100,
                            "result_url": f"/api/download/{task_id}",
                            "completed_at": datetime.now().isoformat(),
                            "from_cache": True,
                            "processing_duration": 0.1,  # Near-instant for cached results
                            "updated_at": datetime.now().isoformat()  # Explicitly set updated_at
                        })
                        
                        if updated_task:
                            logger.info(f"Task {task_id} updated in DB - status: {updated_task.status}")
                        else:
                            logger.error(f"Failed to update task {task_id} in database!")
                        
                        cache_hit = True
                        logger.info(f"Task {task_id} completed from cache immediately")
                        
                        # Update the task object to reflect the new status
                        task.status = "completed"
                        task.progress = 100
                        task.result_url = f"/api/download/{task_id}"
                        task.completed_at = datetime.now().isoformat()
                        task.from_cache = True
                        task.processing_duration = 0.1
                    else:
                        # Cache files unavailable, invalidate and proceed normally
                        logger.warning(f"Cached files unavailable, invalidating cache")
                        try:
                            await ocr_cache.invalidate_cache(file_content)
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
                file.content_type or "application/octet-stream"
            )
            
            return APIResponse(
                success=True,
                data=task,
                message="File uploaded successfully, processing started",
                error=None
            )
        else:
            # Cache hit, task already completed
            # Return the updated task object directly (already updated above)
            return APIResponse(
                success=True,
                data=task,  # Use the updated task object
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
        task = await persistence_manager.get_task(task_id)
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
async def get_all_tasks(
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Get all tasks visible to current user
    - Authenticated users see only their own tasks
    - Anonymous users see no tasks (for security)
    """
    try:
        persistence_manager = get_persistence_manager()
        user_id = current_user.get("user_id") if current_user else None
        tasks_list = await persistence_manager.get_all_tasks(user_id=user_id)
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
async def delete_task(
    task_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Delete a task and its associated files with cache cleanup
    Only task owner can delete their tasks
    """
    try:
        persistence_manager = get_persistence_manager()
        task = await persistence_manager.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Check if user can delete this task
        if task.user_id is not None:
            # Task has an owner, check if current user is the owner
            if not current_user or task.user_id != current_user.get("user_id"):
                raise HTTPException(status_code=403, detail="Access denied: Only task owner can delete")
        
        # Clean up OCR cache if Redis is enabled and we have original file
        if settings.redis_enabled:
            try:
                original_file_path = file_handler.get_original_file(task_id, task.filename)
                if original_file_path and os.path.exists(original_file_path):
                    # Read original file content
                    async with aiofiles.open(original_file_path, 'rb') as f:
                        file_content = await f.read()
                    
                    # Clear OCR cache
                    cache_cleared = await ocr_cache.invalidate_cache(file_content)
                    
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
        await persistence_manager.delete_task(task_id)
        
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
    _content_type: str  # Unused parameter, kept for API compatibility
):
    """
    Background task to process file with MonkeyOCR API (cache miss cases only)
    """
    persistence_manager = get_persistence_manager()
    
    try:
        # This function is only called for cache misses
        # Cache hits are handled in the main thread now
        logger.info(f"Processing task {task_id} with MonkeyOCR API")
        
        # Record start time for duration calculation
        start_time = datetime.now()
        
        # Update task status to processing
        await persistence_manager.update_task(task_id, {
            "status": "processing", 
            "progress": 10,
            "updated_at": datetime.now().isoformat(),
            "processing_started_at": start_time.isoformat()
        })
        
        # Save file temporarily
        temp_file_path = await file_handler.save_temp_file(file_content, filename)
        
        try:
            # Update progress
            await persistence_manager.update_task(task_id, {
                "progress": 30,
                "updated_at": datetime.now().isoformat()
            })
            
            # Call MonkeyOCR API (always uses standard mode)
            result = await monkeyocr_client.process_file(temp_file_path)
            
            # Update progress
            await persistence_manager.update_task(task_id, {
                "progress": 70,
                "updated_at": datetime.now().isoformat()
            })
            
            # Download and process result
            if result.get("download_url"):
                result_path = await monkeyocr_client.download_result(
                    result["download_url"],
                    task_id
                )
                
                # Process the result ZIP to extract media files
                if result_path:
                    try:
                        document_result = await file_handler.process_result_zip(result_path, task_id)
                        logger.info(f"Processed result ZIP for task {task_id}: {len(document_result.images)} images extracted")
                    except Exception as e:
                        logger.warning(f"Failed to process result ZIP for task {task_id}: {e}")
                        # Continue anyway, the ZIP file is still downloadable
                
                # Update task with result
                end_time = datetime.now()
                await persistence_manager.update_task(task_id, {
                    "status": "completed",
                    "progress": 100,
                    "completed_at": end_time.isoformat(),
                    "result_url": f"/api/download/{task_id}",
                    "updated_at": end_time.isoformat(),
                    "processing_duration": (end_time - start_time).total_seconds()
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
                        
                        await ocr_cache.cache_result(file_content, cache_data)
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
        await persistence_manager.update_task(task_id, {
            "status": "failed",
            "error_message": str(e),
            "completed_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
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
        task = await persistence_manager.get_task(task_id)
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