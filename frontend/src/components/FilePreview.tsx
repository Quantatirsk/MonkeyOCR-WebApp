/**
 * FilePreview Component
 * Enhanced PDF and image file previews using embed-pdf-viewer with advanced features
 * Includes outline navigation, annotations, search, and mobile adaptation
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
// Import new enhanced PDF viewer
import { EmbedPDFViewer } from './pdf/EmbedPDFViewer';
// Keep react-pdf as fallback for now
import { Document, Page, pdfjs } from 'react-pdf';

// Import react-pdf styles for fallback
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { 
  RotateCw,
  FileText,
  Image as ImageIcon,
  AlertCircle,
  Eye,
  EyeOff,
  Settings,
  Zap
} from 'lucide-react';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { ProcessingTask, BlockData, BlockSelection } from '../types';
import { syncManager } from '../utils/syncManager';
import { PDFBlockOverlay } from './pdf/PDFBlockOverlay';
import { ImageBlockOverlay } from './image/ImageBlockOverlay';
import { getAccessToken } from '../utils/auth';

// Set up PDF.js worker for Vite (fallback)
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

interface FilePreviewProps {
  task: ProcessingTask;
  className?: string;
  hideToolbar?: boolean;
  onRotate?: (pageNumber: number) => void;
  selectedPage?: number | null;
  onPageSelect?: (pageNumber: number) => void;
  externalPageRotations?: { [pageNumber: number]: number };
  
  // PDF-Markdown sync feature props
  blockData?: BlockData[];
  selectedBlock?: BlockSelection;
  highlightedBlocks?: number[];
  syncEnabled?: boolean;
  onBlockClick?: (blockIndex: number, pageNumber: number) => void;
  onBlockHover?: (blockIndex: number | null, pageNumber: number) => void;
  containerRef?: React.RefObject<HTMLElement>;
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
  // Enhanced viewer toggle state
  const [useEnhancedViewer, setUseEnhancedViewer] = useState(true);
  const [showViewerSettings, setShowViewerSettings] = useState(false);
  
  // Original state management (preserved for fallback)
  const [numPages, setNumPages] = useState<number>(0);
  const [pageRotations, setPageRotations] = useState<{ [pageNumber: number]: number }>({});
  const [internalSelectedPage, setInternalSelectedPage] = useState<number | null>(null);
  const [showBlockOverlays, setShowBlockOverlays] = useState<boolean>(syncEnabled);
  
  // File loading state
  const [error, setError] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const blobUrlRef = useRef<string | null>(null);
  const loadedTaskIdRef = useRef<string | null>(null);
  const [previewInfo, setPreviewInfo] = useState<any>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const internalContainerRef = React.useRef<HTMLDivElement>(null);
  
  // Use external container ref if provided, otherwise use internal ref
  const containerRef = externalContainerRef || internalContainerRef;
  
  // State management for compatibility
  const useExternalControl = onPageSelect !== undefined;
  const selectedPage = useExternalControl ? externalSelectedPage : internalSelectedPage;
  const setSelectedPage = useExternalControl ? onPageSelect : setInternalSelectedPage;
  const currentPageRotations = useExternalControl ? (externalPageRotations || {}) : pageRotations;
  
  // Image-specific state
  const [imageDimensions, setImageDimensions] = useState<[number, number]>([0, 0]);
  const [displayDimensions, setDisplayDimensions] = useState<[number, number]>([0, 0]);
  const imageRef = useRef<HTMLImageElement>(null);
  
  // Drag state for performance optimization
  const [isDragging, setIsDragging] = useState(false);
  const dragTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Load file preview (preserved from original implementation)
  React.useEffect(() => {
    if (loadedTaskIdRef.current === task.id && fileUrl && blobUrlRef.current) {
      return;
    }
    
    const loadFilePreview = async () => {
      if (!task.id) return;
      
      setIsLoadingFile(true);
      setError(null);
      
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      
      try {
        const previewData = await syncManager.getTaskPreview(task.id);
        setPreviewInfo(previewData.data);
        
        if (previewData.data?.file_exists) {
          const accessToken = getAccessToken();
          const needsAuth = accessToken !== null;
          
          if (needsAuth && accessToken) {
            setIsAuthenticating(true);
            try {
              const fileUrl = syncManager.getOriginalFileUrl(task.id);
              const response = await fetch(fileUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
              });
              
              if (response.ok) {
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                blobUrlRef.current = blobUrl;
                setFileUrl(blobUrl);
                loadedTaskIdRef.current = task.id;
              } else if (response.status === 403) {
                setError('没有权限访问此文件');
                setFileUrl(null);
              } else {
                setError(`文件加载失败: ${response.status}`);
                setFileUrl(null);
              }
            } catch (fetchError) {
              console.error('Failed to fetch file with auth:', fetchError);
              setError('文件加载失败');
              setFileUrl(null);
            } finally {
              setIsAuthenticating(false);
            }
          } else {
            const url = syncManager.getOriginalFileUrl(task.id);
            setFileUrl(url);
            loadedTaskIdRef.current = task.id;
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
    
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [task.id]);

  // Container size monitoring (preserved)
  React.useLayoutEffect(() => {
    const updateContainerSize = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        if (width > 0 && Math.abs(width - containerWidth) > 5) {
          setContainerWidth(width);
          
          if (!isDragging) {
            setIsDragging(true);
          }
          
          if (dragTimeoutRef.current) {
            clearTimeout(dragTimeoutRef.current);
          }
          
          dragTimeoutRef.current = setTimeout(() => {
            setIsDragging(false);
          }, 300);
        }
      }
    };

    updateContainerSize();
    const resizeObserver = new ResizeObserver(updateContainerSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
      }
    };
  }, [containerWidth]);

  // Page rotation function (preserved)
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

  // Set default selected page for images
  React.useEffect(() => {
    if (task.file_type === 'image' && fileUrl && selectedPage === null) {
      setSelectedPage(1);
    }
  }, [task.file_type, fileUrl, selectedPage]);

  // Update block overlay visibility
  React.useEffect(() => {
    setShowBlockOverlays(syncEnabled);
  }, [syncEnabled]);

  // Image dimension handling (preserved)
  React.useEffect(() => {
    if (task.file_type !== 'image' || !fileUrl) return;

    const updateImageDimensions = () => {
      const img = imageRef.current;
      if (!img) return;

      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;
      
      if (naturalWidth > 0 && naturalHeight > 0) {
        setImageDimensions([naturalWidth, naturalHeight]);
      }

      const imgWidth = img.clientWidth;
      const imgHeight = img.clientHeight;
      const rotation = currentPageRotations[1] || 0;
      
      if (imgWidth > 0 && imgHeight > 0) {
        if (rotation === 90 || rotation === 270) {
          setDisplayDimensions([imgHeight, imgWidth]);
        } else {
          setDisplayDimensions([imgWidth, imgHeight]);
        }
      }
    };

    const img = imageRef.current;
    if (img) {
      if (img.complete) {
        updateImageDimensions();
      } else {
        img.addEventListener('load', updateImageDimensions);
        return () => img.removeEventListener('load', updateImageDimensions);
      }
    }
  }, [task.file_type, fileUrl, currentPageRotations]);

  // Handle image resize (preserved)
  React.useEffect(() => {
    if (task.file_type !== 'image') return;

    const img = imageRef.current;
    if (!img) return;

    const resizeObserver = new ResizeObserver(() => {
      const imgWidth = img.clientWidth;
      const imgHeight = img.clientHeight;
      const rotation = currentPageRotations[1] || 0;
      
      if (imgWidth > 0 && imgHeight > 0) {
        if (rotation === 90 || rotation === 270) {
          setDisplayDimensions([imgHeight, imgWidth]);
        } else {
          setDisplayDimensions([imgWidth, imgHeight]);
        }
      }
    });

    resizeObserver.observe(img);
    return () => resizeObserver.disconnect();
  }, [task.file_type, fileUrl, currentPageRotations]);

  // PDF document load handlers (for fallback)
  const onDocumentLoadSuccess = React.useCallback(async (pdf: any) => {
    setNumPages(pdf.numPages);
    setError(null);
  }, []);

  const onDocumentLoadError = React.useCallback(() => {
    setError('无法加载PDF文件');
  }, []);

  // Loading state
  if (isLoadingFile || isAuthenticating) {
    return (
      <div className={`${className} h-full overflow-auto bg-muted/5`}>
        <div className="p-8 space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
          <div className="space-y-2 mt-6">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
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
          </div>
        </div>
      </div>
    );
  }

  // Render image preview (preserved functionality)
  if (task.file_type === 'image') {
    return (
      <div className={`${className} h-full flex flex-col`}>
        {!hideToolbar && (
          <div className="border-b bg-muted/5 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center space-x-2 flex-wrap">
                <ImageIcon className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium whitespace-nowrap">图片预览</span>
                <Badge variant="outline" className="text-xs truncate max-w-48">
                  {task.filename}
                </Badge>
              </div>
              
              <div className="flex items-center space-x-1 flex-shrink-0">
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

        <div className="flex-1 overflow-hidden" ref={task.file_type === 'image' ? containerRef as React.RefObject<HTMLDivElement> : undefined}>
          <ScrollArea className="h-full w-full">
            <div className="flex items-center justify-center min-h-full p-4">
              <div 
                className="relative"
                style={{
                  transform: `rotate(${currentPageRotations[1] || 0}deg)`,
                  transformOrigin: 'center',
                  transition: 'transform 200ms ease-in-out'
                }}
              >
                <img
                  ref={imageRef}
                  src={fileUrl}
                  alt={task.filename}
                  className="max-w-full h-auto shadow-lg rounded-lg transition-all duration-200"
                  onError={() => setError('无法加载图片文件')}
                  onClick={() => setSelectedPage(1)}
                />
                
                {syncEnabled && blockData.length > 0 && showBlockOverlays && imageDimensions[0] > 0 && displayDimensions[0] > 0 && (
                  <ImageBlockOverlay
                    blocks={blockData}
                    imageDimensions={imageDimensions}
                    displayDimensions={displayDimensions}
                    rotation={0}
                    selectedBlock={selectedBlock}
                    highlightedBlocks={highlightedBlocks}
                    syncEnabled={showBlockOverlays}
                    onBlockClick={onBlockClick}
                    onBlockHover={onBlockHover}
                    className="z-10"
                    isDragging={isDragging}
                  />
                )}
              </div>
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

  // Enhanced PDF viewer with fallback
  return (
    <div className={`${className} h-full flex flex-col`}>
      {/* Enhanced toolbar with viewer toggle */}
      {!hideToolbar && (
        <div className="border-b bg-muted/5 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center space-x-2 flex-wrap">
              <FileText className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium whitespace-nowrap">
                {useEnhancedViewer ? 'Enhanced PDF Viewer' : 'Standard PDF Viewer'}
              </span>
              <Badge variant="outline" className="text-xs truncate max-w-48">
                {task.filename}
              </Badge>
              {numPages > 0 && (
                <Badge variant="secondary" className="text-xs whitespace-nowrap">
                  {numPages} 页
                </Badge>
              )}
            </div>
            
            <div className="flex items-center space-x-1 flex-shrink-0">
              {/* Viewer mode toggle */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowViewerSettings(!showViewerSettings)}
                title="查看器设置"
                className="h-7 w-7 p-0"
              >
                <Settings className="w-3 h-3" />
              </Button>
              
              {/* Standard controls */}
              {syncEnabled && blockData.length > 0 && (
                <Button 
                  variant={showBlockOverlays ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => setShowBlockOverlays(!showBlockOverlays)}
                  title={showBlockOverlays ? "隐藏区块标记" : "显示区块标记"}
                  className="h-7 w-7 p-0"
                >
                  {showBlockOverlays ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </Button>
              )}
              
              {!useEnhancedViewer && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={rotatePage} 
                    title={selectedPage ? `旋转第${selectedPage}页` : "请先点击要旋转的页面"}
                    disabled={selectedPage === null}
                    className="h-7 w-7 p-0"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </Button>
                  
                  {selectedPage && (
                    <span className="text-xs text-muted-foreground border rounded px-2 py-1 whitespace-nowrap">
                      第{selectedPage}页
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
          
          {/* Viewer settings panel */}
          {showViewerSettings && (
            <div className="mt-2 p-3 border rounded-lg bg-background">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enhanced-viewer"
                      checked={useEnhancedViewer}
                      onCheckedChange={setUseEnhancedViewer}
                    />
                    <Label htmlFor="enhanced-viewer" className="text-sm">
                      使用增强型PDF查看器
                    </Label>
                    <Zap className="w-4 h-4 text-yellow-500" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    增强型查看器提供大纲导航、标注功能、全文搜索和更好的移动端体验
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowViewerSettings(false)}
                  className="ml-4"
                >
                  ✕
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PDF Content - Enhanced or Fallback */}
      <div className="flex-1 overflow-hidden">
        {useEnhancedViewer ? (
          // Enhanced PDF Viewer with all advanced features
          <EmbedPDFViewer
            src={fileUrl}
            task={task}
            blockData={blockData}
            selectedBlock={selectedBlock}
            highlightedBlocks={highlightedBlocks}
            syncEnabled={syncEnabled}
            onBlockClick={onBlockClick}
            onBlockHover={onBlockHover}
            onPageChange={setSelectedPage}
            onLoad={() => setError(null)}
            onError={setError}
            containerRef={containerRef}
            className="h-full"
          />
        ) : (
          // Fallback to original react-pdf implementation
          <ScrollArea ref={containerRef as any} className="h-full w-full">
            <div className="flex flex-col items-center p-2 space-y-1 min-h-full">
              <Document
                key={`${task.id}-${fileUrl}`}
                file={fileUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="p-8 space-y-4">
                    <Skeleton className="h-8 w-3/4" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                    </div>
                  </div>
                }
              >
                {numPages > 0 && Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
                  const pageRotation = currentPageRotations[pageNum] || 0;
                  const isSelected = selectedPage === pageNum;
                  
                  return (
                    <div 
                      key={pageNum} 
                      className="relative cursor-pointer transition-all duration-200 mb-1"
                      data-page-number={pageNum}
                      onClick={() => setSelectedPage(pageNum)}
                    >
                      <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs z-20 flex items-center gap-1">
                        <span>第 {pageNum} 页</span>
                        {pageRotation > 0 && (
                          <span className="text-yellow-300">↻{pageRotation}°</span>
                        )}
                        {isSelected && (
                          <span className="text-blue-300">●</span>
                        )}
                      </div>
                      
                      <div className="relative">
                        <Page
                          pageNumber={pageNum}
                          className="shadow-lg transition-all duration-300"
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                          rotate={pageRotation}
                          width={Math.min(containerWidth - 32, 800)}
                        />
                        
                        {syncEnabled && blockData.length > 0 && showBlockOverlays && (
                          <PDFBlockOverlay
                            blocks={blockData}
                            pageNumber={pageNum}
                            pageSize={[595, 842]}
                            scale={1}
                            rotation={0}
                            selectedBlock={selectedBlock}
                            highlightedBlocks={highlightedBlocks}
                            syncEnabled={showBlockOverlays}
                            onBlockClick={onBlockClick}
                            onBlockHover={onBlockHover}
                            className="z-10"
                            isDragging={isDragging}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </Document>
            </div>
          </ScrollArea>
        )}
        
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

// Simplified memo strategy for better performance
export const FilePreview = React.memo(FilePreviewComponent, (prevProps, nextProps) => {
  if (prevProps.task.id !== nextProps.task.id ||
      prevProps.task.filename !== nextProps.task.filename ||
      prevProps.task.file_type !== nextProps.task.file_type ||
      prevProps.task.status !== nextProps.task.status) {
    return false;
  }
  
  if (JSON.stringify(prevProps.blockData) !== JSON.stringify(nextProps.blockData)) {
    return false;
  }
  
  if (JSON.stringify(prevProps.externalPageRotations || {}) !== JSON.stringify(nextProps.externalPageRotations || {})) {
    return false;
  }
  
  if (JSON.stringify(prevProps.selectedBlock) !== JSON.stringify(nextProps.selectedBlock) ||
      JSON.stringify(prevProps.highlightedBlocks) !== JSON.stringify(nextProps.highlightedBlocks)) {
    return false;
  }
  
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