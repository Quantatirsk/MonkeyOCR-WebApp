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
  RotateCw,
  FileText,
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { ProcessingTask } from '../types';
import { syncManager } from '../utils/syncManager';

// Set up PDF.js worker for Vite
// Use local worker file copied by vite-plugin-static-copy
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

interface FilePreviewProps {
  task: ProcessingTask;
  className?: string;
  hideToolbar?: boolean; // 是否隐藏工具栏
  onRotate?: (pageNumber: number) => void; // 外部旋转控制
  selectedPage?: number | null; // 外部选中页面状态
  onPageSelect?: (pageNumber: number) => void; // 外部页面选择控制
  externalPageRotations?: { [pageNumber: number]: number }; // 外部页面旋转状态
}

const FilePreviewComponent: React.FC<FilePreviewProps> = ({ 
  task, 
  className = '', 
  hideToolbar = false,
  onRotate,
  selectedPage: externalSelectedPage,
  onPageSelect,
  externalPageRotations
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageRotations, setPageRotations] = useState<{ [pageNumber: number]: number }>({});
  const [internalSelectedPage, setInternalSelectedPage] = useState<number | null>(null);
  
  // 修复Bug1: 正确判断是否使用外部状态 - 只有当外部明确提供了非空回调函数时才使用外部状态
  const useExternalControl = onPageSelect !== undefined;
  const selectedPage = useExternalControl ? externalSelectedPage : internalSelectedPage;
  const setSelectedPage = useExternalControl ? onPageSelect : setInternalSelectedPage;
  
  // 修复Bug2: 避免状态污染 - 严格隔离内部和外部旋转状态
  const currentPageRotations = useExternalControl ? (externalPageRotations || {}) : pageRotations;
  const [error, setError] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);
  const [previewInfo, setPreviewInfo] = useState<any>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  // 从服务器获取文件预览URL和信息
  React.useEffect(() => {
    const loadFilePreview = async () => {
      if (!task.id) return;
      
      setIsLoadingFile(true);
      setError(null);
      
      try {
        // 获取预览信息
        const previewData = await syncManager.getTaskPreview(task.id);
        setPreviewInfo(previewData.data);
        
        // 如果文件存在，设置预览URL
        if (previewData.data?.file_exists) {
          const url = syncManager.getOriginalFileUrl(task.id);
          setFileUrl(url);
        } else {
          setFileUrl(null);
        }
      } catch (err) {
        console.error('Failed to load file preview:', err);
        setError('无法加载文件预览');
        setFileUrl(null);
      } finally {
        setIsLoadingFile(false);
      }
    };
    
    loadFilePreview();
  }, [task.id]);

  // 简化的容器监听 - 仅用于触发CSS响应式更新
  React.useLayoutEffect(() => {
    const updateContainerSize = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        if (width > 0 && Math.abs(width - containerWidth) > 5) {
          setContainerWidth(width);
        }
      }
    };

    // 初始化尺寸
    updateContainerSize();

    // 简单的ResizeObserver - 避免过度监听
    const resizeObserver = new ResizeObserver(updateContainerSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);


  
  // 单页旋转控制 - 修复Bug2: 确保旋转操作使用正确的状态系统
  const rotatePage = () => {
    if (selectedPage !== null && selectedPage !== undefined) {
      if (useExternalControl && onRotate) {
        onRotate(selectedPage);
      } else if (!useExternalControl) {
        setPageRotations(prev => ({
          ...prev,
          [selectedPage]: ((prev[selectedPage] || 0) + 90) % 360
        }));
      }
    }
  };

  // 添加CSS样式实现响应式PDF渲染
  React.useLayoutEffect(() => {
    const styleId = 'pdf-responsive-style';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;
    
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }
    
    // 改进的CSS规则：实现真正的响应式PDF和正确的滚动
    styleElement.textContent = `
      /* PDF页面容器响应式 */
      .react-pdf__Page {
        max-width: 100% !important;
        margin: 0 auto 24px auto !important;
        display: block !important;
        position: relative !important;
      }
      
      /* PDF Canvas响应式 - 关键规则 */
      .react-pdf__Page__canvas {
        max-width: 100% !important;
        width: 100% !important;
        height: auto !important;
        object-fit: contain !important;
        display: block !important;
      }
      
      /* 确保容器不干扰滚动 */
      .react-pdf__Document {
        overflow: visible !important;
        height: auto !important;
        min-height: auto !important;
        display: block !important;
      }
      
      /* SVG渲染也要响应式 */
      .react-pdf__Page__svg {
        max-width: 100% !important;
        width: 100% !important;
        height: auto !important;
        display: block !important;
      }
    `;
    
    return () => {
      const element = document.getElementById(styleId);
      if (element) {
        element.remove();
      }
    };
  }, []);

  // 为图片设置默认选中页面（用于旋转功能）
  React.useEffect(() => {
    if (task.file_type === 'image' && fileUrl && selectedPage === null) {
      setSelectedPage(1);
    }
  }, [task.file_type, fileUrl, selectedPage]);

  // PDF文档加载成功回调
  const onDocumentLoadSuccess = React.useCallback((pdf: any) => {
    setNumPages(pdf.numPages);
    setError(null);
  }, []);

  const onDocumentLoadError = React.useCallback((error: Error) => {
    console.error('PDF load error:', error);
    setError('无法加载PDF文件');
  }, []);

  // Loading state
  if (isLoadingFile) {
    return (
      <div className={`${className} h-full flex items-center justify-center bg-background`}>
        <div className="flex flex-col items-center space-y-4 p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <div className="space-y-2 text-center">
            <h3 className="text-lg font-semibold">加载文件预览中...</h3>
            <p className="text-muted-foreground">正在从服务器获取文件信息</p>
          </div>
        </div>
      </div>
    );
  }

  // No file or error state
  if (!fileUrl || error) {
    return (
      <div className={`${className} h-full flex items-center justify-center bg-background`}>
        <div className="flex flex-col items-center space-y-4 p-8">
          <AlertCircle className="w-12 h-12 text-muted-foreground" />
          <div className="space-y-2 text-center">
            <h3 className="text-lg font-semibold">
              {error ? '文件预览加载失败' : '文件预览不可用'}
            </h3>
            <p className="text-muted-foreground">
              {error || (
                task.status === 'completed' 
                  ? '任务已完成，请查看"内容"页面的OCR结果'
                  : task.status === 'processing'
                  ? '文件正在处理中，完成后可查看OCR结果'
                  : task.status === 'failed'
                  ? '任务处理失败，无法预览文件'
                  : '原始文件不可用，可能已被清理'
              )}
            </p>
            {task.status === 'completed' && !error && (
              <p className="text-xs text-muted-foreground mt-2">
                💡 提示：切换到"内容"标签页查看提取的文本和图片
              </p>
            )}
            {previewInfo && (
              <div className="mt-4 text-sm text-muted-foreground">
                <p>文件信息：{previewInfo.filename || task.filename}</p>
                {previewInfo.file_size && (
                  <p>文件大小：{(previewInfo.file_size / 1024 / 1024).toFixed(2)} MB</p>
                )}
                {previewInfo.file_type && (
                  <p>文件类型：{previewInfo.file_type}</p>
                )}
              </div>
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
        {/* Image Controls - 响应式布局，可选显示 */}
        {!hideToolbar && (
          <div className="border-b bg-muted/5 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {/* 左侧：标题和信息 */}
              <div className="flex items-center space-x-2 flex-wrap">
                <ImageIcon className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium whitespace-nowrap">图片预览</span>
                <Badge variant="outline" className="text-xs truncate max-w-48">
                  {task.filename}
                </Badge>
              </div>
              
              {/* 右侧：操作按钮 */}
              <div className="flex items-center space-x-1 flex-shrink-0">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={rotatePage} 
                  title="旋转图片"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Image Content */}
        <div className="flex-1 overflow-hidden" ref={task.file_type === 'image' ? containerRef : undefined}>
          <ScrollArea className="h-full w-full">
            <div className="flex items-center justify-center min-h-full p-4">
              <img
                src={fileUrl}
                alt={task.filename}
                className="max-w-full h-auto shadow-lg rounded-lg transition-all duration-200"
                style={{
                  transform: `rotate(${currentPageRotations[1] || 0}deg)`,
                  transformOrigin: 'center'
                }}
                onError={() => setError('无法加载图片文件')}
                onClick={() => setSelectedPage(1)}
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
      {/* PDF Controls - 响应式布局，可选显示 */}
      {!hideToolbar && (
        <div className="border-b bg-muted/5 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {/* 左侧：标题和信息 */}
            <div className="flex items-center space-x-2 flex-wrap">
              <FileText className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium whitespace-nowrap">PDF预览</span>
              <Badge variant="outline" className="text-xs truncate max-w-48">
                {task.filename}
              </Badge>
              {numPages > 0 && (
                <Badge variant="secondary" className="text-xs whitespace-nowrap">
                  {numPages} 页
                </Badge>
              )}
            </div>
            
            {/* 右侧：操作按钮 */}
            <div className="flex items-center space-x-1 flex-shrink-0">
              {/* Rotation - only for selected page */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={rotatePage} 
                title={selectedPage ? `旋转第${selectedPage}页` : "请先点击要旋转的页面"}
                disabled={selectedPage === null}
              >
                <RotateCw className="w-3.5 h-3.5" />
              </Button>
              
              {/* Current page indicator */}
              {selectedPage && (
                <span className="text-xs text-muted-foreground border rounded px-2 py-1 whitespace-nowrap">
                  第{selectedPage}页
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PDF Content - 高级响应式版本 */}
      <div className="flex-1 overflow-hidden" ref={containerRef}>
        <ScrollArea className="h-full w-full">
          <div className="flex flex-col items-center p-4 space-y-4 min-h-full">
            <Document
              key={`${task.id}-${fileUrl}`}
              file={fileUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
            >
              {numPages > 0 && Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
                const pageRotation = currentPageRotations[pageNum] || 0;
                const isSelected = selectedPage === pageNum;
                // 简化：只使用globalScale用于手动缩放，CSS处理响应式
                
                return (
                  <div 
                    key={pageNum} 
                    className={`relative cursor-pointer transition-all duration-200 mb-6 ${
                      isSelected ? 'ring-2 ring-primary ring-offset-2' : ''
                    }`}
                    onClick={() => setSelectedPage(pageNum)}
                  >
                    {/* 页码标签 */}
                    <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs z-10 flex items-center gap-1">
                      <span>第 {pageNum} 页</span>
                      {pageRotation > 0 && (
                        <span className="text-yellow-300">↻{pageRotation}°</span>
                      )}
                      {isSelected && (
                        <span className="text-blue-300">●</span>
                      )}
                    </div>
                    
                    <Page
                      pageNumber={pageNum}
                      rotate={pageRotation}
                      className="shadow-lg transition-all duration-300"
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                  </div>
                );
              })}
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

// 修复Bug3: 简化React.memo比较，避免函数引用比较问题
export const FilePreview = React.memo(FilePreviewComponent, (prevProps, nextProps) => {
  // 只比较关键的数据属性，避免函数引用比较
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.filename === nextProps.task.filename &&
    prevProps.task.file_type === nextProps.task.file_type &&
    prevProps.task.status === nextProps.task.status &&
    prevProps.className === nextProps.className &&
    prevProps.hideToolbar === nextProps.hideToolbar &&
    prevProps.selectedPage === nextProps.selectedPage &&
    // 比较外部旋转状态对象
    JSON.stringify(prevProps.externalPageRotations || {}) === JSON.stringify(nextProps.externalPageRotations || {}) &&
    // 检查是否从外部控制模式切换到内部控制模式，或反之
    (prevProps.onPageSelect !== undefined) === (nextProps.onPageSelect !== undefined)
  );
});

export default FilePreview;