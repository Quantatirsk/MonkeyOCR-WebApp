"""
Pydantic models for MonkeyOCR WebApp API
"""

from typing import Optional, List, Literal, Generic, TypeVar, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

# Generic type for API responses
T = TypeVar('T')

class TaskStatusHistory(BaseModel):
    """Task status change history entry"""
    status: str
    timestamp: str
    message: Optional[str] = None

class ProcessingTask(BaseModel):
    """Processing task model with enhanced persistence support"""
    id: str
    filename: str
    file_type: Literal['pdf', 'image']
    status: Literal['pending', 'processing', 'completed', 'failed']
    progress: int = Field(ge=0, le=100, description="Progress percentage (0-100)")
    created_at: str
    completed_at: Optional[str] = None
    error_message: Optional[str] = None
    result_url: Optional[str] = None
    
    # Enhanced fields for persistence
    file_hash: Optional[str] = Field(None, description="SHA256 hash of original file")
    file_size: Optional[int] = Field(None, description="Size of original file in bytes")
    total_pages: Optional[int] = Field(None, description="Total pages for PDF files")
    last_modified: Optional[str] = Field(None, description="Last modification timestamp")
    status_history: List[TaskStatusHistory] = Field(default_factory=list, description="Status change history")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional task metadata")
    
    # Processing metadata
    processing_started_at: Optional[str] = None
    processing_duration: Optional[float] = Field(None, description="Processing duration in seconds")
    extraction_type: Optional[str] = Field(None, description="Type of extraction performed")
    updated_at: Optional[str] = Field(None, description="Last update timestamp")

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