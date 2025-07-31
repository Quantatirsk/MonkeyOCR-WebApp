"""
Results API endpoints for MonkeyOCR WebApp
Handles result retrieval and processing
"""

import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from ..models import APIResponse, DocumentResult
from ..utils.file_handler import FileHandler
from ..utils.zip_processor import ZipProcessor

router = APIRouter(prefix="/api", tags=["results"])

# Initialize utilities
file_handler = FileHandler()
zip_processor = ZipProcessor()

# This should be the same storage as in upload.py
# In production, use a proper database or shared storage
from .upload import tasks_storage


@router.get("/tasks/{task_id}/result", response_model=APIResponse[DocumentResult])
async def get_task_result(task_id: str):
    """
    Get the processed result for a completed task
    """
    try:
        # Check if task exists
        task = tasks_storage.get(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        if task.status != "completed":
            raise HTTPException(
                status_code=400, 
                detail=f"Task not completed yet. Current status: {task.status}"
            )
        
        # Get result file path
        result_file_path = await file_handler.get_result_file(task_id)
        if not result_file_path or not os.path.exists(result_file_path):
            raise HTTPException(status_code=404, detail="Result file not found")
        
        # Process the result ZIP file
        document_result = await zip_processor.process_zip_file(result_file_path, task_id)
        
        return APIResponse(
            success=True,
            data=document_result,
            message="Result retrieved successfully",
            error=None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get result: {str(e)}")


@router.get("/download/{task_id}")
async def download_task_result(task_id: str):
    """
    Download the original result ZIP file for a task
    """
    try:
        # Check if task exists
        task = tasks_storage.get(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        if task.status != "completed":
            raise HTTPException(
                status_code=400,
                detail="Task not completed yet"
            )
        
        # Get result file path
        result_file_path = await file_handler.get_result_file(task_id)
        if not result_file_path or not os.path.exists(result_file_path):
            raise HTTPException(status_code=404, detail="Result file not found")
        
        # Return file for download
        return FileResponse(
            path=result_file_path,
            filename=f"{task.filename}_ocr_result.zip",
            media_type="application/zip"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")


@router.get("/tasks/{task_id}/images")
async def get_task_images(task_id: str):
    """
    Get list of images for a task
    """
    try:
        # Check if task exists
        task = tasks_storage.get(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        if task.status != "completed":
            raise HTTPException(
                status_code=400,
                detail="Task not completed yet"
            )
        
        # Get processed result to extract image list
        result_file_path = await file_handler.get_result_file(task_id)
        if not result_file_path:
            raise HTTPException(status_code=404, detail="Result file not found")
        
        document_result = await zip_processor.process_zip_file(result_file_path, task_id)
        
        return APIResponse(
            success=True,
            data=document_result.images,
            message=f"Retrieved {len(document_result.images)} images",
            error=None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get images: {str(e)}")


@router.get("/tasks/{task_id}/markdown")
async def get_task_markdown(task_id: str):
    """
    Get the raw markdown content for a task
    """
    try:
        # Check if task exists
        task = tasks_storage.get(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        if task.status != "completed":
            raise HTTPException(
                status_code=400,
                detail="Task not completed yet"
            )
        
        # Get processed result to extract markdown
        result_file_path = await file_handler.get_result_file(task_id)
        if not result_file_path:
            raise HTTPException(status_code=404, detail="Result file not found")
        
        document_result = await zip_processor.process_zip_file(result_file_path, task_id)
        
        return {
            "success": True,
            "data": {
                "markdown_content": document_result.markdown_content,
                "metadata": document_result.metadata
            },
            "message": "Markdown content retrieved",
            "error": None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get markdown: {str(e)}")