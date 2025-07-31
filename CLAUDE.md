# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MonkeyOCR WebApp is a full-stack application for OCR content extraction and visualization. The architecture follows a separated frontend/backend pattern:

- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS + shadcn/ui
- **Backend**: FastAPI + Python 3.8+
- **External API**: MonkeyOCR API (https://ocr.teea.cn) for document processing

## Architecture

### Frontend Structure
```
frontend/
├── src/
│   ├── components/     # React components (UploadZone, DocumentViewer, TaskList)
│   ├── store/         # Zustand state management
│   ├── types/         # TypeScript interfaces (ProcessingTask, DocumentResult, etc.)
│   ├── api/           # API client wrappers
│   └── utils/         # Helper functions
```

### Backend Structure  
```
backend/
├── api/               # FastAPI route handlers
├── utils/            # ZIP processing, MonkeyOCR client
└── models/           # Data models
```

### Data Flow
1. User uploads files through React frontend
2. Backend receives files, calls MonkeyOCR API
3. MonkeyOCR returns ZIP with `.md` files and `images/` directory
4. Backend extracts ZIP, fixes image paths, serves as static files
5. Frontend displays markdown content with embedded images

## Development Commands

### Frontend Development
```bash
cd frontend
npm run dev              # Start Vite dev server (port 5173)
npm run build           # Build for production
npm run preview         # Preview production build
npm run lint            # Run ESLint
```

### Backend Development
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8001    # Start FastAPI dev server
python -m pytest                                         # Run tests (when implemented)
```

### Project Setup (from TODO.json phases)
```bash
# Phase 1: Initialize projects
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
npx shadcn-ui@latest init
cd ../backend && pip install -r requirements.txt
```

## Key Implementation Details

### State Management (Zustand)
- Global app state includes: `tasks[]`, `results`, `currentTaskId`, `searchQuery`
- Actions handle: file upload, task polling, result loading, search

### File Processing Pipeline
1. Upload → validate file types (PDF, JPG, PNG)
2. Call MonkeyOCR API (`/parse` or `/parse/split` endpoints)
3. Download returned ZIP file
4. Extract and process: fix markdown image paths to point to static server
5. Store results and serve images via `/static/{path}` endpoint

### Core Components
- **UploadZone**: File drag-drop with react-dropzone, supports batch upload
- **DocumentViewer**: Renders markdown with react-markdown, displays extracted images
- **TaskList**: Shows processing status with real-time updates
- **ProcessingStatus**: Progress indicators and error handling

### API Integration
MonkeyOCR API endpoints used:
- `/parse` - Standard document parsing  
- `/parse/split` - Page-by-page parsing
- `/batch/submit` - Batch processing
- Returns download URLs for ZIP files containing markdown + images

## Development Workflow

Follow the 5-phase plan in TODO.json:
1. **Phase 1**: Project initialization and dependencies
2. **Phase 2**: Core functionality (upload, OCR integration, result display)  
3. **Phase 3**: UI components and layout
4. **Phase 4**: Advanced features (batch processing, export)
5. **Phase 5**: Testing and deployment

Track progress using the task IDs in TODO.json (e.g., P1-T001, P2-T003).

## Configuration

### Frontend Environment
- Vite config includes proxy to backend API
- TailwindCSS configured with shadcn/ui theme
- TypeScript strict mode enabled

### Backend Environment  
- CORS configured for frontend origin (localhost:5173)
- Static file serving for extracted images
- MonkeyOCR API base URL: https://ocr.teea.cn

## Data Models

Key TypeScript interfaces:
```typescript
ProcessingTask: { id, filename, status, progress, result_url }
DocumentResult: { task_id, markdown_content, images[], download_url }
ImageResource: { filename, path, url, alt }
```

Backend processes ZIP files to transform relative image paths in markdown to absolute URLs pointing to the static file server.