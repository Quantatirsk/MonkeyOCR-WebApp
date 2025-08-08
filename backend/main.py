"""
FastAPI backend entry point for MonkeyOCR WebApp
"""
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from middleware import add_security_middleware

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    应用程序生命周期管理
    处理启动时的数据恢复和关闭时的清理
    """
    # 启动时初始化
    logger.info("Starting MonkeyOCR WebApp backend...")
    
    # 初始化 Redis 连接（如果启用）
    if os.getenv("REDIS_ENABLED", "False").lower() == "true":
        from utils.redis_client import RedisClient
        redis_connected = await RedisClient.initialize()
        if redis_connected:
            logger.info("Redis connection initialized successfully")
        else:
            logger.warning("Redis connection failed, using fallback storage")
    
    # 初始化持久化管理器并恢复任务状态
    from utils.persistence import init_persistence
    persistence_manager = init_persistence()
    
    # 获取任务统计信息
    stats = persistence_manager.get_task_stats()
    logger.info(f"Loaded tasks: {stats}")
    
    # 恢复处理中的任务监控
    processing_tasks = persistence_manager.get_processing_tasks()
    if processing_tasks:
        logger.info(
            f"Found {len(processing_tasks)} processing tasks, checking status..."
        )
        
        # 对于处理中的任务，我们需要重新检查它们的状态
        # 在实际应用中，这里可能需要重新启动监控或检查外部API状态
        for task in processing_tasks:
            logger.info(f"Processing task found: {task.id} - {task.filename}")
            # 这里可以添加重新启动任务监控的逻辑
    
    # 验证数据完整性
    validation_result = persistence_manager.validate_data()
    if not validation_result['valid']:
        logger.warning(
            f"Data validation issues found: {validation_result['errors']}"
        )
    else:
        logger.info("Data validation passed")
    
    logger.info("Backend startup completed")
    
    yield  # 应用程序运行期间
    
    # 关闭时清理
    logger.info("Shutting down MonkeyOCR WebApp backend...")
    
    # 强制保存任何未保存的数据 - 使用全局实例
    from utils.persistence import get_persistence_manager
    global_persistence_manager = get_persistence_manager()
    
    # 只在有数据时才保存，避免保存空缓存
    stats = global_persistence_manager.get_task_stats()
    if stats['total'] > 0:
        global_persistence_manager.force_save()
        logger.info(
            f"Final data save completed - saved {stats['total']} tasks"
        )
    else:
        logger.info("No tasks to save on shutdown")
    
    # 关闭 Redis 连接（如果启用）
    if os.getenv("REDIS_ENABLED", "False").lower() == "true":
        from utils.redis_client import RedisClient
        await RedisClient.close()
        logger.info("Redis connection closed")
    
    logger.info("Backend shutdown completed")

app = FastAPI(
    title="MonkeyOCR WebApp API",
    description="OCR content extraction and visualization API",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS middleware with environment-based origins
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
logger.info(f"CORS origins configured: {cors_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],  # Specific methods only
    allow_headers=[
        "Accept",
        "Accept-Language", 
        "Content-Language",
        "Content-Type",
        "Authorization"
    ],
)

# Add security middleware
add_security_middleware(app)

# Static file serving for extracted images with CORS support
from fastapi.staticfiles import StaticFiles
from starlette.types import Scope, Receive, Send

class StaticFilesWithCORS(StaticFiles):
    """Custom StaticFiles class that adds CORS headers"""
    
    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """
        The ASGI application interface.
        """
        # Handle the request normally first
        if scope["type"] == "http" and scope["path"].startswith("/static"):
            # Create a wrapper for send to inject CORS headers
            async def send_wrapper(message):
                if message["type"] == "http.response.start":
                    headers = list(message.get("headers", []))
                    # Add CORS headers
                    headers.append((b"access-control-allow-origin", b"*"))
                    headers.append((b"access-control-allow-methods", b"GET, OPTIONS"))
                    headers.append((b"access-control-allow-headers", b"Accept, Content-Type"))
                    message["headers"] = headers
                await send(message)
            
            await super().__call__(scope, receive, send_wrapper)
        else:
            await super().__call__(scope, receive, send)

static_dir = os.path.join(os.path.dirname(__file__), "static")
if not os.path.exists(static_dir):
    print(f"Creating static directory at {static_dir}")
    os.makedirs(static_dir, exist_ok=True)

app.mount("/static", StaticFilesWithCORS(directory=static_dir), name="static")

# Basic API routes
@app.get("/")
async def root():
    return {"message": "MonkeyOCR WebApp API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    """Basic health check"""
    health_status = {
        "status": "healthy",
        "services": {}
    }
    
    # Check Redis if enabled
    if os.getenv("REDIS_ENABLED", "False").lower() == "true":
        from utils.redis_client import RedisClient
        try:
            client = await RedisClient.get_client()
            if client:
                await client.ping()
                health_status["services"]["redis"] = "healthy"
            else:
                health_status["services"]["redis"] = "disconnected"
        except Exception as e:
            health_status["services"]["redis"] = f"error: {str(e)}"
            health_status["status"] = "degraded"
    
    return health_status

# Include API routes
from api.results import router as results_router
from api.sync import router as sync_router
from api.upload import router as upload_router
from api.llm import router as llm_router

app.include_router(upload_router)
app.include_router(results_router)
app.include_router(sync_router)
app.include_router(llm_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=True)