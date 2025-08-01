# Models module init
from .schemas import (
    TaskStatusHistory,
    ProcessingTask,
    ImageResource, 
    DocumentMetadata,
    DocumentResult,
    APIResponse,
    UploadRequest,
    TaskStatusResponse,
    TaskResultResponse,
    TaskListResponse,
    UploadResponse,
    MonkeyOCRAPIResponse,
    ErrorResponse
)

__all__ = [
    "TaskStatusHistory",
    "ProcessingTask",
    "ImageResource",
    "DocumentMetadata", 
    "DocumentResult",
    "APIResponse",
    "UploadRequest",
    "TaskStatusResponse",
    "TaskResultResponse",
    "TaskListResponse",
    "UploadResponse",
    "MonkeyOCRAPIResponse",
    "ErrorResponse"
]