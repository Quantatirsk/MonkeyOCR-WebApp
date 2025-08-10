# 缓存优化方案

## 现状分析

### 值得保留的缓存
| 缓存类型 | 必要性 | 原因 | 建议 |
|---------|-------|------|------|
| OCR 结果 | ⭐⭐⭐⭐⭐ | 节省 API 费用，提升性能 | 保留，延长 TTL |
| LLM 翻译 | ⭐⭐⭐⭐⭐ | 节省 API 费用，提升性能 | 保留，延长 TTL |

### 建议移除的缓存
| 缓存类型 | 必要性 | 问题 | 替代方案 |
|---------|-------|------|---------|
| 任务存储 | ⭐ | 与 SQLite 重复 | 直接使用数据库 |
| 速率限制 | ⭐⭐ | Redis 依赖过重 | 内存或 nginx 限流 |

## 优化实施方案

### 第一步：优化高价值缓存

```python
# 1. 延长 OCR 缓存时间
class OCRCache:
    def __init__(self, ttl: int = 86400 * 30):  # 30 天
        self.ttl = ttl
        # 可以基于文件大小动态调整
        # 大文件（>10MB）缓存更久

# 2. 延长 LLM 缓存时间
class LLMCache:
    def __init__(self, ttl: int = 86400):  # 24 小时
        self.ttl = ttl
        # 翻译结果稳定，可以缓存更久
```

### 第二步：移除冗余缓存

```python
# 1. 移除 TaskStorage Redis 缓存
# 直接使用 SQLite，它已经够快了

# 2. 速率限制改为内存实现
from collections import deque
from time import time

class InMemoryRateLimiter:
    """简单的内存速率限制器"""
    
    def __init__(self):
        self._windows = {}
    
    def is_allowed(self, key: str, limit: int, window: int) -> bool:
        now = time()
        if key not in self._windows:
            self._windows[key] = deque()
        
        # 移除过期的请求
        window_start = now - window
        while self._windows[key] and self._windows[key][0] < window_start:
            self._windows[key].popleft()
        
        # 检查是否超限
        if len(self._windows[key]) < limit:
            self._windows[key].append(now)
            return True
        return False
```

### 第三步：添加缓存预热和管理

```python
# 1. 缓存预热（可选）
async def warm_cache_for_user(user_id: int):
    """用户登录时预热最近使用的文件缓存"""
    recent_tasks = await get_recent_tasks(user_id, limit=5)
    # 预加载到 Redis，减少首次访问延迟

# 2. 缓存统计和清理
async def get_cache_stats():
    """获取缓存使用统计"""
    return {
        "ocr_cache_count": await redis.dbsize("ocr:*"),
        "llm_cache_count": await redis.dbsize("llm:*"),
        "total_memory": await redis.info("memory"),
        "hit_rate": calculate_hit_rate()
    }

async def cleanup_old_cache(days: int = 30):
    """清理超过指定天数的缓存"""
    # 定期清理任务
```

## 性能影响评估

### 保留缓存的收益
- **OCR 缓存**：每次命中节省 2-10 秒处理时间 + API 费用
- **LLM 缓存**：每次命中节省 1-5 秒处理时间 + API 费用

### 移除缓存的影响
- **任务缓存**：SQLite 查询 <10ms，无明显影响
- **速率限制**：内存实现更简单，单机够用

## 实施优先级

1. **立即执行**：延长 OCR 和 LLM 缓存 TTL
2. **短期**：移除任务存储的 Redis 缓存
3. **中期**：重构速率限制为内存/nginx 实现
4. **长期**：添加缓存预热和智能管理

## 监控指标

```python
# 需要监控的关键指标
metrics = {
    "cache_hit_rate": "缓存命中率 (目标 >80%)",
    "api_cost_saved": "节省的 API 调用费用",
    "response_time_p95": "95 分位响应时间",
    "redis_memory_usage": "Redis 内存使用率",
    "cache_eviction_rate": "缓存淘汰率"
}
```

## 配置建议

```env
# 优化后的缓存配置
OCR_CACHE_TTL=2592000      # 30 天
LLM_CACHE_TTL=86400        # 24 小时
REDIS_MAXMEMORY=512mb      # 增加内存
REDIS_MAXMEMORY_POLICY=allkeys-lru  # LRU 淘汰策略

# 移除不必要的配置
# TASK_CACHE_TTL=86400     # 删除
# RATE_LIMIT_REDIS=true    # 改为 false
```