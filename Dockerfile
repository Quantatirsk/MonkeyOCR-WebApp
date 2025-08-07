# MonkeyOCR WebApp - Single Image Multi-Stage Build
FROM node:18-alpine AS frontend-build

WORKDIR /app/frontend

# Copy frontend package files and install dependencies
COPY frontend/package*.json ./
RUN npm ci --only=production

# Copy frontend source and build
COPY frontend/ .
RUN npm run build

# Backend build stage
FROM python:3.11-slim AS backend-build

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    nginx \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./

# Copy frontend build from previous stage
COPY --from=frontend-build /app/frontend/dist ./static/frontend

# Create directories
RUN mkdir -p /app/static /app/data

# Create secure nginx configuration
RUN echo 'server { \
    listen 80; \
    server_name _; \
    \
    # Security headers \
    add_header X-Frame-Options "DENY" always; \
    add_header X-Content-Type-Options "nosniff" always; \
    add_header X-XSS-Protection "1; mode=block" always; \
    add_header Referrer-Policy "strict-origin-when-cross-origin" always; \
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always; \
    \
    # Hide nginx version \
    server_tokens off; \
    \
    # Rate limiting \
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s; \
    limit_req_zone $binary_remote_addr zone=static:10m rate=30r/s; \
    \
    # Serve frontend \
    location / { \
        root /app/static/frontend; \
        index index.html; \
        try_files $uri $uri/ /index.html; \
        \
        # Frontend security headers \
        add_header Content-Security-Policy "default-src '\''self'\''; script-src '\''self'\'' '\''unsafe-inline'\'' '\''unsafe-eval'\''; style-src '\''self'\'' '\''unsafe-inline'\''; img-src '\''self'\'' data: blob:; font-src '\''self'\''; connect-src '\''self'\''; media-src '\''self'\''; object-src '\''none'\''; frame-ancestors '\''none'\'';" always; \
    } \
    \
    # Proxy API requests to backend with rate limiting \
    location /api { \
        limit_req zone=api burst=20 nodelay; \
        proxy_pass http://localhost:8001; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
        proxy_read_timeout 300s; \
        proxy_connect_timeout 75s; \
        proxy_buffering off; \
        proxy_request_buffering off; \
    } \
    \
    # Static files (images, documents) with rate limiting \
    location /static { \
        limit_req zone=static burst=50 nodelay; \
        proxy_pass http://localhost:8001; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
    } \
    \
    # Health check (no rate limiting) \
    location /health { \
        proxy_pass http://localhost:8001; \
        proxy_set_header Host $host; \
        access_log off; \
    } \
    \
    # Static file caching with security \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ { \
        root /app/static/frontend; \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
        add_header X-Content-Type-Options "nosniff" always; \
        access_log off; \
    } \
    \
    # Block access to sensitive files \
    location ~ /\. { \
        deny all; \
        access_log off; \
        log_not_found off; \
    } \
    \
    location ~ \.(env|git|htaccess|htpasswd|ini|log|sh|sql|conf)$ { \
        deny all; \
        access_log off; \
        log_not_found off; \
    } \
    \
    # Custom error pages \
    error_page 404 /404.html; \
    error_page 500 502 503 504 /50x.html; \
    \
    # Gzip compression \
    gzip on; \
    gzip_vary on; \
    gzip_min_length 1000; \
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json; \
}' > /etc/nginx/sites-available/default

# Create non-root user for security
RUN adduser --disabled-password --gecos '' appuser && \
    chown -R appuser:appuser /app && \
    chown -R appuser:appuser /var/log/nginx && \
    chown -R appuser:appuser /var/lib/nginx && \
    chown -R appuser:appuser /run

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Expose port
EXPOSE 80

# Start script to run both nginx and uvicorn
COPY <<EOF /app/start.sh
#!/bin/bash
set -e

# Start backend in background
echo "Starting FastAPI backend..."
uvicorn main:app --host 0.0.0.0 --port 8001 &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Waiting for backend to start..."
timeout=30
while [ $timeout -gt 0 ]; do
    if curl -f http://localhost:8001/health > /dev/null 2>&1; then
        echo "Backend is ready!"
        break
    fi
    sleep 1
    timeout=$((timeout - 1))
done

if [ $timeout -eq 0 ]; then
    echo "Backend failed to start within 30 seconds"
    exit 1
fi

# Start nginx in foreground
echo "Starting nginx..."
exec nginx -g "daemon off;"
EOF

RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]