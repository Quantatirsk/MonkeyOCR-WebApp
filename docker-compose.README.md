# Docker Compose 配置说明

## 使用方法

现在项目使用单一的 `docker-compose.yml` 文件，通过环境变量控制不同环境的配置。

### 开发环境

```bash
# 方法 1: 使用 env 文件
docker-compose --env-file .env.development up

# 方法 2: 复制 env 文件
cp .env.development .env
docker-compose up
```

### 生产环境

```bash
# 方法 1: 使用 env 文件
docker-compose --env-file .env.production up -d

# 方法 2: 复制并编辑 env 文件
cp .env.production .env
# 编辑 .env 文件，设置实际的 API keys
docker-compose up -d
```

## 环境变量说明

| 变量名 | 开发环境 | 生产环境 | 说明 |
|-------|---------|---------|------|
| BUILD_TARGET | backend-build | production | Docker 构建目标 |
| FRONTEND_PORT | 5173 | 3000 | 前端访问端口 |
| BACKEND_PORT | 8001 | - | 后端直接访问端口（仅开发） |
| DEBUG | true | false | 调试模式 |
| RELOAD | true | false | 自动重载 |
| LOG_LEVEL | DEBUG | INFO | 日志级别 |
| RESTART_POLICY | unless-stopped | always | 重启策略 |

## 迁移说明

如果你之前使用多个 docker-compose 文件：

### 之前的方式
```bash
# 开发
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# 生产
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up
```

### 现在的方式
```bash
# 开发
docker-compose --env-file .env.development up

# 生产
docker-compose --env-file .env.production up
```

## 清理旧文件

确认新配置工作正常后，可以删除旧的覆盖文件：
```bash
rm docker-compose.dev.yml
rm docker-compose.prod.yml
```

## 自定义配置

如需自定义配置，复制对应的 env 文件并修改：
```bash
cp .env.production .env.custom
# 编辑 .env.custom
docker-compose --env-file .env.custom up
```