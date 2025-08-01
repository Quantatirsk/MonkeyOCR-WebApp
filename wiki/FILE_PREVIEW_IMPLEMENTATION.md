# 文件预览功能实现总结

## 功能概述

为 MonkeyOCR WebApp 添加了原始文件（PDF/图片）预览功能，在用户等待OCR处理完成时也能查看原始文件内容。

## 主要改动

### 1. 新增依赖
- 安装了 `react-pdf@10.0.1` 用于PDF预览

### 2. 类型定义扩展 (`frontend/src/types/index.ts`)
- 在 `ProcessingTask` 接口中新增了：
  - `original_file?: File` - 存储原始文件对象
  - `original_file_url?: string` - 存储文件预览URL
- 在 `AppActions` 接口中新增了 `clearTasks()` 方法

### 3. 新建组件 (`frontend/src/components/FilePreview.tsx`)
一个完整的文件预览组件，支持：

#### PDF预览功能：
- 页面导航（上一页/下一页）
- 缩放控制（放大/缩小/重置）
- 旋转功能
- 页码显示
- 加载状态提示

#### 图片预览功能：
- 缩放控制
- 旋转功能
- 错误处理

#### 通用功能：
- 响应式设计
- 错误处理和加载状态
- 无障碍设计（aria标签和键盘支持）

### 4. 更新文档查看器 (`frontend/src/components/DocumentViewer.tsx`)

#### Tab结构调整：
- 新增"预览"Tab作为第一个标签页
- 原有Tab（内容/图片/详情）在没有OCR结果时显示为禁用状态
- 默认打开预览Tab

#### 功能改进：
- 支持任务选择时立即预览（无需等待OCR完成）
- 更新了状态逻辑，区分了 `currentTask` 和 `currentResult`
- 改进了错误提示信息

### 5. 状态管理更新 (`frontend/src/store/appStore.ts`)

#### 文件上传时存储原始文件：
```typescript
const serverTask: ProcessingTask = {
  ...response.data,
  original_file: file, // 存储原始文件
  original_file_url: URL.createObjectURL(file) // 创建预览URL
};
```

#### 内存管理：
- 在删除任务时自动清理Object URLs防止内存泄漏
- 新增 `clearTasks()` 方法批量清理所有URLs

### 6. 修复的编译错误
- 移除了未使用的导入
- 修复了TypeScript类型错误
- 解决了重复导出问题

## 用户体验改进

1. **即时预览**：用户上传文件后立即可以预览原始文件，无需等待OCR处理
2. **直观导航**：Tab界面清晰，预览Tab在第一位，处理状态一目了然
3. **功能完整**：PDF和图片都有完整的查看功能（缩放、旋转、翻页等）
4. **响应式设计**：支持不同屏幕尺寸
5. **错误处理**：友好的错误提示和加载状态

## 技术特点

- **内存安全**：正确管理Object URLs避免内存泄漏
- **类型安全**：完整的TypeScript类型定义
- **组件化**：可复用的预览组件设计
- **性能优化**：延迟加载和缓存机制
- **无障碍**：支持键盘操作和屏幕阅读器
- **CORS兼容**：通过本地PDF.js worker避免跨域问题

## CORS问题修复

### 问题描述
原始实现中PDF.js worker从CDN加载时出现CORS错误：
```
Access to script at 'https://unpkg.com/pdfjs-dist@5.3.31/build/pdf.worker.min.js' from origin 'http://localhost:5173' has been blocked by CORS policy
```

### 解决方案
1. **安装vite-plugin-static-copy插件**：`npm install --save-dev vite-plugin-static-copy`

2. **更新Vite配置** (`vite.config.ts`)：
   ```typescript
   import { viteStaticCopy } from 'vite-plugin-static-copy'
   
   plugins: [
     react(),
     viteStaticCopy({
       targets: [
         {
           src: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
           dest: '',
           rename: 'pdf.worker.min.js'
         }
       ]
     })
   ]
   ```

3. **更新worker配置** (`FilePreview.tsx`)：
   ```typescript
   // 使用本地worker文件，避免CORS问题
   pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
   ```

### 效果
- ✅ PDF.js worker从本地加载，完全避免CORS问题
- ✅ 构建时自动复制worker文件到dist目录
- ✅ 开发和生产环境都能正常工作

## TextLayer样式修复

### 问题描述
react-pdf组件会显示警告：
```
Warning: TextLayer styles not found. Read more: https://github.com/wojtekmaj/react-pdf#support-for-text-layer
```

### 解决方案
在 `FilePreview.tsx` 中导入必要的CSS样式：

```typescript
// 导入react-pdf样式以修复TextLayer警告
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
```

### 效果
- ✅ 消除TextLayer样式警告
- ✅ 支持PDF文本层渲染和选择
- ✅ 支持PDF注释层显示
- ✅ 改善PDF显示质量

## 自定义标签处理

### 问题描述
OCR处理后的Markdown内容可能包含自定义XML标签（如`<facts>`、`<summary>`等），导致React警告：
```
Warning: The tag <facts> is unrecognized in this browser. If you meant to render a React component, start its name with an uppercase letter.
```

### 解决方案

1. **标签转换** (`ModernMarkdownViewer.tsx`)：
   ```typescript
   // 将自定义标签转换为标准HTML div元素
   processed = processed.replace(/<([a-zA-Z][a-zA-Z0-9]*?)([^>]*)>/g, (match, tagName, attributes) => {
     const htmlTags = ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'b', 'i', 'u', 'a', 'img', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'code', 'pre', 'blockquote', 'br', 'hr'];
     
     if (htmlTags.includes(tagName.toLowerCase())) {
       return match; // 保留标准HTML标签
     }
     
     // 转换自定义标签为div，保留原标签名作为data属性
     return `<div data-custom-tag="${tagName}"${attributes}>`;
   });
   ```

2. **样式定义** (`markdown-styles.css`)：
   ```css
   [data-custom-tag] {
     padding: 0.25rem 0.5rem;
     margin: 0.125rem 0;
     border: 1px solid hsl(var(--border));
     border-radius: 0.25rem;
     background-color: hsl(var(--muted) / 0.3);
     display: inline-block;
     position: relative;
   }
   
   [data-custom-tag]:before {
     content: attr(data-custom-tag);
     position: absolute;
     top: -0.5rem;
     left: 0.25rem;
     background-color: hsl(var(--background));
     padding: 0 0.25rem;
     font-size: 0.75rem;
     color: hsl(var(--muted-foreground));
   }
   ```

### 效果
- ✅ 消除React自定义标签警告
- ✅ 保持原始内容结构和语义
- ✅ 提供视觉区分的样式显示
- ✅ 支持主题切换和响应式设计
- ✅ 特殊标签（facts、summary、conclusion）有不同颜色

## 连续滚动PDF预览

### 功能描述
PDF预览采用连续滚动模式，显示所有页面，支持自然的上下滚动浏览，配合多种缩放方式。

### 实现功能

1. **连续滚动浏览**：
   - 所有PDF页面垂直排列显示
   - 自然的上下滚动浏览
   - 每页显示页码标识

2. **多种缩放方式**：
   - **鼠标滚轮**：Ctrl/Cmd + 滚轮缩放
   - **Mac触控板**：双指手势缩放
   - **按钮控制**：点击缩放按钮
   - **缩放范围**：30% - 300%

3. **图片预览缩放**：
   - Ctrl/Cmd + 滚轮缩放
   - 双指手势缩放
   - 旋转功能

### 技术实现

**连续滚动渲染**：
```typescript
// 渲染所有页面
{allPages.map((pageNum) => (
  <div key={pageNum} className="relative">
    <div className="absolute top-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
      第 {pageNum} 页
    </div>
    <Page
      pageNumber={pageNum}
      scale={scale}
      rotate={rotation}
      className="shadow-lg mb-4"
    />
  </div>
))}
```

**触控板双指缩放**：
```typescript
const handleTouchMove = (e: TouchEvent) => {
  if (e.touches.length === 2) {
    e.preventDefault();
    
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    const currentDistance = Math.hypot(
      touch1.clientX - touch2.clientX,
      touch1.clientY - touch2.clientY
    );

    if (lastPinchDistance > 0) {
      const delta = currentDistance - lastPinchDistance;
      const scaleFactor = delta > 0 ? 1.02 : 0.98;
      
      setScale(prev => Math.min(3.0, Math.max(0.3, prev * scaleFactor)));
    }
    
    lastPinchDistance = currentDistance;
  }
};
```

### 用户体验改进
- 📄 **连续阅读**：所有页面一次性显示，无需翻页
- 🖱️ **自然滚动**：符合网页浏览习惯的滚动方式
- 👆 **多点触控**：支持Mac触控板双指手势
- ⌨️ **快捷键支持**：Ctrl/Cmd+滚轮精确缩放
- 📍 **页面标识**：每页显示页码，便于定位
- 🎯 **精确控制**：多种缩放方式满足不同使用习惯

## 使用方式

用户上传文件后：
1. 默认显示"预览"Tab，可立即查看原始文件
2. OCR处理完成后，"内容"、"图片"、"详情"Tab变为可用
3. 可随时在各Tab间切换查看不同内容