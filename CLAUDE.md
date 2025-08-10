# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MonkeyOCR WebApp is a full-stack application for OCR content extraction and visualization with Redis caching and LLM translation capabilities.

**Tech Stack:**

- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS + shadcn/ui + Zustand
- **Backend**: FastAPI + Python 3.8+ with Redis caching and OpenAI-compatible LLM integration
- **External Services**: MonkeyOCR API (https://ocr.teea.cn), configurable LLM API
- **Infrastructure**: Docker + Redis for caching and persistence

## Development Commands


### Fromtend + Backend

```bash
python start.py
```

### Frontend

```bash
cd frontend
npm install                  # Install dependencies
npm run dev                  # Start dev server (port 5173)
npm run build               # Build for production
npm run preview             # Preview production build
npm run lint                # Run ESLint with TypeScript checking
```

### Backend

```bash
cd backend
pip install -r requirements.txt                          # Install dependencies
uvicorn main:app --reload --host 0.0.0.0 --port 8001   # Start dev server
python -m pytest tests/                                 # Run tests
python -m pytest tests/test_llm_cache.py -v            # Run specific test
```

### Docker Operations

```bash
# Development with Redis
docker-compose up -d redis                    # Start Redis only
docker-compose down                           # Stop all services

# Full stack deployment
docker-compose up --build                     # Build and run everything
docker-compose logs -f monkeyocr-webapp      # View application logs
docker-compose exec monkeyocr-webapp bash    # Shell into container
```

## Architecture & Data Flow

### Request Processing Pipeline

1. **File Upload** → Frontend validates file types (PDF/JPG/PNG/WEBP, max 50MB)
2. **Task Creation** → Backend generates UUID, creates ProcessingTask with metadata
3. **Cache Check** → Redis checks for existing OCR results (hash-based on file content + params)
4. **OCR Processing**:
   - Cache hit: Return immediately with cached result
   - Cache miss: Call MonkeyOCR API → Download ZIP → Extract markdown + images
5. **Result Storage**: Static files served from `/static/{task_id}/` endpoint
6. **Frontend Display**: Markdown rendering with embedded images via absolute URLs

### Caching Architecture

```
Redis Cache Layers:
1. OCR Results: SHA256(file_content + extract_type + split_pages) → ZIP file path
2. LLM Translations: Hash(prompt + content) → Translated text (TTL: 1 hour)
3. Task Persistence: Task metadata with status history and processing metrics
```

### State Management Pattern

- **Frontend**: Zustand store manages `tasks[]`, `currentTaskId`, `searchQuery`
- **Backend**: Redis or file-based persistence for task state
- **Sync**: Polling mechanism for real-time status updates

## Key Implementation Details

### Backend Persistence System

- **Primary**: Redis persistence (`utils/redis_persistence.py`) when `REDIS_ENABLED=true`
- **Fallback**: File-based JSON storage (`utils/persistence.py`)
- **Task Model**: Includes `file_hash`, `processing_duration`, `from_cache` flags

### MonkeyOCR Integration

```python
# API Endpoints used:
/parse         # Standard document parsing
/parse/split   # Page-by-page parsing
/batch/submit  # Batch processing (future)

# Result processing:
1. Download ZIP from MonkeyOCR
2. Extract to results/{task_id}/
3. Fix markdown image paths: ![](images/xxx) → ![](/static/{task_id}/images/xxx)
4. Serve images as static files
```

### LLM Translation Feature

- Configurable OpenAI-compatible API (supports local models via Ollama/LM Studio)
- Streaming responses with SSE (Server-Sent Events)
- Redis caching with configurable TTL
- Fallback to non-streaming if SSE fails

### Error Handling Patterns

- Background task processing with status updates
- Graceful cache invalidation on failures
- Comprehensive logging with contextual information
- HTTP exception hierarchy with detailed error messages

## Configuration

### Environment Variables (.env)

```bash
# Required
MONKEYOCR_API_KEY=your_key_here

# Optional but recommended
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379

# LLM Configuration (optional)
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=your_key_here
LLM_MODEL_NAME=gpt-4o-mini

# Development
DEBUG=true
LOG_LEVEL=DEBUG
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Frontend Proxy Configuration

Vite automatically proxies `/api` requests to backend (configured in `vite.config.ts`)

## Common Development Tasks

### Adding New OCR Processing Mode

1. Update `extraction_type` in `backend/models/schemas.py`
2. Modify `MonkeyOCRClient.process_file()` in `backend/utils/monkeyocr_client.py`
3. Update cache key generation in `backend/utils/ocr_cache.py`
4. Add UI option in `frontend/src/components/UploadZone.tsx`

### Debugging Cache Issues

```python
# Check Redis connection
redis-cli ping

# Monitor cache operations
redis-cli monitor

# Clear specific cache
redis-cli DEL "ocr:result:*"

# View cache stats in logs
grep "cache hit\|cache miss" backend.log
```

### Testing File Processing

```bash
# Test with sample file
curl -X POST http://localhost:8001/api/upload \
  -F "file=@sample.pdf" \
  -F "extract_type=standard" \
  -F "split_pages=false"

# Check task status
curl http://localhost:8001/api/tasks/{task_id}/status
```

## Performance Optimization

### Current Optimizations

- **OCR Result Caching**: ~90% cache hit rate for duplicate files
- **LLM Response Caching**: Reduces API calls by 60-70%
- **Static File Serving**: Direct nginx serving in production
- **Parallel Task Processing**: Background tasks with asyncio

### Monitoring Points

- Redis memory usage: `redis-cli INFO memory`
- Task processing duration: Check `processing_duration` field
- Cache hit rates: Monitor `from_cache` flag in task results
- API response times: FastAPI automatic metrics at `/metrics` (if enabled)

## Important Architectural Decisions

1. **ZIP Processing**: MonkeyOCR returns ZIPs; we extract and serve contents as static files rather than storing in database
2. **Task IDs as Namespaces**: Each task gets unique directory for isolation
3. **Markdown Path Rewriting**: Essential for image display; paths rewritten during ZIP extraction
4. **Dual Persistence**: Redis for production performance, file-based for development simplicity
5. **Cache Invalidation**: Automatic cleanup on task deletion to prevent stale data
