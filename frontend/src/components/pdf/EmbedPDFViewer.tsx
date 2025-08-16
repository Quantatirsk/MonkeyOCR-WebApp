/**
 * EmbedPDFViewer Component
 * Enhanced PDF viewer using embed-pdf-viewer with advanced features
 * Includes outline navigation, annotations, search, and mobile adaptation
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
// TODO: Install and import the actual embed-pdf-viewer package
// import { EmbedPDF } from 'embed-pdf-viewer';
import { 
  RotateCw,
  FileText,
  Search,
  BookOpen,
  MessageSquare,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize,
  Download,
  AlertCircle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Skeleton } from '../ui/skeleton';
import { 
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "../ui/resizable";
import { ProcessingTask, BlockData, BlockSelection } from '../../types';
import { PDFBlockOverlay } from './PDFBlockOverlay';

// PDF Outline/Bookmark interface
interface PDFOutlineItem {
  title: string;
  page: number;
  level: number;
  children?: PDFOutlineItem[];
}

// PDF Annotation interface
interface PDFAnnotation {
  id: string;
  type: 'highlight' | 'note' | 'underline';
  page: number;
  content: string;
  bounds: { x: number; y: number; width: number; height: number };
  color: string;
  author?: string;
  createdAt: Date;
}

// Search result interface
interface PDFSearchResult {
  page: number;
  text: string;
  bounds: { x: number; y: number; width: number; height: number };
  index: number;
}

interface EmbedPDFViewerProps {
  src: string;
  className?: string;
  hideToolbar?: boolean;
  
  // Task and block synchronization props
  task?: ProcessingTask;
  blockData?: BlockData[];
  selectedBlock?: BlockSelection;
  highlightedBlocks?: number[];
  syncEnabled?: boolean;
  onBlockClick?: (blockIndex: number, pageNumber: number) => void;
  onBlockHover?: (blockIndex: number | null, pageNumber: number) => void;
  
  // Event handlers
  onPageChange?: (page: number) => void;
  onLoad?: () => void;
  onError?: (error: string) => void;
  
  // Container ref for synchronization
  containerRef?: React.RefObject<HTMLElement>;
}

// Temporary placeholder component until we install the actual package
const EmbedPDFPlaceholder: React.FC<{
  src: string;
  width: string;
  height: string;
  onLoad?: () => void;
  onError?: (error: string) => void;
  onPageChange?: (page: number) => void;
}> = ({ src, width, height, onLoad, onError, onPageChange }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  useEffect(() => {
    // Simulate load event
    const timer = setTimeout(() => {
      onLoad?.();
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [onLoad]);
  
  return (
    <iframe
      ref={iframeRef}
      src={`${src}#toolbar=1&navpanes=1&scrollbar=1&page=1&view=FitH`}
      width={width}
      height={height}
      style={{ border: 'none' }}
      title="PDF Viewer"
      onError={() => onError?.('Failed to load PDF')}
    />
  );
};

export const EmbedPDFViewer: React.FC<EmbedPDFViewerProps> = ({
  src,
  className = '',
  hideToolbar = false,
  task,
  blockData = [],
  selectedBlock = { blockIndex: null, pageNumber: null, isActive: false },
  highlightedBlocks = [],
  syncEnabled = false,
  onBlockClick,
  onBlockHover,
  onPageChange,
  onLoad,
  onError,
  containerRef: externalContainerRef
}) => {
  // State management
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showOutline, setShowOutline] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [showBlockOverlays, setShowBlockOverlays] = useState(syncEnabled);
  
  // Search functionality
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PDFSearchResult[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  
  // PDF content state
  const [outline, setOutline] = useState<PDFOutlineItem[]>([]);
  const [annotations, setAnnotations] = useState<PDFAnnotation[]>([]);
  
  // Refs
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const pdfViewerRef = useRef<HTMLDivElement>(null);
  const containerRef = externalContainerRef || internalContainerRef;
  
  // Mobile adaptation
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Update block overlay visibility when sync is enabled/disabled
  useEffect(() => {
    setShowBlockOverlays(syncEnabled);
  }, [syncEnabled]);
  
  // Handle PDF load
  const handlePDFLoad = useCallback(() => {
    setIsLoaded(true);
    setError(null);
    
    // Extract outline (placeholder implementation)
    const mockOutline: PDFOutlineItem[] = [
      { title: 'Chapter 1: Introduction', page: 1, level: 0 },
      { title: '1.1 Overview', page: 2, level: 1 },
      { title: '1.2 Methodology', page: 5, level: 1 },
      { title: 'Chapter 2: Analysis', page: 10, level: 0 },
    ];
    setOutline(mockOutline);
    setTotalPages(20); // Mock total pages
    
    onLoad?.();
  }, [onLoad]);
  
  // Handle PDF error
  const handlePDFError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    setIsLoaded(false);
    onError?.(errorMessage);
  }, [onError]);
  
  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    onPageChange?.(page);
  }, [onPageChange]);
  
  // Search functionality
  const performSearch = useCallback((query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    // Mock search results
    const mockResults: PDFSearchResult[] = [
      {
        page: 1,
        text: `Found "${query}" on page 1`,
        bounds: { x: 100, y: 200, width: 100, height: 20 },
        index: 0
      },
      {
        page: 3,
        text: `Found "${query}" on page 3`,
        bounds: { x: 150, y: 300, width: 100, height: 20 },
        index: 1
      }
    ];
    
    setSearchResults(mockResults);
    setCurrentSearchIndex(0);
    
    // Navigate to first result
    if (mockResults.length > 0) {
      handlePageChange(mockResults[0].page);
    }
  }, [handlePageChange]);
  
  // Navigation functions
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      handlePageChange(page);
    }
  };
  
  const previousPage = () => goToPage(currentPage - 1);
  const nextPage = () => goToPage(currentPage + 1);
  
  // Zoom functions
  const zoomIn = () => setZoomLevel(prev => Math.min(prev + 25, 300));
  const zoomOut = () => setZoomLevel(prev => Math.max(prev - 25, 50));
  const resetZoom = () => setZoomLevel(100);
  
  // Outline navigation
  const navigateToOutlineItem = (item: PDFOutlineItem) => {
    goToPage(item.page);
  };
  
  // Annotation creation (placeholder)
  const createAnnotation = (type: PDFAnnotation['type'], bounds: PDFAnnotation['bounds']) => {
    const newAnnotation: PDFAnnotation = {
      id: `annotation-${Date.now()}`,
      type,
      page: currentPage,
      content: `${type} annotation`,
      bounds,
      color: type === 'highlight' ? '#ffff00' : '#ff0000',
      author: 'User',
      createdAt: new Date()
    };
    
    setAnnotations(prev => [...prev, newAnnotation]);
  };
  
  // Loading state
  if (!isLoaded && !error) {
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
  if (error) {
    return (
      <div className={`${className} h-full flex items-center justify-center bg-background`}>
        <div className="flex flex-col items-center space-y-4 p-8">
          <AlertCircle className="w-12 h-12 text-muted-foreground" />
          <div className="space-y-2 text-center">
            <h3 className="text-lg font-semibold">PDF加载失败</h3>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    );
  }
  
  // Main PDF viewer UI
  return (
    <div className={`${className} h-full flex flex-col`}>
      {/* Enhanced Toolbar */}
      {!hideToolbar && (
        <div className="border-b bg-muted/5 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {/* Left side: File info */}
            <div className="flex items-center space-x-2 flex-wrap">
              <FileText className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium whitespace-nowrap">Enhanced PDF Viewer</span>
              {task && (
                <Badge variant="outline" className="text-xs truncate max-w-48">
                  {task.filename}
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs whitespace-nowrap">
                {totalPages} 页
              </Badge>
            </div>
            
            {/* Right side: Controls */}
            <div className="flex items-center space-x-1 flex-shrink-0 flex-wrap">
              {/* Search */}
              <div className="flex items-center space-x-1">
                <Input
                  placeholder="搜索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && performSearch(searchQuery)}
                  className="w-32 h-7 text-xs"
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => performSearch(searchQuery)}
                  title="搜索"
                  className="h-7 w-7 p-0"
                >
                  <Search className="w-3 h-3" />
                </Button>
              </div>
              
              {/* Feature toggles */}
              <Button 
                variant={showOutline ? "default" : "outline"} 
                size="sm" 
                onClick={() => setShowOutline(!showOutline)}
                title={showOutline ? "隐藏大纲" : "显示大纲"}
                className="h-7 w-7 p-0"
              >
                <BookOpen className="w-3 h-3" />
              </Button>
              
              <Button 
                variant={showAnnotations ? "default" : "outline"} 
                size="sm" 
                onClick={() => setShowAnnotations(!showAnnotations)}
                title={showAnnotations ? "隐藏标注" : "显示标注"}
                className="h-7 w-7 p-0"
              >
                <MessageSquare className="w-3 h-3" />
              </Button>
              
              {/* Block overlay toggle - only show if sync is available */}
              {syncEnabled && blockData.length > 0 && (
                <Button 
                  variant={showBlockOverlays ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => setShowBlockOverlays(!showBlockOverlays)}
                  title={showBlockOverlays ? "隐藏区块标记" : "显示区块标记"}
                  className="h-7 w-7 p-0"
                >
                  {showBlockOverlays ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </Button>
              )}
              
              {/* Navigation */}
              <div className="flex items-center space-x-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={previousPage}
                  disabled={currentPage <= 1}
                  className="h-7 w-7 p-0"
                  title="上一页"
                >
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                
                <span className="text-xs text-muted-foreground border rounded px-2 py-1 whitespace-nowrap">
                  {currentPage}/{totalPages}
                </span>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={nextPage}
                  disabled={currentPage >= totalPages}
                  className="h-7 w-7 p-0"
                  title="下一页"
                >
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
              
              {/* Zoom controls */}
              <div className="flex items-center space-x-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={zoomOut}
                  disabled={zoomLevel <= 50}
                  className="h-7 w-7 p-0"
                  title="缩小"
                >
                  <ZoomOut className="w-3 h-3" />
                </Button>
                
                <span className="text-xs text-muted-foreground border rounded px-2 py-1 whitespace-nowrap min-w-12 text-center">
                  {zoomLevel}%
                </span>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={zoomIn}
                  disabled={zoomLevel >= 300}
                  className="h-7 w-7 p-0"
                  title="放大"
                >
                  <ZoomIn className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
          
          {/* Search results bar */}
          {searchResults.length > 0 && (
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>找到 {searchResults.length} 个结果</span>
              <div className="flex items-center space-x-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentSearchIndex(Math.max(0, currentSearchIndex - 1))}
                  disabled={currentSearchIndex <= 0}
                  className="h-6 w-6 p-0"
                >
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                <span>{currentSearchIndex + 1}/{searchResults.length}</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentSearchIndex(Math.min(searchResults.length - 1, currentSearchIndex + 1))}
                  disabled={currentSearchIndex >= searchResults.length - 1}
                  className="h-6 w-6 p-0"
                >
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Content area with resizable panels */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Sidebar for outline/annotations */}
          {(showOutline || showAnnotations) && !isMobile && (
            <>
              <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
                <div className="h-full border-r bg-muted/5">
                  <div className="p-3 border-b">
                    <div className="flex items-center space-x-2">
                      {showOutline && (
                        <Button
                          variant={showOutline ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setShowOutline(true)}
                          className="flex-1"
                        >
                          大纲
                        </Button>
                      )}
                      {showAnnotations && (
                        <Button
                          variant={showAnnotations && !showOutline ? "default" : "ghost"}
                          size="sm"
                          onClick={() => {
                            setShowAnnotations(true);
                            setShowOutline(false);
                          }}
                          className="flex-1"
                        >
                          标注
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  <ScrollArea className="h-full">
                    <div className="p-3">
                      {/* Outline content */}
                      {showOutline && (
                        <div className="space-y-1">
                          {outline.map((item, index) => (
                            <div
                              key={index}
                              className={`
                                cursor-pointer hover:bg-muted/50 rounded p-2 text-sm
                                ${item.level > 0 ? 'ml-4' : ''}
                                ${currentPage === item.page ? 'bg-primary/10 text-primary' : ''}
                              `}
                              onClick={() => navigateToOutlineItem(item)}
                            >
                              {item.title}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Annotations content */}
                      {showAnnotations && !showOutline && (
                        <div className="space-y-2">
                          {annotations.map((annotation) => (
                            <div key={annotation.id} className="border rounded p-2 text-xs">
                              <div className="flex items-center justify-between mb-1">
                                <Badge variant="outline">{annotation.type}</Badge>
                                <span className="text-muted-foreground">第{annotation.page}页</span>
                              </div>
                              <p>{annotation.content}</p>
                            </div>
                          ))}
                          {annotations.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              暂无标注
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </ResizablePanel>
              <ResizableHandle />
            </>
          )}
          
          {/* Main PDF viewer */}
          <ResizablePanel defaultSize={showOutline || showAnnotations ? 75 : 100}>
            <div className="h-full overflow-hidden" ref={containerRef as React.RefObject<HTMLDivElement>}>
              <ScrollArea className="h-full w-full">
                <div className="relative" ref={pdfViewerRef}>
                  {/* PDF Viewer Component */}
                  <div 
                    style={{ 
                      transform: `scale(${zoomLevel / 100})`,
                      transformOrigin: 'top left',
                      width: `${100 * (100 / zoomLevel)}%`
                    }}
                  >
                    <EmbedPDFPlaceholder
                      src={src}
                      width="100%"
                      height="100vh"
                      onLoad={handlePDFLoad}
                      onError={handlePDFError}
                      onPageChange={handlePageChange}
                    />
                  </div>
                  
                  {/* Block Overlay - only if sync is enabled */}
                  {syncEnabled && blockData.length > 0 && showBlockOverlays && (
                    <PDFBlockOverlay
                      blocks={blockData}
                      pageNumber={currentPage}
                      pageSize={[595, 842]} // Standard A4 size
                      scale={zoomLevel / 100}
                      rotation={0}
                      selectedBlock={selectedBlock}
                      highlightedBlocks={highlightedBlocks}
                      syncEnabled={showBlockOverlays}
                      onBlockClick={onBlockClick}
                      onBlockHover={onBlockHover}
                      className="z-10"
                    />
                  )}
                  
                  {/* Search result highlights */}
                  {searchResults.map((result, index) => {
                    if (result.page !== currentPage) return null;
                    
                    return (
                      <div
                        key={index}
                        className={`
                          absolute border-2 pointer-events-none
                          ${index === currentSearchIndex ? 'border-blue-500 bg-blue-200/30' : 'border-yellow-500 bg-yellow-200/30'}
                        `}
                        style={{
                          left: result.bounds.x * (zoomLevel / 100),
                          top: result.bounds.y * (zoomLevel / 100),
                          width: result.bounds.width * (zoomLevel / 100),
                          height: result.bounds.height * (zoomLevel / 100),
                        }}
                      />
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default EmbedPDFViewer;