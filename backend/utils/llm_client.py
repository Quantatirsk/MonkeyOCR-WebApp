import os
import logging
from typing import Dict, List, Optional, AsyncGenerator, Any
from openai import AsyncOpenAI
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class TranslationRequest(BaseModel):
    text: str
    source_language: str
    target_language: str
    model: Optional[str] = None


class TranslationResult(BaseModel):
    original_text: str
    translated_text: str
    source_language: str
    target_language: str
    model: str
    confidence: Optional[float] = None


class LLMClient:

    def __init__(self):
        """Initialize LLM client with environment variables."""
        self.base_url = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
        self.api_key = os.getenv("LLM_API_KEY")
        self.default_model = os.getenv("LLM_MODEL", "gpt-3.5-turbo")

        if not self.api_key:
            logger.warning("LLM_API_KEY not found in environment variables")

        self.client = AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.base_url
        ) if self.api_key else None

    async def get_models(self) -> List[Dict[str, Any]]:
        """Get list of available models."""
        if not self.client:
            logger.error("LLM client not initialized - missing API key")
            return []

        try:
            models = await self.client.models.list()
            return [{"id": model.id, "object": model.object,
                     "created": model.created} for model in models.data]
        except Exception as e:
            logger.error(f"Failed to fetch models: {str(e)}")
            return []

    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        stream: bool = False,
        **kwargs
    ) -> Any:
        """General chat completion with support for streaming."""
        if not self.client:
            raise ValueError("LLM client not initialized - missing API key")

        model = model or self.default_model

        try:
            response = await self.client.chat.completions.create(
                model=model,
                messages=messages,  # type: ignore
                stream=stream,
                **kwargs
            )
            return response
        except Exception as e:
            logger.error(f"Chat completion failed: {str(e)}")
            raise

    async def translate_text(
        self,
        request: TranslationRequest,
        stream: bool = False
    ) -> Any:
        """Translate text using LLM."""
        if not self.client:
            raise ValueError("LLM client not initialized - missing API key")

        # Create translation prompt
        system_prompt = (
            f"You are a professional translator. Translate the given text "
            f"from {request.source_language} to {request.target_language}.\n\n"
            "Rules:\n"
            "1. Maintain the original formatting and structure\n"
            "2. Preserve markdown formatting if present\n"
            "3. Keep technical terms accurate\n"
            "4. Do not translate code blocks or mathematical formulas\n"
            "5. Return only the translated text without explanations\n"
            "6. If the source language is 'auto', detect the language "
            "automatically"
        )

        user_prompt = f"Translate this text:\n\n{request.text}"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        model = request.model or self.default_model

        try:
            if stream:
                return self._stream_translate(messages, model)
            else:
                response = await self.client.chat.completions.create(
                    model=model,
                    messages=messages,  # type: ignore
                    temperature=0.3,  # Lower temperature for consistency
                    max_tokens=4096
                )

                translated_text = response.choices[0].message.content

                # Handle potential None value from API response
                if translated_text is None:
                    translated_text = ""
                    logger.warning("Received empty translation from LLM API")

                return TranslationResult(
                    original_text=request.text,
                    translated_text=translated_text,
                    source_language=request.source_language,
                    target_language=request.target_language,
                    model=model
                )

        except Exception as e:
            logger.error(f"Translation failed: {str(e)}")
            raise

    async def _stream_translate(
            self,
            messages: List[Dict[str, str]],
            model: str
    ) -> AsyncGenerator[str, None]:
        """Stream translation response."""
        if not self.client:
            raise ValueError("LLM client not initialized - missing API key")

        try:
            # When stream=True, create() returns an async iterator directly
            stream = self.client.chat.completions.create(
                model=model,
                messages=messages,  # type: ignore
                stream=True,
                temperature=0.3,
                max_tokens=4096
            )

            async for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content

        except Exception as e:
            logger.error(f"Streaming translation failed: {str(e)}")
            raise

    async def detect_language(self, text: str) -> str:
        """Detect language of given text."""
        if not self.client:
            raise ValueError("LLM client not initialized - missing API key")

        system_prompt = (
            """You are a language detection expert. Detect the language of "
            "the given text and return only the language code "
            "(e.g., 'en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', etc.). "
            "Return only the language code, nothing else."""
        )

        messages = [
            {"role": "system", "content": system_prompt},
            # First 500 chars for detection
            {"role": "user", "content": f"Detect language: {text[:500]}"}
        ]

        try:
            response = await self.client.chat.completions.create(
                model=self.default_model,
                messages=messages,  # type: ignore
                temperature=0.1,
                max_tokens=10
            )

            content = response.choices[0].message.content
            if content is None:
                return "unknown"
            return content.strip().lower()

        except Exception as e:
            logger.error(f"Language detection failed: {str(e)}")
            return "unknown"


# Global instance
llm_client = LLMClient()
