# MonkeyOCR WebApp - 用户备忘录

## 重要命令

### 启动服务
在项目根目录运行：
```bash
python start.py
```
这会同时启动前端和后端服务。

### 单独启动服务
- **后端**：`cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8001`
- **前端**：`cd frontend && npm run dev`

## 认证系统更新 (2025-08-09)

### 主要变更
1. **简化的认证系统**
   - 单一 JWT token（24小时有效期）
   - 移除了 refresh token 机制
   - 无状态认证（不存储服务器端会话）

2. **安全增强**
   - JWT_SECRET_KEY 必须设置（已在 .env 中配置）
   - Redis 速率限制保护认证端点
   - 统一中间件处理认证、安全头和速率限制

3. **数据库简化**
   - 移除了 `user_sessions` 表
   - 移除了 `task_shares` 表  
   - `salt` 列保留但为空（bcrypt 内部处理）

### API 端点
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户
- `POST /api/auth/password` - 更改密码
- `GET /api/auth/validate` - 验证 token
- `PUT /api/auth/profile` - 更新用户资料

### 密码要求
- 最少 8 个字符
- 必须包含大小写字母
- 必须包含数字
- 不能有太多连续字符（如 123, abc）
- 建议格式：`P@ssw0rd2025Secure`

## 环境变量

关键环境变量（已在 .env 中配置）：
- `JWT_SECRET_KEY` - JWT 签名密钥
- `MONKEYOCR_API_KEY` - MonkeyOCR API 密钥
- `REDIS_ENABLED` - 启用 Redis 缓存
- `LLM_API_KEY` - LLM 翻译功能密钥

## 故障排除

### CORS 错误
如果遇到 CORS 错误，检查：
1. 前端运行在 `http://localhost:5173`
2. 后端运行在 `http://localhost:8001`
3. `.env` 中的 `CORS_ORIGINS` 包含前端地址

### 认证错误
- 500 错误：检查 JWT_SECRET_KEY 是否设置
- 401 错误：Token 过期或无效，需要重新登录
- 429 错误：速率限制，稍后重试

### 数据库问题
- 如果遇到 `salt` 列问题，运行迁移脚本：
  ```bash
  cd backend
  python migrations/simplify_auth_schema.py
  ```

## 开发注意事项

1. **密码验证**：后端密码验证比前端更严格
2. **Email 验证**：开发环境已禁用 deliverability 检查
3. **Token 有效期**：24 小时，无自动刷新
4. **中间件顺序**：CORS → 统一中间件 → 路由处理