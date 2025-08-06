/**
 * DocumentViewer Component
 * Displays OCR results with markdown rendering, image gallery, and search functionality
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ModernMarkdownViewer } from './markdown/ModernMarkdownViewer';
import { BlockMarkdownViewer } from './markdown/BlockMarkdownViewer';
import { FilePreview } from './FilePreview';
import './markdown/markdown-styles.css';
import { 
  Search, 
  Download, 
  Copy, 
  Eye, 
  FileText,
  Image,
  Maximize2,
  X,
  Type,
  Monitor,
  ArrowLeftRight,
  RotateCw
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'; // 不再使用，改为自定义标签页
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Separator } from './ui/separator';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "./ui/resizable";
import { useAppStore, useUIActions } from '../store/appStore';
import { ImageResource, ProcessingBlock } from '../types';
import { apiClient } from '../api/client';
import { useToast } from '../hooks/use-toast';
import { useBlockSync } from '../hooks/useBlockSync';
import { useScrollSync } from '../hooks/useScrollSync';
import { createBlockInteractionManager } from '../utils/blockInteraction';
import { extractBlocksFromMiddleData, validateMiddleData } from '../utils/blockProcessor';

// 独立的Markdown内容组件，防止PDF状态变化导致重渲染
const MarkdownContentPanel = React.memo(({ 
  processedMarkdown, 
  markdownZoom 
}: { 
  processedMarkdown: string; 
  markdownZoom: number; 
}) => {
  // 调试：监控重渲染
  console.log('🔄 MarkdownContentPanel render', { markdownLength: processedMarkdown.length, markdownZoom });
  
  return (
    <div className="flex-1 overflow-hidden">
      <ScrollArea className="h-full w-full">
        <div className="p-3 pr-4 min-w-0 w-full">
          <ModernMarkdownViewer 
            content={processedMarkdown}
            className="w-full min-w-0"
            fontSize={markdownZoom}
          />
        </div>
      </ScrollArea>
    </div>
  );
}, (prevProps, nextProps) => {
  // 严格比较：只有markdown内容或字体大小变化时才重渲染
  const contentSame = prevProps.processedMarkdown === nextProps.processedMarkdown;
  const zoomSame = prevProps.markdownZoom === nextProps.markdownZoom;
  const shouldNotRerender = contentSame && zoomSame;
  
  if (!shouldNotRerender) {
    console.log('📝 MarkdownContentPanel will re-render:', { 
      contentSame, 
      zoomSame,
      prevZoom: prevProps.markdownZoom,
      nextZoom: nextProps.markdownZoom
    });
  }
  
  return shouldNotRerender;
});

// Enhanced Markdown panel with block synchronization support
const SyncMarkdownContentPanel = React.memo(({ 
  processedMarkdown,
  markdownZoom,
  blocks,
  blockSyncState,
  onBlockClick,
  onBlockHover
}: { 
  processedMarkdown: string; 
  markdownZoom: number;
  blocks: ProcessingBlock[];
  blockSyncState: any;
  onBlockClick: (blockIndex: number) => void;
  onBlockHover: (blockIndex: number | null) => void;
}) => {
  console.log('🔄 SyncMarkdownContentPanel render', { 
    markdownLength: processedMarkdown.length, 
    markdownZoom,
    blocksCount: blocks.length,
    blockSyncEnabled: !!blockSyncState
  });
  
  return (
    <div className="flex-1 overflow-hidden">
      <ScrollArea className="h-full w-full">
        <div className="p-3 pr-4 min-w-0 w-full">
          {blocks.length > 0 && blockSyncState ? (
            <BlockMarkdownViewer
              content={processedMarkdown}
              blocks={blocks}
              blockSyncState={blockSyncState}
              onBlockClick={onBlockClick}
              onBlockHover={onBlockHover}
            />
          ) : (
            <ModernMarkdownViewer 
              content={processedMarkdown}
              className="w-full min-w-0"
              fontSize={markdownZoom}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}, (prevProps, nextProps) => {
  const contentSame = prevProps.processedMarkdown === nextProps.processedMarkdown;
  const zoomSame = prevProps.markdownZoom === nextProps.markdownZoom;
  const blocksSame = prevProps.blocks.length === nextProps.blocks.length &&
    prevProps.blocks.every((block, i) => block.index === nextProps.blocks[i]?.index);
  const syncStateSame = prevProps.blockSyncState?.selectedBlockId === nextProps.blockSyncState?.selectedBlockId;
  
  const shouldNotRerender = contentSame && zoomSame && blocksSame && syncStateSame;
  
  if (!shouldNotRerender) {
    console.log('📝 SyncMarkdownContentPanel will re-render:', { 
      contentSame, 
      zoomSame,
      blocksSame,
      syncStateSame
    });
  }
  
  return shouldNotRerender;
});

// 独立的PDF预览组件，防止任务列表展开/收起导致重渲染
const PDFPreviewPanel = React.memo(({
  task,
  selectedPage,
  onPageSelect,
  onRotate,
  externalPageRotations,
  // 区块叠加相关props
  blocks,
  blockSyncState,
  onBlockClick,
  onBlockHover,
  enableBlockOverlay
}: {
  task: any;
  selectedPage: number | null;
  onPageSelect: (page: number) => void;
  onRotate: (page: number) => void;
  externalPageRotations: { [pageNumber: number]: number };
  // 区块叠加相关props
  blocks?: ProcessingBlock[];
  blockSyncState?: any;
  onBlockClick?: (blockIndex: number) => void;
  onBlockHover?: (blockIndex: number | null) => void;
  enableBlockOverlay?: boolean;
}) => {
  // 调试：监控重渲染
  console.log('📄 PDFPreviewPanel render', { 
    taskId: task.id, 
    selectedPage, 
    rotationsCount: Object.keys(externalPageRotations).length,
    blocksCount: blocks?.length || 0,
    blockOverlayEnabled: enableBlockOverlay
  });
  
  return (
    <div className="flex-1 overflow-hidden">
      <FilePreview 
        key={`shared-${task.id}`}
        task={task} 
        className="h-full" 
        hideToolbar={true}
        selectedPage={selectedPage}
        onPageSelect={onPageSelect}
        onRotate={onRotate}
        externalPageRotations={externalPageRotations}
        // 传递区块叠加相关props
        blocks={blocks}
        blockSyncState={blockSyncState}
        onBlockClick={onBlockClick}
        onBlockHover={onBlockHover}
        enableBlockOverlay={enableBlockOverlay}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  // 严格比较：只有PDF相关状态变化时才重渲染
  const taskSame = prevProps.task.id === nextProps.task.id && 
                   prevProps.task.filename === nextProps.task.filename &&
                   prevProps.task.status === nextProps.task.status;
  const selectedPageSame = prevProps.selectedPage === nextProps.selectedPage;
  const rotationsSame = JSON.stringify(prevProps.externalPageRotations) === JSON.stringify(nextProps.externalPageRotations);
  const callbacksSame = prevProps.onPageSelect === nextProps.onPageSelect && 
                        prevProps.onRotate === nextProps.onRotate;
  
  // 比较区块叠加相关props
  const blocksSame = prevProps.blocks === nextProps.blocks;
  const blockSyncStateSame = prevProps.blockSyncState === nextProps.blockSyncState;
  const blockCallbacksSame = prevProps.onBlockClick === nextProps.onBlockClick && 
                            prevProps.onBlockHover === nextProps.onBlockHover;
  const blockOverlaySame = prevProps.enableBlockOverlay === nextProps.enableBlockOverlay;
  
  const shouldNotRerender = taskSame && selectedPageSame && rotationsSame && callbacksSame && 
                           blocksSame && blockSyncStateSame && blockCallbacksSame && blockOverlaySame;
  
  if (!shouldNotRerender) {
    console.log('📄 PDFPreviewPanel will re-render:', { 
      taskSame, 
      selectedPageSame, 
      rotationsSame,
      callbacksSame,
      taskId: nextProps.task.id,
      selectedPage: nextProps.selectedPage
    });
  }
  
  return shouldNotRerender;
});

// 独立的标准预览组件，防止任务列表展开/收起导致重渲染
const StandardPreviewPanel = React.memo(({
  task
}: {
  task: any;
}) => {
  // 调试：监控重渲染
  console.log('👁️ StandardPreviewPanel render', { taskId: task.id });
  
  return (
    <div className="w-full h-full">
      <FilePreview key={`shared-${task.id}`} task={task} className="w-full h-full" />
    </div>
  );
}, (prevProps, nextProps) => {
  // 严格比较：只有任务相关属性变化时才重渲染
  const taskSame = prevProps.task.id === nextProps.task.id && 
                   prevProps.task.filename === nextProps.task.filename &&
                   prevProps.task.status === nextProps.task.status &&
                   prevProps.task.file_type === nextProps.task.file_type;
  
  if (!taskSame) {
    console.log('👁️ StandardPreviewPanel will re-render:', { 
      taskId: nextProps.task.id,
      filename: nextProps.task.filename,
      status: nextProps.task.status
    });
  }
  
  return taskSame;
});

import { getStaticFileUrl } from '../config';

interface DocumentViewerProps {
  className?: string;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ className = '' }) => {
  const { searchQuery, setSearchQuery, currentTaskId, results, tasks, loadResult, activeDocumentTab } = useAppStore();
  const { setActiveDocumentTab } = useUIActions();
  const { toast } = useToast();
  
  // PDF操作状态管理
  const [pdfSelectedPage, setPdfSelectedPage] = useState<number | null>(null);
  const [pdfPageRotations, setPdfPageRotations] = useState<{ [pageNumber: number]: number }>({});
  
  // Block synchronization state
  const [blockSyncEnabled, setBlockSyncEnabled] = useState(true);
  const [interactionManager] = useState(() => createBlockInteractionManager());
  
  // Calculate current result and task directly - must be before using them
  const currentResult = currentTaskId ? results.get(currentTaskId) || null : null;
  const currentTask = currentTaskId ? tasks.find(task => task.id === currentTaskId) || null : null;
  
  // Extract blocks from middle data
  const blocks = useMemo(() => {
    if (!currentResult?.middle_data || !validateMiddleData(currentResult.middle_data)) {
      return [];
    }
    return extractBlocksFromMiddleData(currentResult.middle_data);
  }, [currentResult?.middle_data]);
  
  // Block synchronization hooks
  const blockSync = useBlockSync({
    blocks,
    markdownContent: currentResult?.markdown_content || '',
    enableScrollSync: blockSyncEnabled,
    onBlockChange: (blockId) => {
      console.log('Block changed:', blockId);
    }
  });
  
  // Scroll synchronization hook - currently passive but available for future use
  const _scrollSync = useScrollSync({
    enabled: blockSyncEnabled && blockSync.blockSyncState.scrollSyncEnabled,
    blockSyncState: blockSync.blockSyncState,
    blocks,
    onBlockInView: () => {
      // Optionally highlight the block that's currently in view
      // blockSync.highlightBlock(blockIndex, true);
    },
    throttleMs: 150
  });
  
  // Prevent unused variable warning
  void _scrollSync;
  
  // PDF操作处理函数 - 使用useCallback稳定化
  const handlePdfRotate = React.useCallback((pageNumber: number) => {
    setPdfPageRotations(prev => ({
      ...prev,
      [pageNumber]: ((prev[pageNumber] || 0) + 90) % 360
    }));
  }, []);

  const handlePdfPageSelect = React.useCallback((pageNumber: number) => {
    setPdfSelectedPage(pageNumber);
  }, []);
  
  // Block interaction handlers
  const handleBlockClick = useCallback(async (blockIndex: number) => {
    if (!interactionManager) return;
    
    await interactionManager.handleBlockClick(
      blockIndex,
      'markdown',
      (targetBlockIndex, targetSource) => {
        if (targetSource === 'pdf') {
          blockSync.selectBlock(targetBlockIndex);
        }
      },
      blockSync.blockSyncState
    );
  }, [interactionManager, blockSync]);
  
  const handleBlockHover = useCallback((blockIndex: number | null) => {
    if (!interactionManager) return;
    
    interactionManager.handleBlockHover(
      blockIndex,
      'markdown',
      blockSync.blockSyncState
    );
  }, [interactionManager, blockSync]);
  
  // Toggle block synchronization
  const toggleBlockSync = useCallback(() => {
    setBlockSyncEnabled(prev => !prev);
    blockSync.toggleScrollSync();
  }, [blockSync]);
  
  
  // Debug logging (双重渲染是React.StrictMode的正常开发行为)
  React.useEffect(() => {
    console.log('📱 DocumentViewer render - currentTaskId:', currentTaskId);
    console.log('📱 DocumentViewer render - currentResult:', currentResult);
    console.log('📱 DocumentViewer render - results Map:', results);
    if (currentResult?.images) {
      console.log('🖼️ Images found:', currentResult.images.length);
      currentResult.images.forEach((img, i) => {
        console.log(`🖼️ Image ${i}:`, img.url);
      });
    }
  }, [currentTaskId, currentResult, results]);
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [activeSearchQuery, setActiveSearchQuery] = useState(''); // 实际用于搜索的查询词
  const [selectedImage, setSelectedImage] = useState<ImageResource | null>(null);
  // 字号设置: 0=小(85%), 1=中(100%), 2=大(120%)
  const [fontSizeLevel, setFontSizeLevel] = useState(0);
  const fontSizes = [85, 100, 120];
  const fontLabels = ['小', '中', '大'];
  const markdownZoom = fontSizes[fontSizeLevel];

  // 自动加载OCR结果逻辑：当选择新任务且任务已完成但结果未加载时
  React.useEffect(() => {
    const loadTaskResult = async () => {
      if (currentTask && currentTask.status === 'completed' && !currentResult) {
        try {
          console.log(`🔄 Auto-loading result for completed task: ${currentTask.id}`);
          await loadResult(currentTask.id);
        } catch (error) {
          console.error('Failed to auto-load task result:', error);
          toast({
            variant: "destructive",
            description: "加载OCR结果失败",
          });
        }
      }
    };
    
    loadTaskResult();
  }, [currentTask?.id, currentTask?.status, currentResult, loadResult, toast]);
  
  // Cleanup interaction manager on unmount
  useEffect(() => {
    return () => {
      interactionManager?.cleanup();
    };
  }, [interactionManager]);

  // Process markdown content with search highlighting
  const processedMarkdown = useMemo(() => {
    if (!currentResult?.markdown_content || !activeSearchQuery.trim()) {
      return currentResult?.markdown_content || '';
    }

    const query = activeSearchQuery.trim();
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    
    return currentResult.markdown_content.replace(regex, '<mark class="search-highlight">$1</mark>');
  }, [currentResult?.markdown_content, activeSearchQuery]);

  // Handle search input
  const handleSearchChange = (value: string) => {
    setLocalSearchQuery(value);
  };

  // Handle search execution (on Enter key)
  const handleSearchExecute = () => {
    setActiveSearchQuery(localSearchQuery);
    setSearchQuery(localSearchQuery);
  };

  // Handle search input key press
  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearchExecute();
    }
  };

  // Handle font size change
  const handleFontSizeChange = () => {
    setFontSizeLevel(prev => (prev + 1) % 3);
  };

  // Handle copy to clipboard
  const handleCopyMarkdown = async () => {
    if (currentResult?.markdown_content) {
      try {
        await navigator.clipboard.writeText(currentResult.markdown_content);
        toast({
          description: "已复制到剪贴板",
        });
      } catch (error) {
        console.error('Failed to copy markdown:', error);
        toast({
          variant: "destructive",
          description: "复制失败",
        });
      }
    }
  };

  // Handle download
  const handleDownload = async () => {
    if (!currentTaskId) return;
    
    try {
      toast({
        description: "开始下载...",
      });
      
      // Download the result file as blob
      const blob = await apiClient.downloadTaskResult(currentTaskId);
      
      // Create download URL and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentTask?.filename || 'document'}_ocr_result.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        variant: "destructive",
        description: "下载失败",
      });
    }
  };

  // Handle image click
  const handleImageClick = (image: ImageResource) => {
    setSelectedImage(image);
  };

  // Format processing time
  const formatProcessingTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };


  if (!currentTask) {
    return (
      <div className={`${className} h-full flex items-center justify-center bg-background`}>
        <div className="flex flex-col items-center space-y-4 p-8">
          <FileText className="w-12 h-12 text-muted-foreground" />
          <div className="space-y-2 text-center">
            <h3 className="text-lg font-semibold">未选择文档</h3>
            <p className="text-muted-foreground">
              请从任务列表中选择一个任务查看预览或 OCR 结果
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Main content - 占满全部空间 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-full flex flex-col">
          {/* 标签页头部 */}
          <div className="border-b flex-shrink-0">
            <div className="grid w-full grid-cols-5 h-10">
              <button 
                onClick={() => setActiveDocumentTab('preview')}
                className={`flex items-center justify-center space-x-1 text-xs transition-colors ${
                  activeDocumentTab === 'preview' 
                    ? 'bg-background text-foreground border-b-2 border-primary' 
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                <Monitor className="w-3 h-3" />
                <span>预览</span>
              </button>
              <button 
                onClick={() => setActiveDocumentTab('compare')}
                disabled={!currentResult}
                className={`flex items-center justify-center space-x-1 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  activeDocumentTab === 'compare' 
                    ? 'bg-background text-foreground border-b-2 border-primary' 
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                <ArrowLeftRight className="w-3 h-3" />
                <span>对照</span>
                {currentTask?.status === 'completed' && currentResult && (
                  <span className="text-xs text-green-500 ml-1">✓</span>
                )}
              </button>
              <button 
                onClick={() => setActiveDocumentTab('content')}
                disabled={!currentResult}
                className={`flex items-center justify-center space-x-1 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  activeDocumentTab === 'content' 
                    ? 'bg-background text-foreground border-b-2 border-primary' 
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                <FileText className="w-3 h-3" />
                <span>内容</span>
                {currentTask?.status === 'completed' && currentResult && (
                  <span className="text-xs text-green-500 ml-1">✓</span>
                )}
              </button>
              <button 
                onClick={() => setActiveDocumentTab('images')}
                disabled={!currentResult}
                className={`flex items-center justify-center space-x-1 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  activeDocumentTab === 'images' 
                    ? 'bg-background text-foreground border-b-2 border-primary' 
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                <Image className="w-3 h-3" />
                <span>图片 ({currentResult?.images.length || 0})</span>
                {currentTask?.status === 'completed' && currentResult && (
                  <span className="text-xs text-green-500 ml-1">✓</span>
                )}
              </button>
              <button 
                onClick={() => setActiveDocumentTab('metadata')}
                disabled={!currentResult}
                className={`flex items-center justify-center space-x-1 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  activeDocumentTab === 'metadata' 
                    ? 'bg-background text-foreground border-b-2 border-primary' 
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                <Eye className="w-3 h-3" />
                <span>详情</span>
                {currentTask?.status === 'completed' && currentResult && (
                  <span className="text-xs text-green-500 ml-1">✓</span>
                )}
              </button>
            </div>
          </div>

          {/* 内容区域 - 所有标签页同时渲染，用CSS控制显示 */}
          <div className="flex-1 relative overflow-hidden">
            {/* Preview tab */}
            <div 
              className={`absolute inset-0 ${
                activeDocumentTab === 'preview' ? 'block' : 'hidden'
              }`}
            >
              {currentTask && <StandardPreviewPanel task={currentTask} />}
            </div>

            {/* Compare tab - Split view */}
            <div 
              className={`absolute inset-0 ${
                activeDocumentTab === 'compare' ? 'block' : 'hidden'
              }`}
            >
              {currentResult && currentTask ? (
                <div className="flex-1 flex flex-col overflow-hidden h-full">
                  {/* Split view content area - 移除统一工具栏 */}
                  <div className="flex-1 overflow-hidden">
                    <ResizablePanelGroup
                      direction="horizontal"
                      className="h-full"
                    >
                      {/* Left panel - Document Preview */}
                      <ResizablePanel 
                        defaultSize={50} 
                        minSize={30}
                        maxSize={70}
                        collapsible={false}
                      >
                        <div className="h-full flex flex-col border-r">
                          {/* 原始文档标题栏 - 包含文档相关信息和操作 */}
                          <div className="bg-muted/5 px-3 py-2 border-b flex-shrink-0">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              {/* 左侧：文档信息 */}
                              <div className="flex items-center space-x-2 min-w-0">
                                <h3 className="text-xs font-medium text-muted-foreground whitespace-nowrap">原始文档</h3>
                                <Badge variant="outline" className="text-xs">
                                  {currentTask.file_type.toUpperCase()}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {currentResult.metadata.extraction_type}
                                </Badge>
                                <Badge variant="outline" className="text-xs truncate max-w-32">
                                  {currentTask.filename}
                                </Badge>
                              </div>
                              
                              {/* 右侧：PDF相关操作按钮 */}
                              <div className="flex items-center space-x-1 flex-shrink-0">
                                <div className="text-xs text-muted-foreground whitespace-nowrap mr-2">
                                  对照查看
                                </div>
                                
                                {/* PDF旋转按钮 */}
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => pdfSelectedPage && handlePdfRotate(pdfSelectedPage)} 
                                  title={pdfSelectedPage ? `旋转第${pdfSelectedPage}页` : "请先点击要旋转的页面"}
                                  disabled={pdfSelectedPage === null}
                                  className="h-7 w-7 p-0"
                                >
                                  <RotateCw className="w-3 h-3" />
                                </Button>
                                
                                {/* 当前页面指示器 */}
                                {pdfSelectedPage && (
                                  <span className="text-xs text-muted-foreground border rounded px-2 py-1 whitespace-nowrap">
                                    第{pdfSelectedPage}页
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <PDFPreviewPanel
                            task={currentTask}
                            selectedPage={pdfSelectedPage}
                            onPageSelect={handlePdfPageSelect}
                            onRotate={handlePdfRotate}
                            externalPageRotations={pdfPageRotations}
                            // 区块叠加相关props
                            blocks={blocks}
                            blockSyncState={blockSync.blockSyncState}
                            onBlockClick={handleBlockClick}
                            onBlockHover={handleBlockHover}
                            enableBlockOverlay={blockSyncEnabled}
                          />
                        </div>
                      </ResizablePanel>
                      
                      <ResizableHandle withHandle />
                      
                      {/* Right panel - OCR Content */}
                      <ResizablePanel 
                        defaultSize={50}
                        minSize={30}
                        maxSize={70}
                        collapsible={false}
                      >
                        <div className="h-full flex flex-col">
                          {/* OCR识别内容标题栏 - 包含识别相关操作 */}
                          <div className="bg-muted/5 px-3 py-2 border-b flex-shrink-0">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              {/* 左侧：标题 */}
                              <div className="flex items-center space-x-2 flex-shrink-0">
                                <h3 className="text-xs font-medium text-muted-foreground whitespace-nowrap">OCR识别内容</h3>
                              </div>
                              
                              {/* 右侧：操作按钮和搜索 */}
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 min-w-0">
                                {/* 操作按钮组 */}
                                <div className="flex items-center space-x-1 flex-shrink-0">
                                  {/* Block sync toggle button */}
                                  <Button 
                                    variant={blockSyncEnabled ? "default" : "outline"}
                                    size="sm" 
                                    onClick={toggleBlockSync}
                                    className="h-7 w-7 p-0"
                                    title={blockSyncEnabled ? "关闭区块同步" : "开启区块同步"}
                                  >
                                    <ArrowLeftRight className="w-3 h-3" />
                                  </Button>
                                  
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={handleFontSizeChange}
                                    className="h-7 w-7 p-0"
                                    title={`字号: ${fontLabels[fontSizeLevel]}`}
                                  >
                                    <Type className="w-3 h-3" />
                                  </Button>
                                  
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={handleCopyMarkdown}
                                    className="h-7 w-7 p-0"
                                    title="复制"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                  
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={handleDownload}
                                    className="h-7 w-7 p-0"
                                    title="下载"
                                  >
                                    <Download className="w-3 h-3" />
                                  </Button>
                                </div>
                                
                                {/* 搜索框 */}
                                <div className="relative flex-1 min-w-0 sm:max-w-44">
                                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                  <Input
                                    placeholder="搜索..."
                                    value={localSearchQuery}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    onKeyPress={handleSearchKeyPress}
                                    className="pl-7 h-7 text-xs w-full"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                          <SyncMarkdownContentPanel 
                            processedMarkdown={processedMarkdown}
                            markdownZoom={markdownZoom}
                            blocks={blocks}
                            blockSyncState={blockSync.blockSyncState}
                            onBlockClick={handleBlockClick}
                            onBlockHover={handleBlockHover}
                          />
                        </div>
                      </ResizablePanel>
                    </ResizablePanelGroup>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <ArrowLeftRight className="w-8 h-8 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">
                      等待OCR处理完成以查看对照视图
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Content tab */}
            <div 
              className={`absolute inset-0 ${
                activeDocumentTab === 'content' ? 'block' : 'hidden'
              }`}
            >
            {currentResult ? (
              <div className="flex-1 flex flex-col overflow-hidden h-full">
                {/* Content tab toolbar */}
                <div className="border-b bg-muted/5 flex-shrink-0">
                  <div className="p-3">
                    <div className="flex items-center gap-3">
                      {/* Left: Title and badges */}
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <h2 className="text-sm font-semibold">文档查看器</h2>
                        <Badge variant="outline" className="text-xs">
                          {currentTask.file_type}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {currentResult.metadata.extraction_type}
                        </Badge>
                      </div>
                      
                      {/* Middle: Action buttons */}
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleFontSizeChange}
                          className="h-8 w-8 p-0"
                          title={`字号: ${fontLabels[fontSizeLevel]}`}
                        >
                          <Type className="w-3.5 h-3.5" />
                        </Button>
                        
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleCopyMarkdown}
                          className="h-8 w-8 p-0"
                          title="复制"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleDownload}
                          className="h-8 w-8 p-0"
                          title="下载"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      
                      {/* Right: Search bar - fills remaining space */}
                      <div className="relative flex-1">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                        <Input
                          placeholder="在文档内容中搜索...（按回车搜索）"
                          value={localSearchQuery}
                          onChange={(e) => handleSearchChange(e.target.value)}
                          onKeyPress={handleSearchKeyPress}
                          className="pl-8 h-8 text-xs w-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Content area */}
                <MarkdownContentPanel 
                  processedMarkdown={processedMarkdown}
                  markdownZoom={markdownZoom}
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <FileText className="w-8 h-8 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    等待OCR处理完成以查看内容
                  </p>
                </div>
              </div>
            )}
            </div>

            {/* Images tab */}
            <div 
              className={`absolute inset-0 ${
                activeDocumentTab === 'images' ? 'block' : 'hidden'
              }`}
            >
            {currentResult ? (
              <div className="flex-1 p-3 overflow-hidden h-full">
                <ScrollArea className="h-full w-full">
                  {currentResult.images.length === 0 ? (
                    <div className="text-center py-8">
                      <Image className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">此文档中未找到图片</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {currentResult.images.map((image, index) => (
                      <div
                        key={index}
                        className="group relative aspect-square overflow-hidden rounded border bg-muted cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => handleImageClick(image)}
                      >
                        <img
                          src={image.url.startsWith('http') ? image.url : getStaticFileUrl(image.url.replace('/static/', ''))}
                          alt={image.alt || image.filename}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            console.error('Image failed to load:', image.url);
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <Maximize2 className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-1">
                          <p className="text-xs truncate">{image.filename}</p>
                        </div>
                      </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <Image className="w-8 h-8 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    等待OCR处理完成以查看提取的图片
                  </p>
                </div>
              </div>
            )}
            </div>

            {/* Metadata tab */}
            <div 
              className={`absolute inset-0 ${
                activeDocumentTab === 'metadata' ? 'block' : 'hidden'
              }`}
            >
            {currentResult ? (
              <div className="flex-1 p-3 overflow-hidden h-full">
                <ScrollArea className="h-full w-full">
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold">处理信息</h4>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">提取类型：</span>
                            <Badge variant="outline" className="text-xs">{currentResult.metadata.extraction_type}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">处理时间：</span>
                            <span>{formatProcessingTime(currentResult.metadata.processing_time)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">总页数：</span>
                            <span>{currentResult.metadata.total_pages}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">文件大小：</span>
                            <span>{formatFileSize(currentResult.metadata.file_size)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold">内容统计</h4>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">字符数：</span>
                            <span>{currentResult.markdown_content.length.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">单词数：</span>
                            <span>{currentResult.markdown_content.split(/\s+/).length.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">行数：</span>
                            <span>{currentResult.markdown_content.split('\n').length.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">图片数：</span>
                            <span>{currentResult.images.length}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">下载选项</h4>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={handleDownload}>
                          <Download className="w-3 h-3 mr-1" />
                          <span className="text-xs">原始 ZIP</span>
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleCopyMarkdown}>
                          <Copy className="w-3 h-3 mr-1" />
                          <span className="text-xs">复制 Markdown</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <Eye className="w-8 h-8 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    等待OCR处理完成以查看详细信息
                  </p>
                </div>
              </div>
            )}
            </div>
          </div>
          </div>
      </div>

      {/* Image preview dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedImage?.filename}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedImage(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          {selectedImage && (
            <div className="flex items-center justify-center">
              <img
                src={selectedImage.url.startsWith('http') ? selectedImage.url : getStaticFileUrl(selectedImage.url.replace('/static/', ''))}
                alt={selectedImage.alt || selectedImage.filename}
                className="max-w-full max-h-[60vh] object-contain rounded-lg"
                onError={() => {
                  console.error('Modal image failed to load:', selectedImage.url);
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentViewer;