# MonkeyOCR WebApp

A full-stack web application for OCR content extraction and visualization, supporting images and PDF files with real-time processing and markdown visualization.

## Features

- 📁 **File Upload**: Drag-and-drop support for PDF and image files
- 🔍 **OCR Processing**: Integration with MonkeyOCR API for content extraction
- 📄 **Markdown Visualization**: Rich display of extracted content with embedded images
- 📊 **Batch Processing**: Handle multiple files simultaneously
- ⏱️ **Real-time Progress**: Live status updates and progress tracking
- 💾 **Export Options**: Download processed results and original files
- 🎨 **Modern UI**: Built with React + shadcn/ui + TailwindCSS

## Tech Stack

### Frontend
- **React 18** with **TypeScript**
- **Vite** for build tooling
- **TailwindCSS** + **shadcn/ui** for styling
- **Zustand** for state management
- **react-markdown** for content rendering
- **Lucide React** for icons

### Backend
- **FastAPI** (Python 3.8+)
- **httpx** for HTTP requests
- **MonkeyOCR API** integration
- ZIP file processing and static file serving

## Project Structure

```
MonkeyUI/
├── frontend/          # React frontend application
├── backend/           # FastAPI backend service
├── uploads/           # Temporary file storage
├── results/           # Processed content storage
├── static/            # Static file serving
├── plan.json          # Detailed project architecture
├── TODO.json          # Development roadmap
└── CLAUDE.md          # Developer guidance
```

## Development

### Prerequisites
- Node.js 18+
- Python 3.8+
- npm or yarn

### Setup

1. **Frontend Setup**
```bash
cd frontend
npm install
npm run dev    # Starts on http://localhost:5173
```

2. **Backend Setup**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

### Development Workflow

The project follows a structured 5-phase development plan detailed in `TODO.json`:

1. **Phase 1**: Project initialization and infrastructure
2. **Phase 2**: Core functionality (upload, OCR, display)
3. **Phase 3**: UI/UX improvements
4. **Phase 4**: Advanced features and optimization
5. **Phase 5**: Testing and deployment

## API Integration

This application integrates with the MonkeyOCR API for document processing:
- **Endpoint**: https://ocr.teea.cn
- **Supported formats**: PDF, JPG, JPEG, PNG
- **Processing modes**: Standard parsing, page splitting, text/formula/table extraction

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the development phases in TODO.json
4. Submit a pull request

For detailed development guidance, see `CLAUDE.md`.