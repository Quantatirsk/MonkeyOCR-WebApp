from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import logging
import json
import asyncio
from utils.llm_client import llm_client, TranslationRequest, TranslationResult

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/llm", tags=["LLM"])

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = None
    stream: bool = False
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = None

class ModelInfo(BaseModel):
    id: str
    object: str
    created: int

@router.get("/models", response_model=List[ModelInfo])
async def get_models():
    """Get list of available LLM models."""
    try:
        models = await llm_client.get_models()
        return models
    except Exception as e:
        logger.error(f"Failed to get models: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get models: {str(e)}")

@router.post("/chat")
async def chat_completion(request: ChatRequest):
    """Chat completion endpoint with streaming support."""
    try:
        # Convert ChatMessage objects to dictionaries
        messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]
        
        # Prepare additional parameters
        kwargs = {}
        if request.temperature is not None:
            kwargs["temperature"] = request.temperature
        if request.max_tokens is not None:
            kwargs["max_tokens"] = request.max_tokens
        
        if request.stream:
            # Streaming response
            async def generate_stream():
                try:
                    response = await llm_client.chat_completion(
                        messages=messages,
                        model=request.model,
                        stream=True,
                        **kwargs
                    )
                    
                    async for chunk in response:
                        if chunk.choices[0].delta.content is not None:
                            # Format as SSE (Server-Sent Events)
                            data = {
                                "choices": [{
                                    "delta": {
                                        "content": chunk.choices[0].delta.content
                                    }
                                }]
                            }
                            yield f"data: {json.dumps(data)}\n\n"
                    
                    # Send end marker
                    yield "data: [DONE]\n\n"
                    
                except Exception as e:
                    logger.error(f"Streaming error: {str(e)}")
                    error_data = {"error": {"message": str(e)}}
                    yield f"data: {json.dumps(error_data)}\n\n"
            
            return StreamingResponse(
                generate_stream(), 
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "Access-Control-Allow-Origin": "*",
                }
            )
        else:
            # Non-streaming response
            response = await llm_client.chat_completion(
                messages=messages,
                model=request.model,
                stream=False,
                **kwargs
            )
            
            return {
                "choices": [{
                    "message": {
                        "role": "assistant",
                        "content": response.choices[0].message.content
                    }
                }],
                "model": response.model,
                "usage": response.usage.model_dump() if response.usage else None
            }
            
    except Exception as e:
        logger.error(f"Chat completion failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/translate", response_model=TranslationResult)
async def translate_text(
    request: TranslationRequest,
    stream: bool = Query(False, description="Enable streaming response")
):
    """Translate text using LLM."""
    try:
        if stream:
            # Streaming translation
            async def generate_translation_stream():
                try:
                    accumulated_text = ""
                    async for chunk in await llm_client.translate_text(request, stream=True):
                        accumulated_text += chunk
                        data = {
                            "original_text": request.text,
                            "translated_text": accumulated_text,
                            "source_language": request.source_language,
                            "target_language": request.target_language,
                            "model": request.model or llm_client.default_model,
                            "is_complete": False
                        }
                        yield f"data: {json.dumps(data)}\n\n"
                    
                    # Send final complete result
                    final_data = {
                        "original_text": request.text,
                        "translated_text": accumulated_text,
                        "source_language": request.source_language,
                        "target_language": request.target_language,
                        "model": request.model or llm_client.default_model,
                        "is_complete": True
                    }
                    yield f"data: {json.dumps(final_data)}\n\n"
                    yield "data: [DONE]\n\n"
                    
                except Exception as e:
                    logger.error(f"Translation streaming error: {str(e)}")
                    error_data = {"error": {"message": str(e)}}
                    yield f"data: {json.dumps(error_data)}\n\n"
            
            return StreamingResponse(
                generate_translation_stream(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "Access-Control-Allow-Origin": "*",
                }
            )
        else:
            # Non-streaming translation
            result = await llm_client.translate_text(request, stream=False)
            return result
            
    except Exception as e:
        logger.error(f"Translation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/detect-language")
async def detect_language(text: str):
    """Detect the language of given text."""
    try:
        language = await llm_client.detect_language(text)
        return {"language": language, "text_preview": text[:100]}
    except Exception as e:
        logger.error(f"Language detection failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def health_check():
    """Health check endpoint for LLM service."""
    try:
        # Test if client is properly initialized
        if not llm_client.client:
            return {"status": "error", "message": "LLM client not initialized - missing API key"}
        
        # Try to get models as a basic connectivity test
        models = await llm_client.get_models()
        model_count = len(models) if models else 0
        
        return {
            "status": "healthy",
            "base_url": llm_client.base_url,
            "default_model": llm_client.default_model,
            "available_models": model_count,
            "api_key_configured": bool(llm_client.api_key)
        }
    except Exception as e:
        logger.error(f"LLM health check failed: {str(e)}")
        return {
            "status": "error", 
            "message": str(e),
            "base_url": llm_client.base_url,
            "api_key_configured": bool(llm_client.api_key)
        }