# MonkeyOCR WebApp - Minimal Build (预计 150-200MB)
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build
# Debug: Check if build output exists
RUN ls -la dist/ || echo "Build failed - no dist directory"

# Use python alpine for smaller size but with package manager
FROM python:3.11-alpine AS runtime

WORKDIR /app

# Install build dependencies temporarily and runtime dependencies
RUN apk add --no-cache curl \
    && apk add --virtual .build-deps gcc musl-dev libffi-dev

# Copy backend requirements and install dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Clean up build dependencies
RUN apk del .build-deps

# Create directories first
RUN mkdir -p /app/static

# Copy application files
COPY backend/ ./

# Copy frontend build output
COPY --from=frontend-build /app/frontend/dist ./static/frontend

# Verify frontend files exist
RUN ls -la ./static/frontend/ && echo "Frontend files found!" || echo "Frontend copy failed"

# Use single process mode (no nginx)
EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]