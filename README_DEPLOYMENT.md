# MonkeyOCR WebApp - Deployment Guide

## 🐳 Docker Deployment

This project includes optimized Docker configuration for easy deployment with security best practices.

### 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd MonkeyOCR-WebApp
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

3. **Deploy with Docker Compose**
   ```bash
   # Development
   docker-compose up --build
   
   # Production
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - API Health Check: http://localhost:3000/health

### 📋 Environment Configuration

Copy `.env.example` to `.env` and configure the following variables:

```bash
# Required
CORS_ORIGINS=http://localhost:3000,https://your-domain.com
MONKEYOCR_API_KEY=your_api_key_here

# Optional (for translation features)
LLM_API_KEY=your_openai_key_here
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL_NAME=gpt-4o-mini

# Application settings
DEBUG=false
LOG_LEVEL=INFO
```

### 🏗️ Architecture

- **Single Image Deployment**: Frontend (React + Vite) and Backend (FastAPI) in one container
- **Multi-stage Build**: Optimized for size and security
- **Nginx Reverse Proxy**: Handles static files and API routing
- **Security Middleware**: Rate limiting, security headers, CORS protection

### 🔒 Security Features

#### ✅ Implemented Security Measures

- **CORS Protection**: Environment-configurable origins (no wildcards)
- **Security Headers**: X-Frame-Options, X-Content-Type-Options, CSP, etc.
- **Rate Limiting**: API (10 req/s) and Static files (30 req/s) protection
- **Non-root User**: Container runs with dedicated user account
- **Input Validation**: Pydantic models for all API endpoints
- **File Access Control**: Blocked access to sensitive files (.env, .git, etc.)
- **Resource Limits**: CPU and memory constraints in Docker Compose

#### 🛡️ Security Headers

The application automatically adds the following security headers:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; ...
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

#### 🚦 Rate Limiting

- **API Endpoints**: 10 requests/second per IP with burst of 20
- **Static Files**: 30 requests/second per IP with burst of 50
- **Application Level**: 100 requests/minute per IP (configurable)

### 🛠️ Development

For development with hot reload:

```bash
# Development mode
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Or run components separately
cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8001
cd frontend && npm run dev
```

### 📊 Monitoring & Health Checks

- **Health Endpoint**: `/health` - Application health status
- **Container Health Checks**: Built-in Docker health monitoring
- **Logging**: Structured logging with configurable levels
- **Resource Monitoring**: CPU/Memory limits with restart policies

### 🔧 Customization

#### Nginx Configuration

To customize nginx settings, modify the configuration in `Dockerfile`:

```bash
# Edit nginx config in Dockerfile
# Rebuild with: docker-compose build --no-cache
```

#### Security Settings

Security middleware can be configured in `backend/middleware.py`:

```python
# Rate limiting
RateLimitMiddleware(calls=100, period=60)

# Security headers
SecurityHeadersMiddleware()
```

### 🚨 Production Checklist

- [ ] Set `DEBUG=false` in production
- [ ] Configure proper CORS origins (no `localhost`)
- [ ] Set strong API keys
- [ ] Configure reverse proxy (nginx/Apache) if needed
- [ ] Set up SSL/TLS certificates
- [ ] Configure log rotation
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Regular security updates

### 📝 Deployment Commands

```bash
# Build and start
docker-compose up --build -d

# View logs
docker-compose logs -f

# Scale services (if needed)
docker-compose up --scale monkeyocr-webapp=2

# Update and restart
docker-compose pull
docker-compose up -d --force-recreate

# Cleanup
docker-compose down
docker system prune -a
```

### 🆘 Troubleshooting

#### Common Issues

1. **CORS Errors**: Check `CORS_ORIGINS` environment variable
2. **API Key Issues**: Verify `MONKEYOCR_API_KEY` and `LLM_API_KEY`
3. **Port Conflicts**: Change port mapping in `docker-compose.yml`
4. **Permission Issues**: Check volume mount permissions

#### Debug Commands

```bash
# Check container logs
docker-compose logs monkeyocr-webapp

# Access container shell
docker-compose exec monkeyocr-webapp bash

# Check nginx config
docker-compose exec monkeyocr-webapp nginx -t

# Monitor resource usage
docker stats
```

### 📚 Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [Nginx Security Guide](https://nginx.org/en/docs/)
- [MonkeyOCR API Documentation](https://ocr.teea.cn/docs)