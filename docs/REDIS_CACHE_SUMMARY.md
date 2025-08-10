# Redis 缓存使用总结

## 系统中使用的缓存类型

### 1. OCR 结果缓存 (`ocr:*`)

**用途**: 缓存 MonkeyOCR API 的处理结果，避免重复处理相同文件

**缓存键格式**: 
```
ocr:{extract_type}:{split_pages}:{file_hash}
```

**示例**: 
```
ocr:standard:False:7a6792503a604e9b
```

**缓存策略**:
- **TTL**: 7 天 (604,800 秒)
- **键生成**: 基于文件内容 + 提取类型 + 是否分页的 SHA256 哈希值（前16位）
- **存储内容**: 完整的 OCR 处理结果，包括：
  - 下载 URL
  - 处理消息
  - 输出文件列表
  - 本地结果路径
  - 元数据

**位置**: `backend/utils/ocr_cache.py`

---

### 2. LLM 翻译缓存 (`llm:*`)

**用途**: 缓存 LLM API 的翻译响应，减少 API 调用和费用

**缓存键格式**:
```
llm:{model}:{request_hash}
```

**示例**:
```
llm:gpt-4o-mini:a3f4b2c1d5e6f7g8
```

**缓存策略**:
- **TTL**: 1 小时 (3,600 秒)，可通过环境变量 `TRANSLATION_CACHE_TTL` 配置
- **键生成**: 基于以下参数的 SHA256 哈希值（前16位）：
  - messages（对话内容）
  - model（模型名称）
  - temperature
  - max_tokens
  - top_p
- **存储内容**: 完整的 LLM 响应，包括生成的文本和元数据

**位置**: `backend/utils/llm_cache.py`

---

### 3. 速率限制缓存 (`rate:*`)

**用途**: 限制 API 调用频率，防止滥用

**缓存键格式**:
```
rate:{identifier}:{action}:{time_window}
```

**示例**:
```
rate:ip:127.0.0.1:/api/upload:29245446
rate:user:4:/api/auth/login:29245446
```

**缓存策略**:
- **TTL**: 60 秒 + 10 秒缓冲
- **键生成**: 
  - identifier: `ip:{IP地址}` 或 `user:{用户ID}`
  - action: API 端点路径
  - time_window: 当前时间窗口（Unix时间戳 / 窗口秒数）
- **存储内容**: 请求计数器（自增整数）

**限制配置**:
```python
LIMITS = {
    "/api/auth/login": {"limit": 5, "window": 60},      # 登录：每分钟5次
    "/api/auth/register": {"limit": 3, "window": 60},   # 注册：每分钟3次
    "/api/upload": {"limit": 10, "window": 60},         # 上传：每分钟10次
    "default": {"limit": 60, "window": 60}              # 默认：每分钟60次
}
```

**位置**: 
- `backend/utils/rate_limiter.py`
- `backend/middleware/rate_limit.py`

---

### 4. 任务临时存储 (`task:*`)

**用途**: 在 Redis 可用时，临时存储任务数据（主要数据仍存储在 SQLite）

**缓存键格式**:
```
task:{task_id}
```

**示例**:
```
task:e86bde79-1a27-4445-ac2e-e9289cc7a978
```

**缓存策略**:
- **TTL**: 24 小时 (86,400 秒)
- **存储内容**: 任务元数据，包括：
  - 任务状态
  - 进度百分比
  - 处理结果
  - 错误信息
- **注意**: 这是辅助存储，主要数据在 SQLite 数据库中

**位置**: 
- `backend/utils/redis_client.py` (TaskStorage 类)
- `backend/utils/redis_persistence.py`

---

## 缓存配置

### 环境变量配置 (.env)

```env
# Redis 基础配置
REDIS_ENABLED=true          # 是否启用 Redis
REDIS_HOST=localhost        # Redis 服务器地址
REDIS_PORT=6379            # Redis 端口
REDIS_DB=0                 # Redis 数据库编号
REDIS_PASSWORD=            # Redis 密码（可选）

# 缓存 TTL 配置
TRANSLATION_CACHE_TTL=3600  # LLM 翻译缓存时间（秒）
```

### 查看缓存数据

```bash
# 查看所有缓存键
redis-cli keys "*"

# 查看特定类型的缓存
redis-cli keys "ocr:*"      # OCR 缓存
redis-cli keys "llm:*"      # LLM 缓存
redis-cli keys "rate:*"     # 速率限制
redis-cli keys "task:*"     # 任务缓存

# 查看缓存内容
redis-cli get "ocr:standard:False:7a6792503a604e9b"

# 查看缓存 TTL
redis-cli ttl "ocr:standard:False:7a6792503a604e9b"

# 查看数据库统计
redis-cli INFO keyspace

# 清除特定类型缓存
redis-cli --scan --pattern "rate:*" | xargs redis-cli del

# 清空整个数据库（谨慎使用）
redis-cli FLUSHDB
```

---

## 缓存回退机制

当 Redis 不可用时，系统会自动回退到：

1. **OCR 缓存**: 不缓存，每次都调用 MonkeyOCR API
2. **LLM 缓存**: 不缓存，每次都调用 LLM API
3. **速率限制**: 不限制（允许所有请求）
4. **任务存储**: 使用纯 SQLite 数据库存储

---

## 性能优化建议

1. **OCR 缓存**：7天的 TTL 对于文档处理是合理的，可以根据使用模式调整
2. **LLM 缓存**：1小时可能太短，对于稳定的翻译请求可以增加到 24 小时
3. **速率限制**：当前限制较为宽松，生产环境建议调严
4. **内存管理**：定期监控 Redis 内存使用，必要时使用 LRU 淘汰策略

```bash
# 配置 Redis 最大内存和淘汰策略
redis-cli CONFIG SET maxmemory 256mb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```