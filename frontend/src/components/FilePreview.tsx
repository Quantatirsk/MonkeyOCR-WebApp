/**
 * FilePreview Component
 * Handles PDF and image file previews using react-pdf and native image rendering
 */

import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Import react-pdf styles to fix TextLayer warning
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw,
  FileText,
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { ProcessingTask } from '../types';

// Set up PDF.js worker for Vite
// Use local worker file copied by vite-plugin-static-copy
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

interface FilePreviewProps {
  task: ProcessingTask;
  className?: string;
}

const FilePreviewComponent: React.FC<FilePreviewProps> = ({ task, className = '' }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  
  // 稳定的文件URL - 使用useMemo避免重新渲染时重新创建
  const fileUrl = React.useMemo(() => {
    return task.original_file ? URL.createObjectURL(task.original_file) : task.original_file_url;
  }, [task.original_file, task.original_file_url]);

  // 简单的缩放控制 - 移除所有复杂的优化
  const zoomIn = () => setScale(prev => Math.min(3.0, prev + 0.1));
  const zoomOut = () => setScale(prev => Math.max(0.3, prev - 0.1));
  const resetZoom = () => setScale(1.0);
  const rotate = () => setRotation(prev => (prev + 90) % 360);

  // 简单的PDF事件处理 - 使用useCallback避免重新渲染
  const onDocumentLoadSuccess = React.useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setError(null);
  }, []);

  const onDocumentLoadError = React.useCallback((error: Error) => {
    console.error('PDF load error:', error);
    setError('无法加载PDF文件');
  }, []);

  if (!fileUrl) {
    return (
      <div className={`${className} h-full flex items-center justify-center bg-background`}>
        <div className="flex flex-col items-center space-y-4 p-8">
          <AlertCircle className="w-12 h-12 text-muted-foreground" />
          <div className="space-y-2 text-center">
            <h3 className="text-lg font-semibold">文件预览不可用</h3>
            <p className="text-muted-foreground">
              {task.status === 'completed' 
                ? '任务已完成，请查看"内容"页面的OCR结果'
                : task.status === 'processing'
                ? '文件正在处理中，完成后可查看OCR结果'
                : task.status === 'failed'
                ? '任务处理失败，无法预览文件'
                : '原始文件已清理或页面已刷新，预览不可用'}
            </p>
            {task.status === 'completed' && (
              <p className="text-xs text-muted-foreground mt-2">
                💡 提示：切换到"内容"标签页查看提取的文本和图片
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render image preview
  if (task.file_type === 'image') {
    return (
      <div className={`${className} h-full flex flex-col`}>
        {/* Image Controls */}
        <div className="border-b bg-muted/5 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ImageIcon className="w-4 h-4" />
              <span className="text-sm font-medium">图片预览</span>
              <Badge variant="outline" className="text-xs">
                {task.filename}
              </Badge>
              <Badge variant="outline" className="text-xs text-muted-foreground">
                缩放控制
              </Badge>
            </div>
            
            <div className="flex items-center space-x-1">
              <Button variant="outline" size="sm" onClick={zoomOut} title="缩小">
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <Button variant="outline" size="sm" onClick={resetZoom} title="重置缩放">
                <span className="text-xs">{Math.round(scale * 100)}%</span>
              </Button>
              <Button variant="outline" size="sm" onClick={zoomIn} title="放大">
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
              <Button variant="outline" size="sm" onClick={rotate} title="旋转">
                <RotateCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Image Content */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full w-full">
            <div className="flex items-center justify-center min-h-full p-4">
              <img
                src={fileUrl}
                alt={task.filename}
                className="max-w-full h-auto shadow-lg rounded-lg"
                style={{
                  transform: `scale(${scale}) rotate(${rotation}deg)`,
                  transformOrigin: 'center',
                  transition: 'transform 0.2s ease'
                }}
                onError={() => setError('无法加载图片文件')}
              />
            </div>
          </ScrollArea>
        </div>
        
        {error && (
          <div className="p-4 border-t bg-destructive/5">
            <div className="flex items-center space-x-2 text-destructive">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render PDF preview
  return (
    <div className={`${className} h-full flex flex-col`}>
      {/* PDF Controls */}
      <div className="border-b bg-muted/5 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4" />
            <span className="text-sm font-medium">PDF预览</span>
            <Badge variant="outline" className="text-xs">
              {task.filename}
            </Badge>
            {numPages > 0 && (
              <Badge variant="secondary" className="text-xs">
                {numPages} 页
              </Badge>
            )}
            <Badge variant="outline" className="text-xs text-muted-foreground">
              滚动浏览
            </Badge>
          </div>
          
          <div className="flex items-center space-x-1">
            {/* Zoom Controls */}
            <Button variant="outline" size="sm" onClick={zoomOut} title="缩小">
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={resetZoom} title="重置缩放">
              <span className="text-xs">{Math.round(scale * 100)}%</span>
            </Button>
            <Button variant="outline" size="sm" onClick={zoomIn} title="放大">
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
            
            {/* Rotation */}
            <Button variant="outline" size="sm" onClick={rotate} title="旋转">
              <RotateCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* PDF Content - 简化版 */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full w-full">
          <div className="flex flex-col items-center p-4 space-y-4">
            <Document
              key={`${task.id}-${fileUrl}`}
              file={fileUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
            >
              {numPages > 0 && Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                <div key={pageNum} className="relative">
                  <div className="absolute top-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-xs z-10">
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
            </Document>
          </div>
        </ScrollArea>
        
        {error && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-destructive/5 border-t">
            <div className="flex items-center space-x-2 text-destructive">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 使用React.memo优化，只在相关属性变化时重新渲染
export const FilePreview = React.memo(FilePreviewComponent, (prevProps, nextProps) => {
  // 只有文件相关的核心属性变化时才重新渲染
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.filename === nextProps.task.filename &&
    prevProps.task.file_type === nextProps.task.file_type &&
    prevProps.task.original_file === nextProps.task.original_file &&
    prevProps.task.original_file_url === nextProps.task.original_file_url &&
    prevProps.className === nextProps.className
  );
});

export default FilePreview;