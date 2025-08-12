# MonkeyOCR WebApp

一个功能强大的全栈 Web 应用，用于 OCR 内容提取、可视化和智能翻译，支持 PDF 和图片文件的实时处理。

## ✨ 主要功能

### 📁 文件处理
- **拖拽上传**：支持 PDF、JPG、PNG、WEBP 格式文件
- **批量处理**：同时处理多个文件
- **实时进度**：实时显示处理状态和进度
- **智能缓存**：自动缓存处理结果，相同文件秒速返回

### 🔍 OCR 识别
- **MonkeyOCR API 集成**：高精度文字识别
- **多内容类型支持**：文本、标题、表格、图片、公式
- **区块级识别**：精确定位每个内容块的位置和类型
- **页面级处理**：支持多页 PDF 文档

### 🌐 智能翻译
- **双引擎支持**：
  - **机器翻译 (MT)**：快速批量翻译，支持中英互译
  - **AI 翻译 (LLM)**：智能上下文理解，支持多语言
- **并行处理**：最多 10 个并发翻译任务
- **智能重试**：自动重试失败的翻译
- **内联显示**：译文直接显示在原文下方

### 📄 内容展示
- **Markdown 渲染**：富文本显示，支持表格、图片、公式
- **区块高亮**：鼠标悬停高亮显示对应区块
- **同步滚动**：PDF 和 Markdown 视图同步滚动
- **对照模式**：原文译文并排对比显示

### 💾 导出功能
- **下载结果**：导出处理后的 Markdown 和图片
- **复制功能**：一键复制翻译内容
- **批量导出**：支持批量下载所有处理结果

## 🛠 技术栈

### 前端
- **React 18** + **TypeScript** - 现代化前端框架
- **Vite** - 快速构建工具
- **TailwindCSS** + **shadcn/ui** - 精美 UI 设计
- **Zustand** - 状态管理
- **react-markdown** - Markdown 渲染
- **KaTeX** - 数学公式渲染

### 后端
- **FastAPI** (Python 3.12+) - 高性能异步框架
- **SQLite** - 任务和用户数据持久化
- **Redis** - 高速缓存（可选）
- **JWT** - 安全认证
- **httpx** - 异步 HTTP 客户端

### 外部服务
- **MonkeyOCR API** - OCR 识别服务
- **OpenAI 兼容 API** - LLM 翻译服务（支持 Ollama、LM Studio）

## 🚀 快速开始

### 环境要求
- Node.js 18+
- Python 3.12+
- Redis（可选，用于缓存）

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/yourusername/MonkeyOCR-WebApp.git
cd MonkeyOCR-WebApp
```

2. **配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 文件，填入必要的 API 密钥
```

必需配置：
- `MONKEYOCR_API_KEY` - MonkeyOCR API 密钥
- `JWT_SECRET_KEY` - JWT 加密密钥（使用 `python -c 'import secrets; print(secrets.token_urlsafe(32))'` 生成）

可选配置：
- `LLM_BASE_URL` - LLM API 地址
- `LLM_API_KEY` - LLM API 密钥
- `REDIS_HOST` - Redis 服务器地址

3. **一键启动**
```bash
python start.py
```
这将自动安装依赖并启动前后端服务。

### 手动启动

**前端开发**
```bash
cd frontend
npm install
npm run dev   # 启动开发服务器 (http://localhost:5173)
```

**后端开发**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

### Docker 部署
```bash
docker-compose up --build
```

## 📖 使用指南

### 1. 登录系统
默认提供演示账户：
- 用户名：`demo`
- 密码：`demo123456`

### 2. 上传文件
- 点击上传区域或拖拽文件到上传区
- 支持格式：PDF、JPG、PNG、WEBP
- 最大文件大小：50MB

### 3. 查看结果
- **内容标签页**：查看识别的原始内容
- **对照标签页**：PDF 和 Markdown 并排显示，支持同步滚动
- **翻译标签页**：查看翻译结果，支持内联显示

### 4. 翻译功能
- **快速翻译**：选择区块，按 N 键翻译
- **批量翻译**：点击"翻译全部"按钮
- **引擎切换**：在用户设置中切换 MT/LLM 引擎

### 5. 导出结果
- **复制**：选中区块后点击复制按钮
- **下载**：点击下载按钮保存 Markdown 文件

## ⚙️ 高级配置

### 翻译引擎配置

**机器翻译 (MT)**
- 速度快，适合批量处理
- 仅支持中英文互译
- 遇到表格或图片自动切换到 AI 翻译

**AI 翻译 (LLM)**
- 支持所有语言
- 理解上下文，翻译质量高
- 可处理表格、图片等复杂内容

### Redis 缓存配置
```bash
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
OCR_CACHE_TTL=2592000  # 30天
LLM_CACHE_TTL=86400    # 24小时
```

### 速率限制
- 登录：50 次/分钟（每 IP）
- 上传：100 次/分钟（每用户）
- 默认：600 次/分钟（每用户）

## 🏗 项目结构

```
MonkeyOCR-WebApp/
├── frontend/          # React 前端应用
│   ├── src/
│   │   ├── components/   # React 组件
│   │   ├── store/       # Zustand 状态管理
│   │   ├── utils/       # 工具函数
│   │   └── types/       # TypeScript 类型定义
│   └── package.json
│
├── backend/           # FastAPI 后端服务
│   ├── api/            # API 路由
│   ├── utils/          # 工具模块
│   ├── data/           # SQLite 数据库
│   └── requirements.txt
│
├── static/            # 静态文件服务
├── results/           # 处理结果存储
├── docker-compose.yml # Docker 配置
├── start.py          # 一键启动脚本
└── CLAUDE.md         # 开发者指南
```

## 🔧 开发指南

### 数据库管理
```bash
# 重置数据库
python backend/reset_database.py

# 检查任务数据
python backend/check_task_db.py

# 手动查询
sqlite3 backend/data/monkeyocr.db
```

### 调试技巧
```bash
# 监控 Redis
redis-cli monitor

# 查看缓存键
redis-cli --scan --pattern "ocr:*"

# 清空缓存
redis-cli FLUSHDB
```

### 性能优化
- **SQLite**：使用 WAL 模式，优化索引
- **Redis 缓存**：90% 命中率
- **静态文件**：直接服务，无需数据库
- **并发处理**：支持多任务并行

## 📝 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 📞 联系支持

- 提交 Issue：[GitHub Issues](https://github.com/yourusername/MonkeyOCR-WebApp/issues)
- 邮件联系：your.email@example.com

## 🙏 致谢

- [MonkeyOCR](https://ocr.teea.cn) - 提供 OCR 识别服务
- [shadcn/ui](https://ui.shadcn.com) - 精美的 UI 组件库
- [FastAPI](https://fastapi.tiangolo.com) - 高性能 Python Web 框架

---

**注意**：本项目仅供学习和研究使用，请遵守相关服务的使用条款。