/**
 * DocumentViewer Component
 * Displays OCR results with markdown rendering, image gallery, and search functionality
 */

import React, { useState, useMemo, useEffect } from 'react';
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
import { ImageResource, BlockData } from '../types';
import { apiClient } from '../api/client';
import { useToast } from '../hooks/use-toast';
import { useBlockSync } from '../hooks/useBlockSync';
import { useScrollSync } from '../hooks/useScrollSync';
import { BlockMarkdownGenerator } from '../utils/blockMarkdownGenerator';

// 独立的Markdown内容组件，防止PDF状态变化导致重渲染
const MarkdownContentPanel = React.memo(({ 
  processedMarkdown, 
  markdownZoom
}: { 
  processedMarkdown: string; 
  markdownZoom: number;
}) => {
  // 调试：监控重渲染
  // MarkdownContentPanel render
  
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

// 增强的区块同步Markdown组件
const BlockSyncMarkdownPanel = React.memo(({ 
  originalMarkdown,
  markdownZoom,
  blockData,
  selectedBlock,
  highlightedBlocks,
  syncEnabled,
  onBlockClick,
  activeSearchQuery,
  taskId,
  onMarkdownGenerated
}: { 
  originalMarkdown: string;
  markdownZoom: number;
  blockData: BlockData[];
  selectedBlock: any;
  highlightedBlocks: number[];
  syncEnabled: boolean;
  onBlockClick?: (blockIndex: number) => void;
  activeSearchQuery?: string;
  taskId?: string;
  onMarkdownGenerated?: (markdown: string) => void;
}) => {
  // 生成基于区块的Markdown内容
  const blockBasedMarkdown = useMemo(() => {
    if (!syncEnabled || blockData.length === 0) {
      return originalMarkdown;
    }
    
    // Generate markdown from blocks
    const generated = BlockMarkdownGenerator.generateFromBlocks(blockData, taskId || undefined);
    
    return generated;
  }, [blockData, syncEnabled, originalMarkdown, taskId]);
  
  // Use effect to notify parent component about generated markdown
  useEffect(() => {
    if (onMarkdownGenerated && syncEnabled && blockData.length > 0) {
      onMarkdownGenerated(blockBasedMarkdown);
    }
  }, [blockBasedMarkdown, onMarkdownGenerated, syncEnabled, blockData.length]);

  // 应用搜索高亮
  const processedMarkdown = useMemo(() => {
    if (!activeSearchQuery?.trim()) {
      return blockBasedMarkdown;
    }

    const query = activeSearchQuery.trim();
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    
    return blockBasedMarkdown.replace(regex, '<mark class="search-highlight">$1</mark>');
  }, [blockBasedMarkdown, activeSearchQuery]);
  
  // BlockSyncMarkdownPanel render
  
  return (
    <div className="flex-1 overflow-hidden">
      <ScrollArea className="h-full w-full">
        <div className="p-3 pr-4 min-w-0 w-full">
          <BlockMarkdownViewer 
            content={processedMarkdown}
            blockData={blockData}
            selectedBlock={selectedBlock}
            highlightedBlocks={highlightedBlocks}
            syncEnabled={syncEnabled}
            onBlockClick={onBlockClick}
            fontSize={markdownZoom}
            className="w-full min-w-0"
          />
        </div>
      </ScrollArea>
    </div>
  );
}, (prevProps, nextProps) => {
  // 比较所有相关props
  const originalMarkdownSame = prevProps.originalMarkdown === nextProps.originalMarkdown;
  const zoomSame = prevProps.markdownZoom === nextProps.markdownZoom;
  const blockDataSame = prevProps.blockData === nextProps.blockData;
  const selectedBlockSame = JSON.stringify(prevProps.selectedBlock) === JSON.stringify(nextProps.selectedBlock);
  const highlightedSame = JSON.stringify(prevProps.highlightedBlocks) === JSON.stringify(nextProps.highlightedBlocks);
  const syncEnabledSame = prevProps.syncEnabled === nextProps.syncEnabled;
  const searchSame = prevProps.activeSearchQuery === nextProps.activeSearchQuery;
  const callbacksSame = prevProps.onBlockClick === nextProps.onBlockClick;
  
  const shouldNotRerender = originalMarkdownSame && zoomSame && blockDataSame && selectedBlockSame && 
                           highlightedSame && syncEnabledSame && searchSame && callbacksSame;
  
  // if (!shouldNotRerender) {
  //   BlockSyncMarkdownPanel will re-render
  // }
  
  return shouldNotRerender;
});

// 独立的PDF预览组件，防止任务列表展开/收起导致重渲染
const PDFPreviewPanel = React.memo(({
  task,
  selectedPage,
  onPageSelect,
  onRotate,
  externalPageRotations,
  blockData,
  selectedBlock,
  highlightedBlocks,
  syncEnabled,
  onBlockClick,
  pdfContainerRef
}: {
  task: any;
  selectedPage: number | null;
  onPageSelect: (page: number) => void;
  onRotate: (page: number) => void;
  externalPageRotations: { [pageNumber: number]: number };
  blockData?: BlockData[];
  selectedBlock?: any;
  highlightedBlocks?: number[];
  syncEnabled?: boolean;
  onBlockClick?: (blockIndex: number, pageNumber: number) => void;
  pdfContainerRef?: React.RefObject<HTMLElement>;
}) => {
  // PDFPreviewPanel render
  
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
        blockData={blockData}
        selectedBlock={selectedBlock}
        highlightedBlocks={highlightedBlocks}
        syncEnabled={syncEnabled}
        onBlockClick={onBlockClick}
        containerRef={pdfContainerRef}
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
  const blockDataSame = prevProps.blockData === nextProps.blockData;
  const selectedBlockSame = JSON.stringify(prevProps.selectedBlock) === JSON.stringify(nextProps.selectedBlock);
  const highlightedBlocksSame = JSON.stringify(prevProps.highlightedBlocks) === JSON.stringify(nextProps.highlightedBlocks);
  const syncEnabledSame = prevProps.syncEnabled === nextProps.syncEnabled;
  const callbacksSame = prevProps.onPageSelect === nextProps.onPageSelect && 
                        prevProps.onRotate === nextProps.onRotate &&
                        prevProps.onBlockClick === nextProps.onBlockClick;
  const refSame = prevProps.pdfContainerRef === nextProps.pdfContainerRef;
  
  const shouldNotRerender = taskSame && selectedPageSame && rotationsSame && 
                           blockDataSame && selectedBlockSame && highlightedBlocksSame && 
                           syncEnabledSame && callbacksSame && refSame;
  
  // if (!shouldNotRerender) {
  //   PDFPreviewPanel will re-render
  // }
  
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
  
  // 区块同步状态管理
  const [blockData, setBlockData] = useState<BlockData[]>([]);
  const [blockDataLoading, setBlockDataLoading] = useState(false);
  const [loadedTaskId, setLoadedTaskId] = useState<string | null>(null); // 跟踪已加载区块数据的任务ID
  
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
  
  // Calculate current result and task directly
  const currentResult = currentTaskId ? results.get(currentTaskId) || null : null;
  const currentTask = currentTaskId ? tasks.find(task => task.id === currentTaskId) || null : null;
  
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

  // 加载区块数据：当结果加载完成且处于对照标签页时，或切换任务时
  React.useEffect(() => {
    const loadBlockData = async () => {
      // 检查是否需要加载区块数据：
      // 1. 有结果和任务ID
      // 2. 处于对照标签页
      // 3. 不在加载中
      // 4. 任务ID发生变化（包括首次加载或切换文件）
      const shouldLoad = currentResult && 
                        currentTaskId && 
                        activeDocumentTab === 'compare' && 
                        !blockDataLoading && 
                        loadedTaskId !== currentTaskId;

      if (shouldLoad) {
        setBlockDataLoading(true);
        
        // 如果是切换任务，先清空之前的数据
        if (loadedTaskId !== null && loadedTaskId !== currentTaskId) {
          console.log(`🔄 Switching from task ${loadedTaskId} to ${currentTaskId}, clearing previous block data`);
          setBlockData([]);
        }
        
        try {
          console.log(`🔄 Loading block data for task: ${currentTaskId}`);
          const response = await apiClient.getTaskBlockData(currentTaskId);
          if (response.success && response.data?.preproc_blocks) {
            setBlockData(response.data.preproc_blocks);
            setLoadedTaskId(currentTaskId); // 记录已加载的任务ID
            
            // Debug: 验证index顺序和排序修复效果
            const blocks = response.data.preproc_blocks;
            console.log(`✅ Loaded ${blocks.length} blocks for task ${currentTaskId}`);
            console.log('🔍 Block index verification:', blocks.map(b => ({
              index: b.index,
              page: b.page_num,
              y_coord: b.bbox[1],
              content_preview: b.content.substring(0, 30) + '...'
            })));
            
            // 检查index是否连续
            const indices = blocks.map(b => b.index).sort((a, b) => a - b);
            const isSequential = indices.every((val, i) => val === i + 1);
            console.log(`🎯 Index sequence check: ${isSequential ? '✅ SEQUENTIAL' : '❌ NOT SEQUENTIAL'}`, indices);
          } else {
            console.warn(`Block data not available for task ${currentTaskId}`);
            // 即使没有区块数据，也要记录已尝试加载
            setBlockData([]);
            setLoadedTaskId(currentTaskId);
          }
        } catch (error) {
          console.error('Failed to load block data:', error);
          // 发生错误时也要记录已尝试加载，避免重复尝试
          setBlockData([]);
          setLoadedTaskId(currentTaskId);
        } finally {
          setBlockDataLoading(false);
        }
      }
    };
    
    loadBlockData();
  }, [currentResult, currentTaskId, activeDocumentTab, blockDataLoading, loadedTaskId]);

  // 清理区块数据：当离开对照标签页时
  React.useEffect(() => {
    if (activeDocumentTab !== 'compare' && blockData.length > 0) {
      console.log('📤 Leaving compare tab, clearing block data to free memory');
      setBlockData([]);
      // 重要：同时重置loadedTaskId，确保回到对照页面时会重新加载数据
      setLoadedTaskId(null);
      console.log('🔄 Reset loadedTaskId to null, will reload block data when returning to compare tab');
    }
  }, [activeDocumentTab, blockData.length]);

  // 重置状态：当任务切换时，确保相关状态被正确重置
  React.useEffect(() => {
    // 当任务切换时，重置PDF选择状态和旋转状态
    setPdfSelectedPage(null);
    setPdfPageRotations({});
    
    // 如果loadedTaskId与currentTaskId不匹配，说明需要重新加载数据
    if (loadedTaskId && loadedTaskId !== currentTaskId) {
      console.log(`🔄 Task changed from ${loadedTaskId} to ${currentTaskId}, will reload block data on next compare tab visit`);
      // 不立即清空loadedTaskId，让区块数据加载逻辑去处理
    }
  }, [currentTaskId, loadedTaskId]);

  // Process markdown content with search highlighting
  const processedMarkdown = useMemo(() => {
    if (!currentResult?.markdown_content || !activeSearchQuery.trim()) {
      return currentResult?.markdown_content || '';
    }

    const query = activeSearchQuery.trim();
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    
    return currentResult.markdown_content.replace(regex, '<mark class="search-highlight">$1</mark>');
  }, [currentResult?.markdown_content, activeSearchQuery]);

  // 初始化区块同步hooks
  const blockSyncEnabled = blockData.length > 0 && activeDocumentTab === 'compare';
  const blockSync = useBlockSync({
    blockData: blockData,
    enabled: blockSyncEnabled,
    onSelectionChange: (selection) => {
      console.log('Block selection changed:', selection);
    },
    onBlockInteraction: (blockIndex, action) => {
      console.log('Block interaction:', blockIndex, action);
    }
  });

  // 初始化滚动同步hooks
  const scrollSync = useScrollSync({
    blockData: blockData,
    markdownContent: processedMarkdown,
    enabled: blockSyncEnabled && blockSync.isScrollSyncEnabled,
    selectedBlock: blockSync.selectedBlock,
    debounceDelay: 50 // 减少debounce延迟以提高响应速度
  });

  // Markdown → PDF 滚动同步：监听区块选择变化并触发PDF滚动
  // 跟踪最后一次Markdown点击的时间戳，用于区分用户操作和自动同步
  const lastMarkdownClickRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (!blockSyncEnabled || !blockSync.selectedBlock.isActive || !blockSync.selectedBlock.blockIndex) {
      return;
    }

    // 简化逻辑：只检查是否是最近的用户点击（缩短到500ms）
    const currentTime = Date.now();
    const timeSinceLastClick = currentTime - lastMarkdownClickRef.current;
    
    // 如果距离最后一次点击超过500ms，认为这不是用户主动操作，跳过滚动
    if (timeSinceLastClick > 500) {
      console.log(`⏭️  Block selection not from recent user click (${timeSinceLastClick}ms ago), skipping scroll`);
      return;
    }
    
    const blockIndex = blockSync.selectedBlock.blockIndex;
    console.log(`🔄 Block ${blockIndex} selected from recent Markdown click, triggering immediate PDF scroll`);
    
    // 立即响应，移除requestAnimationFrame延迟
    scrollSync.scrollToBlockInPdf(blockIndex);
  }, [blockSync.selectedBlock.blockIndex, blockSync.selectedBlock.isActive, blockSyncEnabled, scrollSync]);


  // 包装Markdown点击处理函数，记录点击时间戳并立即触发PDF滚动
  const handleMarkdownBlockClickWithTimestamp = React.useCallback((blockIndex: number) => {
    lastMarkdownClickRef.current = Date.now();
    console.log(`📝 Markdown block ${blockIndex} clicked, triggering immediate sync`);
    
    // 立即处理区块选择
    blockSync.handleMarkdownBlockClick(blockIndex);
    
    // 如果同步已启用，立即触发PDF滚动而不等待useEffect
    if (blockSyncEnabled) {
      console.log(`⚡ Immediate PDF scroll trigger for block ${blockIndex}`);
      scrollSync.scrollToBlockInPdf(blockIndex);
    }
  }, [blockSync, blockSyncEnabled, scrollSync]);

  // Handle search input
  const handleSearchChange = (value: string) => {
    setLocalSearchQuery(value);
  };

  // Handle search execution (on Enter key)
  const handleSearchExecute = () => {
    setActiveSearchQuery(localSearchQuery);
    setSearchQuery(localSearchQuery);
  };

  // Handle search input key down (替换弃用的onKeyPress)
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearchExecute();
    }
  };

  // Handle font size change
  const handleFontSizeChange = () => {
    setFontSizeLevel(prev => (prev + 1) % 3);
  };

  // Store the generated block-based markdown for copying
  const [blockBasedMarkdownForCopy, setBlockBasedMarkdownForCopy] = React.useState<string>('');

  // Handle copy to clipboard
  const handleCopyMarkdown = async () => {
    // In compare tab with block sync enabled, copy the regenerated content
    // Otherwise, copy the original markdown content
    const contentToCopy = (activeDocumentTab === 'compare' && blockSyncEnabled && blockBasedMarkdownForCopy) 
      ? blockBasedMarkdownForCopy 
      : currentResult?.markdown_content;
      
    if (contentToCopy) {
      try {
        await navigator.clipboard.writeText(contentToCopy);
        const message = (activeDocumentTab === 'compare' && blockSyncEnabled && blockBasedMarkdownForCopy)
          ? "已复制重新拼接的内容到剪贴板"
          : "已复制到剪贴板";
        toast({
          description: message,
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
                            blockData={blockData}
                            selectedBlock={blockSync.selectedBlock}
                            highlightedBlocks={blockSync.highlightedBlocks}
                            syncEnabled={blockSync.isSyncEnabled}
                            onBlockClick={blockSync.handlePdfBlockClick}
                            pdfContainerRef={scrollSync.pdfContainerRef}
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
                              {/* 左侧：标题和同步状态 */}
                              <div className="flex items-center space-x-2 flex-shrink-0">

                              </div>
                              
                              {/* 右侧：操作按钮和搜索 */}
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 min-w-0">
                                {/* 操作按钮组 */}
                                <div className="flex items-center space-x-1 flex-shrink-0">
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
                                    onKeyDown={handleSearchKeyDown}
                                    className="pl-7 h-7 text-xs w-full"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                          {blockSyncEnabled ? (
                            <BlockSyncMarkdownPanel 
                              originalMarkdown={currentResult?.markdown_content || ''}
                              markdownZoom={markdownZoom}
                              blockData={blockData}
                              selectedBlock={blockSync.selectedBlock}
                              highlightedBlocks={blockSync.highlightedBlocks}
                              syncEnabled={blockSync.isSyncEnabled}
                              onBlockClick={handleMarkdownBlockClickWithTimestamp}
                              activeSearchQuery={activeSearchQuery}
                              onMarkdownGenerated={setBlockBasedMarkdownForCopy}
                            />
                          ) : (
                            <MarkdownContentPanel 
                              processedMarkdown={processedMarkdown}
                              markdownZoom={markdownZoom}
                            />
                          )}
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
                          onKeyDown={handleSearchKeyDown}
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