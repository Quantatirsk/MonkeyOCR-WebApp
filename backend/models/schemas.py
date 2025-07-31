"""
Pydantic models for MonkeyOCR WebApp API
"""

from typing import Optional, List, Literal, Generic, TypeVar
from pydantic import BaseModel, Field
from datetime import datetime

# Generic type for API responses
T = TypeVar('T')

class ProcessingTask(BaseModel):
    """Processing task model"""
    id: str
    filename: str
    file_type: Literal['pdf', 'image']
    status: Literal['pending', 'processing', 'completed', 'failed']
    progress: int = Field(ge=0, le=100, description="Progress percentage (0-100)")
    created_at: str
    completed_at: Optional[str] = None
    error_message: Optional[str] = None
    result_url: Optional[str] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ImageResource(BaseModel):
    """Image resource model"""
    filename: str
    path: str
    url: str
    alt: Optional[str] = None


class DocumentMetadata(BaseModel):
    """Document processing metadata"""
    total_pages: int
    processing_time: float
    file_size: int
    extraction_type: Literal['standard', 'split', 'text', 'formula', 'table']


class DocumentResult(BaseModel):
    """Document processing result"""
    task_id: str
    markdown_content: str
    images: List[ImageResource]
    download_url: str
    metadata: DocumentMetadata


class APIResponse(BaseModel, Generic[T]):
    """Generic API response wrapper"""
    success: bool
    data: Optional[T] = None
    message: str
    error: Optional[str] = None

    class Config:
        # This allows the model to be used with generic types
        arbitrary_types_allowed = True


class UploadRequest(BaseModel):
    """File upload request model"""
    extract_type: Literal['standard', 'split', 'text', 'formula', 'table'] = 'standard'
    split_pages: bool = False


class TaskStatusResponse(APIResponse[ProcessingTask]):
    """Task status response"""
    pass


class TaskResultResponse(APIResponse[DocumentResult]):
    """Task result response"""
    pass


class TaskListResponse(APIResponse[List[ProcessingTask]]):
    """Task list response"""
    pass


class UploadResponse(APIResponse[ProcessingTask]):
    """Upload response"""
    pass


class MonkeyOCRAPIResponse(BaseModel):
    """MonkeyOCR API response model"""
    success: bool
    message: str
    data: Optional[dict] = None
    download_url: Optional[str] = None
    task_id: Optional[str] = None
    
    
class ErrorResponse(BaseModel):
    """Error response model"""
    error: str
    detail: str
    status_code: int