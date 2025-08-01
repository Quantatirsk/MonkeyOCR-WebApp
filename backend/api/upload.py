"""
Upload API endpoints for MonkeyOCR WebApp
Handles file uploads and MonkeyOCR API integration
"""

import os
import uuid
import asyncio
import logging
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
import httpx
import aiofiles

logger = logging.getLogger(__name__)

from models import ProcessingTask, APIResponse
from utils.monkeyocr_client import MonkeyOCRClient
from utils.file_handler import FileHandler
from utils.persistence import get_persistence_manager

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
            total_pages=total_pages
        )
        
        # Store task
        persistence_manager = get_persistence_manager()
        persistence_manager.add_task(task)
        
        # Save original file for later access
        try:
            await file_handler.save_original_file(task_id, file_content, task.filename)
        except Exception as e:
            logger.warning(f"Failed to save original file for task {task_id}: {e}")
        
        # Start background processing
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
    Delete a task and its associated files
    """
    try:
        persistence_manager = get_persistence_manager()
        task = persistence_manager.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Clean up files
        await file_handler.cleanup_task_files(task_id)
        
        # Remove from storage
        persistence_manager = get_persistence_manager()
        persistence_manager.delete_task(task_id)
        
        return APIResponse(
            success=True,
            data=None,
            message="Task deleted successfully",
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
    content_type: str,
    extract_type: str,
    split_pages: bool
):
    """
    Background task to process file with MonkeyOCR API
    """
    try:
        # Update task status to processing
        persistence_manager = get_persistence_manager()
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
                
                # Update task with result
                persistence_manager = get_persistence_manager()
                persistence_manager.update_task(task_id, {
                    "status": "completed",
                    "progress": 100,
                    "completed_at": datetime.now().isoformat(),
                    "result_url": f"/api/download/{task_id}"
                })
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
async def download_result(task_id: str):
    """
    Download the result file for a task
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
        
        # Return file response
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