/**
 * FilePreview Component
 * Handles PDF and image file previews using react-pdf and native image rendering
 */

import React, { useState, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Import react-pdf styles to fix TextLayer warning
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { 
  RotateCw,
  FileText,
  Image as ImageIcon,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { ProcessingTask, BlockData, BlockSelection } from '../types';
import { syncManager } from '../utils/syncManager';
import { PDFBlockOverlay } from './pdf/PDFBlockOverlay';
import { getAccessToken } from '../utils/auth';

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
  
  // PDF-Markdown sync feature props
  blockData?: BlockData[]; // Block data for overlays
  selectedBlock?: BlockSelection; // Currently selected block
  highlightedBlocks?: number[]; // Highlighted block indices
  syncEnabled?: boolean; // Whether sync features are enabled
  onBlockClick?: (blockIndex: number, pageNumber: number) => void; // Block click handler
  onBlockHover?: (blockIndex: number | null, pageNumber: number) => void; // Block hover handler
  containerRef?: React.RefObject<HTMLElement>; // Container ref for scroll synchronization
}

const FilePreviewComponent: React.FC<FilePreviewProps> = ({ 
  task, 
  className = '', 
  hideToolbar = false,
  onRotate,
  selectedPage: externalSelectedPage,
  onPageSelect,
  externalPageRotations,
  
  // PDF-Markdown sync props
  blockData = [],
  selectedBlock = { blockIndex: null, pageNumber: null, isActive: false },
  highlightedBlocks = [],
  syncEnabled = false,
  onBlockClick,
  onBlockHover,
  containerRef: externalContainerRef
}) => {
  // Debug: Log when selectedBlock changes
  React.useEffect(() => {
    console.log('[FilePreview] selectedBlock changed:', selectedBlock);
  }, [selectedBlock]);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageRotations, setPageRotations] = useState<{ [pageNumber: number]: number }>({});
  const [internalSelectedPage, setInternalSelectedPage] = useState<number | null>(null);
  const [showBlockOverlays, setShowBlockOverlays] = useState<boolean>(syncEnabled);
  
  // 修复Bug1: 正确判断是否使用外部状态 - 只有当外部明确提供了非空回调函数时才使用外部状态
  const useExternalControl = onPageSelect !== undefined;
  const selectedPage = useExternalControl ? externalSelectedPage : internalSelectedPage;
  const setSelectedPage = useExternalControl ? onPageSelect : setInternalSelectedPage;
  
  // 修复Bug2: 避免状态污染 - 严格隔离内部和外部旋转状态
  const currentPageRotations = useExternalControl ? (externalPageRotations || {}) : pageRotations;
  const [error, setError] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);  // 新增：认证加载状态
  const blobUrlRef = useRef<string | null>(null);  // 用于跟踪和清理 Blob URL
  const loadedTaskIdRef = useRef<string | null>(null);  // 跟踪已加载的任务ID，防止重复加载
  const [previewInfo, setPreviewInfo] = useState<any>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const internalContainerRef = React.useRef<HTMLDivElement>(null);
  
  // Use external container ref if provided, otherwise use internal ref
  const containerRef = externalContainerRef || internalContainerRef;
  
  // PDF页面动态尺寸信息
  const [pdfPageSizes, setPdfPageSizes] = useState<{ [pageNum: number]: [number, number] }>({});
  const pageRefs = React.useRef<{ [pageNum: number]: HTMLDivElement }>({});
  
  // 拖拽状态管理 - 用于优化渲染性能
  const [isDragging, setIsDragging] = useState(false);
  const dragTimeoutRef = useRef<NodeJS.Timeout>();
  
  // 从服务器获取文件预览URL和信息
  React.useEffect(() => {
    // 如果任务ID没有变化，且已经有文件URL，则不重复加载
    if (loadedTaskIdRef.current === task.id && fileUrl && blobUrlRef.current) {
      return;
    }
    
    const loadFilePreview = async () => {
      if (!task.id) return;
      
      // 只有在成功加载后才标记
      // loadedTaskIdRef.current = task.id;  // 移到成功加载后
      
      setIsLoadingFile(true);
      setError(null);
      
      // 清理之前的 Blob URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      
      try {
        // 获取预览信息
        const previewData = await syncManager.getTaskPreview(task.id);
        setPreviewInfo(previewData.data);
        
        // 如果文件存在，获取文件内容
        if (previewData.data?.file_exists) {
          // 使用新的认证工具函数获取令牌
          const accessToken = getAccessToken();
          const needsAuth = accessToken !== null;
          
          if (needsAuth && accessToken) {
            // 有认证令牌，使用 fetch 获取文件并创建 Blob URL
            setIsAuthenticating(true);  // 开始认证加载
            try {
              const fileUrl = syncManager.getOriginalFileUrl(task.id);
              
              const response = await fetch(fileUrl, {
                headers: {
                  'Authorization': `Bearer ${accessToken}`
                }
              });
              
              if (response.ok) {
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                blobUrlRef.current = blobUrl;  // 保存引用以便清理
                setFileUrl(blobUrl);  // 设置 Blob URL
                loadedTaskIdRef.current = task.id;  // 成功加载后标记
              } else if (response.status === 403) {
                // 403 错误，可能是权限问题
                setError('没有权限访问此文件');
                setFileUrl(null);
              } else {
                // 其他错误
                setError(`文件加载失败: ${response.status}`);
                setFileUrl(null);
              }
            } catch (fetchError) {
              console.error('Failed to fetch file with auth:', fetchError);
              setError('文件加载失败');
              setFileUrl(null);
            } finally {
              setIsAuthenticating(false);  // 结束认证加载
            }
          } else {
            // 没有认证令牌，直接使用URL（适用于匿名文件）
            const url = syncManager.getOriginalFileUrl(task.id);
            setFileUrl(url);
            loadedTaskIdRef.current = task.id;  // 成功设置URL后标记
          }
        } else {
          setFileUrl(null);
        }
      } catch (err) {
        setError('无法加载文件预览');
        setFileUrl(null);
      } finally {
        setIsLoadingFile(false);
      }
    };
    
    loadFilePreview();
    
    // 清理函数
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [task.id]); // 只依赖 task.id，避免重复加载

  // 容器尺寸监听 - 触发PDF缩放重计算
  React.useLayoutEffect(() => {
    const updateContainerSize = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        if (width > 0 && Math.abs(width - containerWidth) > 5) {
          setContainerWidth(width);
          
          // Detect dragging state for performance optimization
          if (!isDragging) {
            setIsDragging(true);
          }
          
          // Clear existing timeout and set new one
          if (dragTimeoutRef.current) {
            clearTimeout(dragTimeoutRef.current);
          }
          
          dragTimeoutRef.current = setTimeout(() => {
            setIsDragging(false);
          }, 300); // 300ms delay to detect end of dragging
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
      // Clear drag timeout on cleanup
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
      }
    };
  }, [containerWidth]); // Simplified - CSS handles scaling automatically


  
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
    
    // 改进的CSS规则：实现真正的响应式PDF和快速滚动动画
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
      
      /* 快速滚动动画 - 保持视觉效果但提升速度 */
      [data-radix-scroll-area-viewport] {
        scroll-behavior: smooth !important;
        scroll-padding-top: 20px !important;
      }
      
      /* 加速CSS滚动动画 */
      * {
        --scroll-duration: 300ms;
      }
      
      @media (prefers-reduced-motion: no-preference) {
        [data-radix-scroll-area-viewport] {
          transition: scroll-position var(--scroll-duration) cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
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

  // Update block overlay visibility when sync is enabled/disabled
  React.useEffect(() => {
    setShowBlockOverlays(syncEnabled);
  }, [syncEnabled]);

  // PDF文档加载成功回调
  const onDocumentLoadSuccess = React.useCallback(async (pdf: any) => {
    setNumPages(pdf.numPages);
    setError(null);
    
    // 获取每个页面的真实尺寸
    const pageSizes: { [pageNum: number]: [number, number] } = {};
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.0 });
        pageSizes[pageNum] = [viewport.width, viewport.height];
      } catch {
        // 使用默认A4尺寸作为后备
        pageSizes[pageNum] = [595, 842];
      }
    }
    
    setPdfPageSizes(pageSizes);
  }, []);

  const onDocumentLoadError = React.useCallback(() => {
    setError('无法加载PDF文件');
  }, []);

  // Loading state - skeleton screen matching the document structure
  if (isLoadingFile || isAuthenticating) {
    return (
      <div className={`${className} h-full overflow-auto bg-muted/5`}>
        <div className="p-8 space-y-4">
          {/* 标题骨架 */}
          <Skeleton className="h-8 w-3/4" />
          
          {/* 第一段内容骨架 */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
          
          {/* 副标题骨架 */}
          <div className="space-y-2 mt-6">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          
          {/* 额外段落骨架 */}
          <div className="space-y-2 mt-6">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          
          {/* 更多内容骨架 */}
          <div className="space-y-2 mt-6">
            <Skeleton className="h-6 w-2/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          
          {/* 额外段落骨架 */}
          <div className="space-y-2 mt-6">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-2/3" />
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
        <div className="flex-1 overflow-hidden" ref={task.file_type === 'image' ? containerRef as React.RefObject<HTMLDivElement> : undefined}>
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
              {/* Block overlay toggle - only show if sync is available */}
              {syncEnabled && blockData.length > 0 && (
                <Button 
                  variant={showBlockOverlays ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => setShowBlockOverlays(!showBlockOverlays)}
                  title={showBlockOverlays ? "隐藏区块标记" : "显示区块标记"}
                >
                  {showBlockOverlays ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </Button>
              )}
              
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
      <div className="flex-1 overflow-hidden">
        <ScrollArea ref={containerRef as any} className="h-full w-full">
          <div className="flex flex-col items-center p-4 space-y-4 min-h-full">
            <Document
              key={`${task.id}-${fileUrl}`}
              file={fileUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="text-center space-y-2 py-8">
                  <div className="inline-flex items-center space-x-2">
                    <div className="w-1 h-1 bg-primary rounded-full animate-pulse"></div>
                    <div className="w-1 h-1 bg-primary rounded-full animate-pulse delay-100"></div>
                    <div className="w-1 h-1 bg-primary rounded-full animate-pulse delay-200"></div>
                  </div>
                  <p className="text-sm text-muted-foreground">正在渲染文档...</p>
                </div>
              }
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
                    data-page-number={pageNum}
                    onClick={() => setSelectedPage(pageNum)}
                  >
                    {/* 页码标签 */}
                    <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs z-20 flex items-center gap-1">
                      <span>第 {pageNum} 页</span>
                      {pageRotation > 0 && (
                        <span className="text-yellow-300">↻{pageRotation}°</span>
                      )}
                      {isSelected && (
                        <span className="text-blue-300">●</span>
                      )}
                    </div>
                    
                    <div 
                      className="relative" 
                      ref={(el) => {
                        if (el) {
                          pageRefs.current[pageNum] = el;
                        }
                      }}
                    >
                      <Page
                        pageNumber={pageNum}
                        rotate={pageRotation}
                        className="shadow-lg transition-all duration-300"
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                      />
                      
                      {/* Block Overlay */}
                      {syncEnabled && blockData.length > 0 && showBlockOverlays && (
                        <PDFBlockOverlay
                          blocks={blockData}
                          pageNumber={pageNum}
                          pageSize={pdfPageSizes[pageNum] || [595, 842]} // Use dynamic page size
                          scale={1} // Fixed scale - CSS handles responsive scaling
                          selectedBlock={selectedBlock}
                          highlightedBlocks={highlightedBlocks}
                          syncEnabled={showBlockOverlays}
                          onBlockClick={onBlockClick}
                          onBlockHover={onBlockHover}
                          className="z-10"
                          isDragging={isDragging} // Pass dragging state for performance optimization
                        />
                      )}
                    </div>
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

// 简化 React.memo 策略：只对真正昂贵的操作进行优化
// 允许 selectedBlock 和 highlightedBlocks 变化触发更新
export const FilePreview = React.memo(FilePreviewComponent, (prevProps, nextProps) => {
  // 只在核心属性变化时重新渲染整个 PDF
  // task 变化、文件变化需要重新加载
  if (prevProps.task.id !== nextProps.task.id ||
      prevProps.task.filename !== nextProps.task.filename ||
      prevProps.task.file_type !== nextProps.task.file_type ||
      prevProps.task.status !== nextProps.task.status) {
    return false; // 需要重新渲染
  }
  
  // blockData 变化需要重新计算 overlay
  if (JSON.stringify(prevProps.blockData) !== JSON.stringify(nextProps.blockData)) {
    return false; // 需要重新渲染
  }
  
  // 页面旋转变化需要重新渲染
  if (JSON.stringify(prevProps.externalPageRotations || {}) !== JSON.stringify(nextProps.externalPageRotations || {})) {
    return false; // 需要重新渲染
  }
  
  // selectedBlock 和 highlightedBlocks 的变化不应该阻止更新
  // 让这些状态变化能够传递到 PDFBlockOverlay
  if (JSON.stringify(prevProps.selectedBlock) !== JSON.stringify(nextProps.selectedBlock) ||
      JSON.stringify(prevProps.highlightedBlocks) !== JSON.stringify(nextProps.highlightedBlocks)) {
    return false; // 需要重新渲染以更新高亮
  }
  
  // 其他属性变化也允许更新
  return (
    prevProps.className === nextProps.className &&
    prevProps.hideToolbar === nextProps.hideToolbar &&
    prevProps.selectedPage === nextProps.selectedPage &&
    prevProps.syncEnabled === nextProps.syncEnabled &&
    (prevProps.onPageSelect !== undefined) === (nextProps.onPageSelect !== undefined) &&
    prevProps.containerRef === nextProps.containerRef
  );
});

export default FilePreview;