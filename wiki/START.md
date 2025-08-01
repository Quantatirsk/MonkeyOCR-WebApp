# MonkeyOCR WebApp 启动指南

## 快速启动

使用项目根目录的启动脚本一键启动前后端服务：

```bash
python start.py
```

或者：

```bash
python3 start.py
```

## 启动脚本功能

✅ **自动依赖检查** - 检查Node.js、npm、Python环境
✅ **智能端口管理** - 自动检测端口占用并清理冲突进程  
✅ **依赖自动安装** - 自动安装前端npm依赖（如果不存在）
✅ **服务健康检查** - 等待服务启动完成再打开浏览器
✅ **优雅关闭** - Ctrl+C时自动清理所有进程

## 默认端口

- **前端**: http://localhost:5173
- **后端**: http://localhost:8001

## 手动启动（备选方案）

如果启动脚本有问题，可以手动启动：

### 1. 启动后端
```bash
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

### 2. 启动前端
```bash
cd frontend
npm install  # 首次运行需要
npm run dev
```

## 故障排除

### 端口被占用
启动脚本会自动处理端口占用问题。如果仍有问题，可以手动检查：

```bash
# macOS/Linux
lsof -ti tcp:5173
lsof -ti tcp:8001

# Windows
netstat -ano | findstr :5173
netstat -ano | findstr :8001
```

### 依赖问题
确保安装了必要的依赖：
- Node.js 16+ 和 npm
- Python 3.8+
- 后端Python依赖：`pip install -r backend/requirements.txt`

## 停止服务

在启动脚本运行的终端中按 `Ctrl+C`，脚本会自动清理所有启动的进程。