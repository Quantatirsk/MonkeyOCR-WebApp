#!/bin/bash

echo "=================================================="
echo "MonkeyOCR WebApp - 完整重置脚本"
echo "=================================================="
echo ""
echo "⚠️  警告：这将删除所有数据！"
echo "包括："
echo "  - 所有数据库数据"
echo "  - 所有上传的文件"
echo "  - 所有处理结果"
echo "  - Redis缓存（如果启用）"
echo ""
read -p "确定要继续吗？(yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ 操作已取消"
    exit 0
fi

echo ""
echo "1. 停止后端服务..."
# 尝试停止可能运行的后端服务
pkill -f "uvicorn main:app" 2>/dev/null || true
echo "   ✅ 后端服务已停止"

echo ""
echo "2. 清理后端数据..."
cd backend

# 删除SQLite数据库
rm -f monkeyocr.db monkeyocr.db-wal monkeyocr.db-shm 2>/dev/null
rm -f data/monkeyocr.db data/monkeyocr.db-wal data/monkeyocr.db-shm 2>/dev/null
rm -f data/tasks.json 2>/dev/null
echo "   ✅ 数据库已删除"

# 清理上传和结果文件
rm -rf uploads/* 2>/dev/null
rm -rf results/* 2>/dev/null
rm -rf static/* 2>/dev/null
rm -rf data/* 2>/dev/null
echo "   ✅ 文件已清理"

# 保持目录结构
mkdir -p uploads results static data 2>/dev/null

# 创建.gitkeep文件保持目录
touch uploads/.gitkeep results/.gitkeep static/.gitkeep data/.gitkeep 2>/dev/null

echo ""
echo "3. 清理Redis缓存..."
# 如果Redis运行，清理相关键
if command -v redis-cli &> /dev/null; then
    redis-cli --scan --pattern "ocr:*" | xargs -r redis-cli DEL 2>/dev/null
    redis-cli --scan --pattern "llm:*" | xargs -r redis-cli DEL 2>/dev/null
    redis-cli --scan --pattern "auth:*" | xargs -r redis-cli DEL 2>/dev/null
    redis-cli --scan --pattern "session:*" | xargs -r redis-cli DEL 2>/dev/null
    echo "   ✅ Redis缓存已清理"
else
    echo "   ℹ️  Redis未安装或未运行"
fi

echo ""
echo "4. 重新初始化数据库..."
python -c "
import asyncio
from database import init_database

async def init():
    await init_database()
    print('   ✅ 数据库已初始化')
    
asyncio.run(init())
" 2>/dev/null || echo "   ⚠️  数据库初始化需要在服务启动时完成"

cd ..

echo ""
echo "5. 清理前端缓存..."
cd frontend

# 清理node_modules缓存（可选）
# rm -rf node_modules/.cache 2>/dev/null

# 清理构建缓存
rm -rf dist 2>/dev/null
rm -rf .vite 2>/dev/null
echo "   ✅ 前端构建缓存已清理"

cd ..

echo ""
echo "=================================================="
echo "✅ 重置完成！"
echo "=================================================="
echo ""
echo "下一步操作："
echo "1. 启动后端服务："
echo "   cd backend"
echo "   python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001"
echo ""
echo "2. 启动前端服务："
echo "   cd frontend"
echo "   npm run dev"
echo ""
echo "3. 在浏览器中："
echo "   a. 访问 http://localhost:5173/clear-cache.html"
echo "   b. 点击「清理所有缓存」"
echo "   c. 返回主页面"
echo ""
echo "或者在浏览器控制台执行："
echo "   localStorage.clear();"
echo "   sessionStorage.clear();"
echo "   location.reload();"
echo "=================================================="