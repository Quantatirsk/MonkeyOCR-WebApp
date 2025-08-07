"""
Translation API endpoints for MonkeyOCR WebApp
Advanced translation functionality with batch processing and caching
"""
import logging
import uuid
import asyncio
from typing import Optional, Dict, Any, List, cast
from datetime import datetime, timedelta
import json

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from api.llm import get_openai_client
from config import get_llm_config, settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/translate", tags=["translation"])

# In-memory cache for translations (in production, use Redis or similar)
translation_cache: Dict[str, Any] = {}
translation_results: Dict[str, Any] = {}


class TranslationBlock(BaseModel):
    """Single block to be translated"""
    id: str = Field(..., description="Block identifier")
    content: str = Field(..., description="Block content to translate")
    type: str = Field(default="text", description="Block type (text, heading, etc.)")


class TranslationRequest(BaseModel):
    """Translation request model"""
    blocks: List[TranslationBlock] = Field(..., description="Blocks to translate")
    source_language: str = Field(default="auto", description="Source language")
    target_language: str = Field(..., description="Target language") 
    preserve_formatting: bool = Field(default=True, description="Preserve original formatting")
    translation_style: str = Field(default="accurate", description="Translation style: accurate, natural, formal")


class BlockTranslationResult(BaseModel):
    """Individual block translation result"""
    block_id: str
    original_content: str
    translated_content: str
    status: str  # completed, error, pending
    error_message: Optional[str] = None


class SingleBlockTranslationRequest(BaseModel):
    """Single block translation request model"""
    block_content: str = Field(..., description="Block content to translate")
    source_language: str = Field(default="auto", description="Source language")
    target_language: str = Field(..., description="Target language")
    translation_style: str = Field(default="accurate", description="Translation style")


class TranslationStatus(BaseModel):
    """Translation job status"""
    translation_id: str
    status: str  # pending, processing, completed, failed
    progress: float  # 0.0 to 1.0
    total_blocks: int
    completed_blocks: int
    failed_blocks: int
    estimated_time_remaining: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class TranslationResult(BaseModel):
    """Complete translation result"""
    translation_id: str
    status: str
    source_language: str
    target_language: str
    total_blocks: int
    results: List[BlockTranslationResult]
    created_at: datetime
    completed_at: Optional[datetime] = None


def generate_translation_id() -> str:
    """Generate unique translation ID"""
    return str(uuid.uuid4())


def create_translation_prompt(content: str, source_lang: str, target_lang: str, style: str) -> str:
    """Create optimized translation prompt based on style"""
    style_prompts = {
        "accurate": "Translate the following text accurately, preserving all meaning and technical terms.",
        "natural": "Translate the following text naturally, adapting idioms and expressions for native speakers.",
        "formal": "Translate the following text using formal language and professional terminology."
    }
    
    style_instruction = style_prompts.get(style, style_prompts["accurate"])
    
    if source_lang == "auto":
        prompt = f"""{style_instruction} 
Translate to {target_lang}. Preserve formatting, structure, and any special characters:

{content}

Translation:"""
    else:
        prompt = f"""{style_instruction}
Translate from {source_lang} to {target_lang}. Preserve formatting, structure, and any special characters:

{content}

Translation:"""
    
    return prompt


async def translate_single_block(
    block: TranslationBlock,
    source_language: str,
    target_language: str,
    translation_style: str
) -> BlockTranslationResult:
    """Translate a single block of text"""
    try:
        client = await get_openai_client()
        config = get_llm_config()
        
        # Check cache first
        cache_key = f"{block.content}_{source_language}_{target_language}_{translation_style}"
        if cache_key in translation_cache:
            cached = translation_cache[cache_key]
            if datetime.now() - cached["timestamp"] < timedelta(seconds=settings.translation_cache_ttl):
                return BlockTranslationResult(
                    block_id=block.id,
                    original_content=block.content,
                    translated_content=cached["translation"],
                    status="completed"
                )
        
        # Create translation prompt
        prompt = create_translation_prompt(block.content, source_language, target_language, translation_style)
        
        messages = [
            {
                "role": "system", 
                "content": f"You are a professional translator specializing in {translation_style} translations. Always preserve formatting and structure."
            },
            {"role": "user", "content": prompt}
        ]
        
        completion = await client.chat.completions.create(
            model=config["model"],
            messages=cast(Any, messages),  # Cast to Any to bypass strict typing
            temperature=0.3,  # Lower temperature for consistency
            max_tokens=len(block.content) * 3  # Reasonable limit based on input length
        )
        
        translation = completion.choices[0].message.content.strip()
        
        # Cache the result
        translation_cache[cache_key] = {
            "translation": translation,
            "timestamp": datetime.now()
        }
        
        return BlockTranslationResult(
            block_id=block.id,
            original_content=block.content,
            translated_content=translation,
            status="completed"
        )
        
    except Exception as e:
        logger.error(f"Translation failed for block {block.id}: {e}")
        return BlockTranslationResult(
            block_id=block.id,
            original_content=block.content,
            translated_content="",
            status="error",
            error_message=str(e)
        )


async def process_translation_job(translation_id: str, request: TranslationRequest):
    """Process translation job in background"""
    try:
        # Initialize job status
        translation_results[translation_id] = TranslationStatus(
            translation_id=translation_id,
            status="processing",
            progress=0.0,
            total_blocks=len(request.blocks),
            completed_blocks=0,
            failed_blocks=0,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        results = []
        completed = 0
        failed = 0
        
        # Process blocks with controlled concurrency to avoid rate limits
        semaphore = asyncio.Semaphore(5)  # Max 5 concurrent translations
        
        async def translate_with_semaphore(block):
            async with semaphore:
                return await translate_single_block(
                    block, 
                    request.source_language, 
                    request.target_language, 
                    request.translation_style
                )
        
        # Create tasks for all blocks
        tasks = [translate_with_semaphore(block) for block in request.blocks]
        
        # Process tasks and update progress
        for i, task in enumerate(asyncio.as_completed(tasks)):
            result = await task
            results.append(result)
            
            if result.status == "completed":
                completed += 1
            else:
                failed += 1
            
            # Update progress
            progress = (i + 1) / len(request.blocks)
            translation_results[translation_id] = TranslationStatus(
                translation_id=translation_id,
                status="processing",
                progress=progress,
                total_blocks=len(request.blocks),
                completed_blocks=completed,
                failed_blocks=failed,
                created_at=translation_results[translation_id].created_at,
                updated_at=datetime.now()
            )
        
        # Store final results
        translation_results[translation_id] = TranslationResult(
            translation_id=translation_id,
            status="completed" if failed == 0 else "partially_completed",
            source_language=request.source_language,
            target_language=request.target_language,
            total_blocks=len(request.blocks),
            results=results,
            created_at=translation_results[translation_id].created_at,
            completed_at=datetime.now()
        )
        
    except Exception as e:
        logger.error(f"Translation job {translation_id} failed: {e}")
        translation_results[translation_id] = TranslationResult(
            translation_id=translation_id,
            status="failed",
            source_language=request.source_language,
            target_language=request.target_language,
            total_blocks=len(request.blocks),
            results=[],
            created_at=translation_results[translation_id].created_at,
            completed_at=datetime.now()
        )


@router.post("/block")
async def translate_block(request: SingleBlockTranslationRequest):
    """
    Translate a single block of text
    """
    try:
        block = TranslationBlock(
            id="single_block",
            content=request.block_content,
            type="text"
        )
        
        result = await translate_single_block(
            block, request.source_language, request.target_language, request.translation_style
        )
        
        return {
            "original": result.original_content,
            "translation": result.translated_content,
            "status": result.status,
            "error": result.error_message,
            "source_language": request.source_language,
            "target_language": request.target_language
        }
        
    except Exception as e:
        logger.error(f"Single block translation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")


@router.post("/document")
async def translate_document(
    request: TranslationRequest,
    background_tasks: BackgroundTasks
):
    """
    Translate multiple blocks (full document) with batch processing
    Returns immediately with translation_id for status tracking
    """
    try:
        translation_id = generate_translation_id()
        
        # Start background translation job
        background_tasks.add_task(process_translation_job, translation_id, request)
        
        return {
            "translation_id": translation_id,
            "status": "pending",
            "total_blocks": len(request.blocks),
            "message": "Translation job started. Use the translation_id to check status."
        }
        
    except Exception as e:
        logger.error(f"Document translation request failed: {e}")
        raise HTTPException(status_code=500, detail=f"Translation request failed: {str(e)}")


@router.get("/status/{translation_id}")
async def get_translation_status(translation_id: str):
    """
    Get translation job status and progress
    """
    if translation_id not in translation_results:
        raise HTTPException(status_code=404, detail="Translation not found")
    
    result = translation_results[translation_id]
    
    if isinstance(result, TranslationStatus):
        return result.model_dump()
    elif isinstance(result, TranslationResult):
        return {
            "translation_id": result.translation_id,
            "status": result.status,
            "progress": 1.0,
            "total_blocks": result.total_blocks,
            "completed_blocks": len([r for r in result.results if r.status == "completed"]),
            "failed_blocks": len([r for r in result.results if r.status == "error"]),
            "created_at": result.created_at,
            "completed_at": result.completed_at
        }


@router.get("/result/{translation_id}")
async def get_translation_result(translation_id: str):
    """
    Get complete translation results
    """
    if translation_id not in translation_results:
        raise HTTPException(status_code=404, detail="Translation not found")
    
    result = translation_results[translation_id]
    
    if isinstance(result, TranslationStatus):
        if result.status in ["pending", "processing"]:
            raise HTTPException(status_code=202, detail="Translation still in progress")
        else:
            raise HTTPException(status_code=404, detail="Translation failed or results not available")
    
    return result.model_dump()


@router.delete("/result/{translation_id}")
async def delete_translation_result(translation_id: str):
    """
    Delete translation result and free memory
    """
    if translation_id in translation_results:
        del translation_results[translation_id]
        return {"message": "Translation result deleted"}
    else:
        raise HTTPException(status_code=404, detail="Translation not found")


@router.get("/cache/stats")
async def get_cache_stats():
    """
    Get translation cache statistics
    """
    now = datetime.now()
    valid_entries = 0
    expired_entries = 0
    
    for cache_entry in translation_cache.values():
        if now - cache_entry["timestamp"] < timedelta(seconds=settings.translation_cache_ttl):
            valid_entries += 1
        else:
            expired_entries += 1
    
    return {
        "total_cached_translations": len(translation_cache),
        "valid_entries": valid_entries,
        "expired_entries": expired_entries,
        "active_jobs": len(translation_results),
        "cache_ttl": settings.translation_cache_ttl
    }


@router.delete("/cache")
async def clear_cache():
    """
    Clear translation cache
    """
    global translation_cache
    cache_size = len(translation_cache)
    translation_cache.clear()
    
    return {
        "message": f"Cache cleared. Removed {cache_size} entries."
    }