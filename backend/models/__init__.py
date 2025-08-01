# Models module init
from .schemas import (
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