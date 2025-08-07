"""
LLM API endpoints for MonkeyOCR WebApp
Compatible with OpenAI SDK for chat completion functionality
"""
import logging
import json
from typing import Optional, List, Union, Dict, Any
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from openai import AsyncOpenAI

from config import get_llm_config, validate_llm_config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/llm", tags=["llm"])


class ImageUrl(BaseModel):
    """Image URL model for multimodal content"""
    url: str = Field(..., description="Image URL or base64 data URL")


class ContentPart(BaseModel):
    """Content part for multimodal messages"""
    type: str = Field(..., description="Content type: text or image_url")
    text: Optional[str] = Field(default=None, description="Text content")
    image_url: Optional[ImageUrl] = Field(default=None, description="Image URL object")


class Message(BaseModel):
    """Chat message model supporting both text and multimodal content"""
    role: str = Field(..., description="Message role: system, user, or assistant")
    content: Union[str, List[ContentPart]] = Field(..., description="Message content - can be string or list of content parts for multimodal")


class ChatCompletionRequest(BaseModel):
    """Chat completion request model compatible with OpenAI API"""
    model: str = Field(..., description="Model to use for completion")
    messages: List[Message] = Field(..., description="List of messages")
    stream: bool = Field(default=False, description="Enable streaming response")
    temperature: Optional[float] = Field(default=0.7, description="Temperature for response generation")
    max_tokens: Optional[int] = Field(default=None, description="Maximum tokens in response")
    top_p: Optional[float] = Field(default=1.0, description="Top-p sampling parameter")


class ChatCompletionChoice(BaseModel):
    """Chat completion choice model"""
    index: int
    message: Message
    finish_reason: Optional[str] = None


class ChatCompletionResponse(BaseModel):
    """Chat completion response model"""
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[ChatCompletionChoice]


class ModelInfo(BaseModel):
    """Model information"""
    id: str
    object: str = "model"
    created: int
    owned_by: str


class ModelsResponse(BaseModel):
    """Models list response"""
    object: str = "list"
    data: List[ModelInfo]


# Initialize OpenAI client
async def get_openai_client() -> AsyncOpenAI:
    """Get configured OpenAI client"""
    if not validate_llm_config():
        raise HTTPException(
            status_code=500, 
            detail="LLM configuration incomplete. Please set LLM_API_KEY and LLM_BASE_URL."
        )
    
    config = get_llm_config()
    return AsyncOpenAI(
        api_key=config["api_key"],
        base_url=config["base_url"]
    )


@router.get("/models", response_model=ModelsResponse)
async def list_models():
    """
    List available models
    Compatible with OpenAI API /v1/models endpoint
    """
    try:
        client = await get_openai_client()
        models = await client.models.list()
        
        return ModelsResponse(
            object="list",
            data=[
                ModelInfo(
                    id=model.id,
                    object="model",
                    created=getattr(model, 'created', 0),
                    owned_by=getattr(model, 'owned_by', 'unknown')
                )
                for model in models.data
            ]
        )
    except Exception as e:
        logger.error(f"Error listing models: {e}")
        # Return default model if API call fails
        config = get_llm_config()
        return ModelsResponse(
            object="list",
            data=[
                ModelInfo(
                    id=config["model"],
                    object="model", 
                    created=0,
                    owned_by="configured"
                )
            ]
        )


@router.post("/chat/completions")
async def create_chat_completion(request: ChatCompletionRequest):
    """
    Create chat completion
    Compatible with OpenAI API /v1/chat/completions endpoint
    Supports both streaming and non-streaming responses
    """
    try:
        client = await get_openai_client()
        
        # Convert request to OpenAI format, handling multimodal content
        openai_messages = []
        for msg in request.messages:
            if isinstance(msg.content, str):
                # Simple text message
                openai_messages.append({"role": msg.role, "content": msg.content})
            else:
                # Multimodal message with content parts
                content_parts = []
                for part in msg.content:
                    if part.type == "text":
                        content_parts.append({"type": "text", "text": part.text})
                    elif part.type == "image_url" and part.image_url:
                        image_part = {
                            "type": "image_url",
                            "image_url": {
                                "url": part.image_url.url
                            }
                        }
                        content_parts.append(image_part)
                openai_messages.append({"role": msg.role, "content": content_parts})
        
        completion_params = {
            "model": request.model,
            "messages": openai_messages,
            "temperature": request.temperature,
            "stream": request.stream,
            "top_p": request.top_p,
        }
        
        if request.max_tokens is not None:
            completion_params["max_tokens"] = request.max_tokens
        
        if request.stream:
            # Streaming response
            async def generate_stream():
                try:
                    stream = await client.chat.completions.create(**completion_params)
                    async for chunk in stream:
                        chunk_data = chunk.model_dump()
                        yield f"data: {json.dumps(chunk_data)}\n\n"
                    yield "data: [DONE]\n\n"
                except Exception as e:
                    error_data = {
                        "error": {
                            "message": str(e),
                            "type": "stream_error"
                        }
                    }
                    yield f"data: {json.dumps(error_data)}\n\n"
            
            return StreamingResponse(
                generate_stream(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no"  # Disable proxy buffering
                }
            )
        else:
            # Non-streaming response
            completion = await client.chat.completions.create(**completion_params)
            return completion.model_dump()
            
    except Exception as e:
        logger.error(f"Error in chat completion: {e}")
        raise HTTPException(status_code=500, detail=f"Chat completion failed: {str(e)}")

@router.get("/health")
async def health_check():
    """Health check for LLM service"""
    try:
        config_valid = validate_llm_config()
        config = get_llm_config()
        
        return {
            "status": "healthy" if config_valid else "configuration_error",
            "config_valid": config_valid,
            "base_url": config["base_url"] if config_valid else None,
            "model": config["model"] if config_valid else None
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "error",
            "error": str(e)
        }