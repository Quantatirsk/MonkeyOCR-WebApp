# Redis 集成指南

## 1. 启用 Redis 服务

编辑 `docker-compose.yml`，取消 Redis 相关行的注释：

```yaml
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data
    networks:
      - monkeyocr-network
    deploy:
      resources:
        limits:
          memory: 256M
        reservations:
          memory: 64M
```

## 2. 安装 Python Redis 客户端

在 `backend/requirements.txt` 添加：
```
redis>=5.0.0
```

## 3. 添加 Redis 配置

在 `backend/config.py` 添加：
```python
class RedisSettings(BaseSettings):
    redis_host: str = Field(default="redis", env="REDIS_HOST")
    redis_port: int = Field(default=6379, env="REDIS_PORT")
    redis_db: int = Field(default=0, env="REDIS_DB")
    redis_password: Optional[str] = Field(default=None, env="REDIS_PASSWORD")
    redis_url: Optional[str] = Field(default=None, env="REDIS_URL")
    
    @property
    def get_redis_url(self) -> str:
        if self.redis_url:
            return self.redis_url
        if self.redis_password:
            return f"redis://:{self.redis_password}@{self.redis_host}:{self.redis_port}/{self.redis_db}"
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"

redis_settings = RedisSettings()
```

## 4. 创建 Redis 客户端

创建 `backend/utils/redis_client.py`:
```python
import redis.asyncio as redis
from typing import Optional
from config import redis_settings
import logging

logger = logging.getLogger(__name__)

class RedisClient:
    _instance: Optional[redis.Redis] = None
    
    @classmethod
    async def get_client(cls) -> redis.Redis:
        if cls._instance is None:
            try:
                cls._instance = redis.from_url(
                    redis_settings.get_redis_url,
                    encoding="utf-8",
                    decode_responses=True
                )
                await cls._instance.ping()
                logger.info("Redis connection established")
            except Exception as e:
                logger.error(f"Failed to connect to Redis: {e}")
                raise
        return cls._instance
    
    @classmethod
    async def close(cls):
        if cls._instance:
            await cls._instance.close()
            cls._instance = None

# 缓存装饰器
def cache_key(*args, **kwargs):
    """生成缓存键"""
    return ":".join(map(str, args))

async def get_cached(key: str) -> Optional[str]:
    """获取缓存值"""
    try:
        client = await RedisClient.get_client()
        return await client.get(key)
    except Exception:
        return None

async def set_cache(key: str, value: str, ttl: int = 3600):
    """设置缓存值"""
    try:
        client = await RedisClient.get_client()
        await client.setex(key, ttl, value)
    except Exception:
        pass
```

## 5. 更新翻译 API 使用 Redis

修改 `backend/api/translation.py`:
```python
from utils.redis_client import get_cached, set_cache, cache_key

# 替换内存缓存
async def get_translation_from_cache(content: str, target_lang: str) -> Optional[str]:
    """从 Redis 获取翻译缓存"""
    key = cache_key("translation", content[:100], target_lang)
    return await get_cached(key)

async def save_translation_to_cache(content: str, target_lang: str, translation: str):
    """保存翻译到 Redis"""
    key = cache_key("translation", content[:100], target_lang)
    await set_cache(key, translation, ttl=86400)  # 缓存 24 小时
```

## 6. 添加健康检查

在 `backend/api/health.py` 添加 Redis 健康检查：
```python
from utils.redis_client import RedisClient

@router.get("/health/redis")
async def redis_health():
    try:
        client = await RedisClient.get_client()
        await client.ping()
        return {"status": "healthy", "service": "redis"}
    except Exception as e:
        return {"status": "unhealthy", "service": "redis", "error": str(e)}
```

## 7. 环境变量配置

在 `.env.development` 和 `.env.production` 添加：
```bash
# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0
# REDIS_PASSWORD=your-redis-password  # 生产环境建议设置密码
```

## 8. 使用场景

Redis 可用于：
- **翻译缓存**: 避免重复翻译相同内容
- **任务队列**: 存储处理任务状态
- **会话管理**: 用户会话数据
- **限流**: API 请求频率限制
- **临时文件**: 处理结果的临时存储

## 测试 Redis 连接

```bash
# 启动服务
docker-compose --env-file .env.development up

# 测试 Redis 连接
docker exec -it monkeyocr-webapp-redis-1 redis-cli ping
# 应返回: PONG

# 测试健康检查
curl http://localhost:8001/health/redis
```