# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MonkeyOCR WebApp is a full-stack application for OCR content extraction and visualization with Redis caching, LLM translation, and user authentication.

**Tech Stack:**

- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS + shadcn/ui + Zustand
- **Backend**: FastAPI + Python 3.12+ with SQLite persistence, Redis caching, and OpenAI-compatible LLM
- **Storage**: SQLite (tasks/users), Redis (caching only), Static files (extracted content)
- **External Services**: MonkeyOCR API (https://ocr.teea.cn), configurable LLM API

## Development Commands

### Quick Start (Frontend + Backend)

```bash
python start.py  # Starts both frontend and backend, handles port conflicts
```

### Frontend Development

```bash
cd frontend
npm install                  # Install dependencies
npm run dev                  # Start dev server (port 5173)
npm run build               # Build for production
npm run lint                # Run ESLint with TypeScript checking
npm run preview             # Preview production build
```

### Backend Development

```bash
cd backend
pip install -r requirements.txt                          # Install dependencies
uvicorn main:app --reload --host 0.0.0.0 --port 8001   # Start dev server

# Database operations
python reset_database.py     # Reset SQLite database
python check_task_db.py      # Check database contents
```

### Docker Operations

```bash
# Development with Redis
docker-compose up -d redis                    # Start Redis only
docker-compose down                           # Stop all services

# Full stack deployment
docker-compose up --build                     # Build and run everything
docker-compose logs -f monkeyocr-webapp      # View application logs
```

## Architecture & Data Flow

### Request Processing Pipeline

1. **Authentication** → JWT-based auth with demo user (demo/demo123456)
2. **File Upload** → Frontend validates (PDF/JPG/PNG/WEBP, max 50MB)
3. **Task Creation** → Backend generates UUID, stores in SQLite
4. **Cache Check** → Redis checks for existing results (SHA256 hash)
5. **OCR Processing**:
   - Cache hit: Return cached result immediately
   - Cache miss: MonkeyOCR API → ZIP download → Extract to static/{task_id}/
6. **Result Display**: Markdown with rewritten image paths for static serving

### Storage Architecture

```
SQLite (Primary Storage):
- Users table: Authentication and user data
- Tasks table: Task metadata, status, processing metrics

Redis (Caching Only):
- OCR Results: file_hash → ZIP path (30 days TTL)
- LLM Translations: prompt_hash → translation (24 hours TTL)

Static Files:
- /static/{task_id}/: Extracted markdown and images
- /results/{task_id}_result.zip: Original ZIP from MonkeyOCR
```

### Authentication & Middleware Stack

1. **SecurityMiddleware**: CSP headers, security policies
2. **AuthMiddleware**: JWT validation, user context
3. **RateLimitMiddleware**: In-memory rate limiting (no Redis dependency)

Rate limits:
- Login: 50 requests/minute per IP
- Upload: 100 requests/minute per user
- Default: 600 requests/minute per user

## Key Implementation Details

### Frontend Block System

The frontend uses a sophisticated block-based architecture for content display and synchronization:

**Core Components:**
- `BlockData`: Structured content blocks (text, title, image, table, interline_equation)
- `BlockProcessor`: Utilities for block manipulation and finding
- `BlockMarkdownGenerator`: Converts blocks to markdown with 1:1 DOM mapping
- `BlockMarkdownViewer`: Interactive markdown display with block highlighting
- `SyncManager`: Manages scroll and selection sync between PDF/markdown views

**Block Type Handling:**
- **text**: Regular paragraphs with list detection (ordered/unordered)
- **title**: Headers with level detection (H1-H3)
- **image**: Static file serving with path rewriting
- **table**: HTML table rendering with auto-fixing for incomplete structures
- **interline_equation**: LaTeX formulas with KaTeX rendering

### Translation System

**Parallel Translation Architecture:**
- Concurrent LLM calls (8 parallel) with retry mechanism
- Machine Translation API (10 parallel) for faster batch processing
- Block-level caching with content hashing
- Inline display mode with original/translation pairs

**Translation Display Modes:**
- **Inline Mode**: Translation appears below original in same block
- **Compare Mode**: Side-by-side comparison with sync scrolling
- **Export**: Clean markdown generation for copy/download

### Persistence System

```python
# SQLite for primary storage
utils/sqlite_persistence.py: SQLitePersistenceManager
- Task CRUD operations
- User authentication data
- Processing metrics

# Redis for caching only
utils/redis_client.py: CacheManager
- OCR result caching
- LLM response caching
- Graceful fallback to memory cache
```

### MonkeyOCR Integration

```python
# utils/monkeyocr_client.py
API endpoints:
- /parse: Standard parsing
- /parse/split: Page-by-page parsing

# utils/zip_processor.py
Processing flow:
1. Download ZIP from MonkeyOCR
2. Extract to static/{task_id}/
3. Rewrite markdown paths: ![](images/x) → ![](/static/{task_id}/images/x)
4. Generate content manifest
```

### LLM Translation

```python
# api/llm.py
Features:
- OpenAI-compatible API (Ollama/LM Studio support)
- SSE streaming with fallback
- Redis caching with hash-based keys
- Configurable model and temperature
```

## Configuration

### Required Environment Variables

```bash
# .env file (copy from .env.example)
MONKEYOCR_API_KEY=your_key_here
JWT_SECRET_KEY=your_secure_random_string_here
```

### Optional Configuration

```bash
# Redis (caching)
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379

# LLM (translation)
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=your_key_here
LLM_MODEL_NAME=gpt-4o-mini

# Development
DEBUG=true
LOG_LEVEL=DEBUG
```

## Common Development Tasks

### Database Management

```bash
# Reset database and create demo user
python backend/reset_database.py

# Check task data
python backend/check_task_db.py

# Manual SQLite queries
sqlite3 backend/data/monkeyocr.db
```

### Testing Authentication

```bash
# Login as demo user
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo123456"}'

# Use token in requests
curl -H "Authorization: Bearer {token}" \
  http://localhost:8001/api/tasks
```

### Cache Debugging

```bash
# Monitor Redis operations
redis-cli monitor

# Check cache keys
redis-cli --scan --pattern "ocr:*"
redis-cli --scan --pattern "llm:*"

# Clear caches
redis-cli FLUSHDB
```

## Performance Optimization

### Current Optimizations

- **SQLite**: WAL mode, optimized indexes, connection pooling
- **Redis Caching**: 90% hit rate for duplicate OCR requests
- **Static Serving**: Direct file serving for extracted content
- **In-Memory Rate Limiting**: No Redis dependency for rate limits

### Monitoring Points

- SQLite: `backend/data/monkeyocr.db` size and query performance
- Redis: `redis-cli INFO memory` for cache usage
- Task metrics: `processing_duration` and `from_cache` fields
- Rate limits: Check logs for limit violations

## Important Architectural Decisions

1. **SQLite over Redis for persistence**: Better reliability, simpler deployment
2. **Static file extraction**: Serve images directly instead of database storage
3. **Task ID namespacing**: Isolate each task's files in `/static/{task_id}/`
4. **In-memory rate limiting**: Reduce Redis dependency, improve performance
5. **Demo user auto-creation**: Simplifies initial setup and testing