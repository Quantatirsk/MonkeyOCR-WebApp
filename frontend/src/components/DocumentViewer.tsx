/**
 * DocumentViewer Component
 * Main component for displaying OCR results with multiple view modes
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { FileText, ArrowLeftRight, Eye, RotateCw } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "./ui/resizable";

// Sub-components
import { TabNavigation } from './document/TabNavigation';
import { DocumentToolbar } from './document/DocumentToolbar';
import { ImageGallery } from './document/ImageGallery';
import { DocumentMetadata } from './document/DocumentMetadata';
import { FloatingActionBar } from './document/FloatingActionBar';

// Hooks
import { usePdfState } from './document/hooks/usePdfState';
import { useBlockDataLoader } from './document/hooks/useBlockDataLoader';
import { useDocumentSearch } from './document/hooks/useDocumentSearch';

// Constants and utilities
import { TAB_TYPES, FONT_SIZES } from './document/constants';
import { applySearchHighlight } from './document/utils';

// Existing components
import { ModernMarkdownViewer } from './markdown/ModernMarkdownViewer';
import { BlockMarkdownViewer } from './markdown/BlockMarkdownViewer';
import { FilePreview } from './FilePreview';
import { useBlockActions } from './translation';

// Store and API
import { useAppStore, useUIActions } from '../store/appStore';
import { apiClient } from '../api/client';
import { toast } from 'sonner';
import { useBlockSync } from '../hooks/useBlockSync';
import { useScrollSync } from '../hooks/useScrollSync';
import { BlockMarkdownGenerator } from '../utils/blockMarkdownGenerator';

// Styles
import './markdown/markdown-styles.css';
import './translation/animations.css';

interface DocumentViewerProps {
  className?: string;
}

// Memoized Markdown content panel
const MarkdownContentPanel = React.memo(({ 
  processedMarkdown, 
  markdownZoom
}: { 
  processedMarkdown: string; 
  markdownZoom: number;
}) => (
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
));

// Enhanced block sync markdown panel with translation support
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
  onMarkdownGenerated,
  enableTranslationFeatures = true,
  onTranslateAllStatusChange
}: { 
  originalMarkdown: string;
  markdownZoom: number;
  blockData: any[];
  selectedBlock: any;
  highlightedBlocks: number[];
  syncEnabled: boolean;
  onBlockClick?: (blockIndex: number) => void;
  activeSearchQuery?: string;
  taskId?: string;
  onMarkdownGenerated?: (markdown: string) => void;
  enableTranslationFeatures?: boolean;
  onTranslateAllStatusChange?: (isTranslating: boolean, progress?: { completed: number; total: number }) => void;
}) => {
  // Translation functionality integration
  const blockActions = useBlockActions({
    blockData,
    enabled: enableTranslationFeatures && syncEnabled,
    targetLanguage: 'zh'
  });

  // Generate block-based markdown content
  const blockBasedMarkdown = useMemo(() => {
    if (!syncEnabled || blockData.length === 0) {
      return originalMarkdown;
    }
    return BlockMarkdownGenerator.generateFromBlocks(blockData, taskId);
  }, [blockData, syncEnabled, originalMarkdown, taskId]);
  
  // Generate clean markdown for copying (without HTML wrappers)
  const cleanMarkdownForCopy = useMemo(() => {
    if (!syncEnabled || blockData.length === 0) {
      return originalMarkdown;
    }
    return BlockMarkdownGenerator.generateCleanMarkdown(blockData, taskId);
  }, [blockData, syncEnabled, originalMarkdown, taskId]);
  
  // Notify parent about generated markdown (clean version for copying)
  useEffect(() => {
    if (onMarkdownGenerated && syncEnabled && blockData.length > 0) {
      onMarkdownGenerated(cleanMarkdownForCopy);
    }
  }, [cleanMarkdownForCopy, onMarkdownGenerated, syncEnabled, blockData.length]);

  // Apply search highlighting
  const processedMarkdown = useMemo(() => {
    return applySearchHighlight(blockBasedMarkdown, activeSearchQuery || '');
  }, [blockBasedMarkdown, activeSearchQuery]);
  
  // Listen for translation/explanation events from toolbar
  useEffect(() => {
    const handleTranslateEvent = (event: CustomEvent) => {
      const { blockIndex } = event.detail;
      if (blockIndex !== undefined && blockActions.translateBlock) {
        blockActions.translateBlock(blockIndex, false);
      }
    };
    
    const handleExplainEvent = (event: CustomEvent) => {
      const { blockIndex } = event.detail;
      if (blockIndex !== undefined && blockActions.explainBlock) {
        blockActions.explainBlock(blockIndex, false);
      }
    };
    
    const handleTranslateAllEvent = async () => {
      if (blockActions.translateAllBlocks) {
        onTranslateAllStatusChange?.(true);
        await blockActions.translateAllBlocks((completed, total) => {
          onTranslateAllStatusChange?.(true, { completed, total });
        });
        onTranslateAllStatusChange?.(false);
      }
    };
    
    const markdownPanel = document.querySelector('.block-sync-markdown-panel');
    if (markdownPanel) {
      markdownPanel.addEventListener('translate-block', handleTranslateEvent as EventListener);
      markdownPanel.addEventListener('explain-block', handleExplainEvent as EventListener);
      markdownPanel.addEventListener('translate-all', handleTranslateAllEvent as any);
    }
    
    return () => {
      if (markdownPanel) {
        markdownPanel.removeEventListener('translate-block', handleTranslateEvent as EventListener);
        markdownPanel.removeEventListener('explain-block', handleExplainEvent as EventListener);
        markdownPanel.removeEventListener('translate-all', handleTranslateAllEvent as any);
      }
    };
  }, [blockActions, onTranslateAllStatusChange]);
  
  // Keyboard shortcuts
  useEffect(() => {
    if (!enableTranslationFeatures || !syncEnabled) return;
    
    const handleKeyPress = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      
      if (!selectedBlock.isActive || selectedBlock.blockIndex === null) return;
      
      switch (event.key.toLowerCase()) {
        case 'n':
          event.preventDefault();
          blockActions.translateBlock(selectedBlock.blockIndex, false);
          break;
        case 'm':
          event.preventDefault();
          blockActions.explainBlock(selectedBlock.blockIndex, false);
          break;
        case 'escape':
          event.preventDefault();
          blockActions.cancelAction();
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [enableTranslationFeatures, syncEnabled, selectedBlock, blockActions]);
  
  // Streaming translation state
  const streamingTranslation = useMemo(() => {
    if (blockActions.streamingState.isStreaming && 
        (blockActions.streamingState.streamType === 'translate' || 
         blockActions.streamingState.streamType === 'explain')) {
      return {
        blockIndex: blockActions.actionState.selectedBlockIndex || -1,
        content: blockActions.streamingState.streamContent,
        isStreaming: true,
        type: blockActions.streamingState.streamType
      };
    }
    return undefined;
  }, [
    blockActions.streamingState.isStreaming,
    blockActions.streamingState.streamType,
    blockActions.streamingState.streamContent,
    blockActions.actionState.selectedBlockIndex
  ]);
  
  return (
    <div className="flex-1 overflow-hidden block-sync-markdown-panel">
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
            translations={blockActions.actionState.translations}
            explanations={blockActions.actionState.explanations}
            streamingTranslation={streamingTranslation}
            onRefreshTranslation={(blockIndex) => {
              // 防止在处理中重复刷新
              if (blockActions.actionState.processingBlocks.size > 0 || blockActions.streamingState.isStreaming) {
                return;
              }
              // 清除现有翻译并重新生成（使用force参数强制刷新）
              blockActions.clearTranslation(blockIndex);
              setTimeout(() => {
                blockActions.translateBlock(blockIndex, true);
              }, 100); // 短暂延迟确保UI更新
            }}
            onRefreshExplanation={(blockIndex) => {
              // 防止在处理中重复刷新
              if (blockActions.actionState.processingBlocks.size > 0 || blockActions.streamingState.isStreaming) {
                return;
              }
              // 清除现有解释并重新生成（使用force参数强制刷新）
              blockActions.clearExplanation(blockIndex);
              setTimeout(() => {
                blockActions.explainBlock(blockIndex, true);
              }, 100); // 短暂延迟确保UI更新
            }}
          />
        </div>
      </ScrollArea>
    </div>
  );
});

// PDF preview panel
const PDFPreviewPanel = React.memo((props: any) => (
  <div className="flex-1 overflow-hidden">
    <FilePreview 
      key={`shared-${props.task.id}`}
      task={props.task} 
      className="h-full" 
      hideToolbar={true}
      selectedPage={props.selectedPage}
      onPageSelect={props.onPageSelect}
      onRotate={props.onRotate}
      externalPageRotations={props.externalPageRotations}
      blockData={props.blockData}
      selectedBlock={props.selectedBlock}
      highlightedBlocks={props.highlightedBlocks}
      syncEnabled={props.syncEnabled}
      onBlockClick={props.onBlockClick}
      containerRef={props.pdfContainerRef}
    />
  </div>
));

// Standard preview panel
const StandardPreviewPanel = React.memo(({ task }: { task: any }) => (
  <div className="w-full h-full">
    <FilePreview key={`shared-${task.id}`} task={task} className="w-full h-full" />
  </div>
));

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ className = '' }) => {
  const { 
    searchQuery, 
    setSearchQuery, 
    currentTaskId, 
    results, 
    tasks, 
    loadResult, 
    activeDocumentTab 
  } = useAppStore();
  const { setActiveDocumentTab } = useUIActions();

  
  // Get current result and task
  const currentResult = currentTaskId ? results.get(currentTaskId) || null : null;
  const currentTask = currentTaskId ? tasks.find(task => task.id === currentTaskId) || null : null;
  
  // Font size state
  const [fontSizeLevel, setFontSizeLevel] = useState(0);
  const markdownZoom = FONT_SIZES[fontSizeLevel];
  
  // Custom hooks
  const pdfState = usePdfState(currentTaskId || undefined);
  const { blockData } = useBlockDataLoader({
    taskId: currentTaskId,
    hasResult: !!currentResult,
    activeTab: activeDocumentTab,
    enabled: true
  });
  const documentSearch = useDocumentSearch({
    content: currentResult?.markdown_content || '',
    initialQuery: searchQuery
  });
  
  // Block sync hooks
  const blockSyncEnabled = blockData.length > 0 && activeDocumentTab === TAB_TYPES.COMPARE;
  const blockSync = useBlockSync({
    blockData,
    enabled: blockSyncEnabled
  });
  
  const scrollSync = useScrollSync({
    blockData,
    markdownContent: documentSearch.processedContent,
    enabled: blockSyncEnabled && blockSync.isScrollSyncEnabled,
    selectedBlock: blockSync.selectedBlock,
    debounceDelay: 50
  });
  
  // Track markdown click timestamp for sync
  const lastMarkdownClickRef = useRef<number>(0);
  
  // Store generated block-based markdown for copying
  const [blockBasedMarkdownForCopy, setBlockBasedMarkdownForCopy] = useState<string>('');
  
  // 全文翻译状态
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);
  
  // Auto-load OCR results when task is selected
  useEffect(() => {
    const loadTaskResult = async () => {
      if (currentTask && currentTask.status === 'completed' && !currentResult) {
        try {
          await loadResult(currentTask.id);
        } catch (error) {
          console.error('Failed to auto-load task result:', error);
          toast.error("加载OCR结果失败");
        }
      }
    };
    
    loadTaskResult();
  }, [currentTask?.id, currentTask?.status, currentResult, loadResult, toast]);
  
  // Markdown → PDF scroll sync
  useEffect(() => {
    if (!blockSyncEnabled || !blockSync.selectedBlock.isActive || !blockSync.selectedBlock.blockIndex) {
      return;
    }

    const currentTime = Date.now();
    const timeSinceLastClick = currentTime - lastMarkdownClickRef.current;
    
    if (timeSinceLastClick > 500) {
      return;
    }
    
    scrollSync.scrollToBlockInPdf(blockSync.selectedBlock.blockIndex);
  }, [blockSync.selectedBlock.blockIndex, blockSync.selectedBlock.isActive, blockSyncEnabled, scrollSync]);

  // Wrapped markdown click handler
  const handleMarkdownBlockClickWithTimestamp = useCallback((blockIndex: number) => {
    lastMarkdownClickRef.current = Date.now();
    blockSync.handleMarkdownBlockClick(blockIndex);
    
    if (blockSyncEnabled) {
      scrollSync.scrollToBlockInPdf(blockIndex);
    }
  }, [blockSync, blockSyncEnabled, scrollSync]);
  
  // Document actions
  const handleFontSizeChange = useCallback(() => {
    setFontSizeLevel(prev => (prev + 1) % 3);
  }, []);
  
  const handleCopyMarkdown = useCallback(async () => {
    const contentToCopy = (activeDocumentTab === TAB_TYPES.COMPARE && blockSyncEnabled && blockBasedMarkdownForCopy) 
      ? blockBasedMarkdownForCopy 
      : currentResult?.markdown_content;
      
    if (contentToCopy) {
      try {
        await navigator.clipboard.writeText(contentToCopy);
        const message = (activeDocumentTab === TAB_TYPES.COMPARE && blockSyncEnabled && blockBasedMarkdownForCopy)
          ? "已复制拼接内容"
          : "已复制到剪贴板";
        toast.success(message);
      } catch (error) {
        console.error('Failed to copy markdown:', error);
        toast.error("复制失败");
      }
    }
  }, [activeDocumentTab, blockSyncEnabled, blockBasedMarkdownForCopy, currentResult]);
  
  const handleDownload = useCallback(async () => {
    if (!currentTaskId) return;
    
    try {
      toast.info("开始下载...");
      
      const blob = await apiClient.downloadTaskResult(currentTaskId);
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
      toast.error("下载失败");
    }
  }, [currentTaskId, currentTask]);
  
  // Handle block actions
  const handleTranslateBlock = useCallback((blockIndex: number) => {
    const markdownPanel = document.querySelector('.block-sync-markdown-panel');
    if (markdownPanel) {
      const event = new CustomEvent('translate-block', { 
        detail: { blockIndex } 
      });
      markdownPanel.dispatchEvent(event);
    }
  }, []);
  
  const handleExplainBlock = useCallback((blockIndex: number) => {
    const markdownPanel = document.querySelector('.block-sync-markdown-panel');
    if (markdownPanel) {
      const event = new CustomEvent('explain-block', { 
        detail: { blockIndex } 
      });
      markdownPanel.dispatchEvent(event);
    }
  }, []);
  
  // Handle search
  const handleSearch = useCallback((query: string) => {
    documentSearch.executeSearch(query);
    setSearchQuery(query);
  }, [documentSearch, setSearchQuery]);
  
  // 处理全文翻译
  const handleTranslateAll = useCallback(() => {
    const markdownPanel = document.querySelector('.block-sync-markdown-panel');
    if (markdownPanel) {
      const event = new CustomEvent('translate-all');
      markdownPanel.dispatchEvent(event);
    }
  }, []);
  
  // 处理全文翻译状态变化
  const handleTranslateAllStatusChange = useCallback((isTranslating: boolean, progress?: { completed: number; total: number }) => {
    setIsTranslatingAll(isTranslating);
    if (progress) {
      // 显示进度提示
      if (progress.completed < progress.total) {
        toast.info(`翻译进度: ${progress.completed}/${progress.total}`, { 
          id: 'translate-all-progress',
          duration: 1000 
        });
      }
    }
  }, []);

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
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Tab Navigation */}
          <TabNavigation
            activeTab={activeDocumentTab}
            onTabChange={setActiveDocumentTab}
            hasResult={!!currentResult}
            isCompleted={currentTask?.status === 'completed'}
            imageCount={currentResult?.images.length || 0}
          />

          {/* Content Area */}
          <div className="flex-1 relative overflow-hidden">
            {/* Preview tab */}
            <div className={`absolute inset-0 ${activeDocumentTab === TAB_TYPES.PREVIEW ? 'block' : 'hidden'}`}>
              {currentTask && <StandardPreviewPanel task={currentTask} />}
            </div>

            {/* Compare tab - Split view */}
            <div className={`absolute inset-0 ${activeDocumentTab === TAB_TYPES.COMPARE ? 'block' : 'hidden'} document-viewer-container`}>
              {currentResult && currentTask ? (
                <div className="flex-1 flex flex-col overflow-hidden h-full relative">
                  <div className="flex-1 overflow-hidden">
                    <ResizablePanelGroup direction="horizontal" className="h-full">
                      {/* Left panel - Document Preview */}
                      <ResizablePanel defaultSize={50} minSize={30} maxSize={70}>
                        <div className="h-full flex flex-col border-r">
                          <div className="bg-muted/5 px-3 py-2 border-b flex-shrink-0">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                              
                              <div className="flex items-center space-x-1 flex-shrink-0">
                                <div className="text-xs text-muted-foreground whitespace-nowrap mr-2">
                                  对照查看
                                </div>
                                
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => pdfState.selectedPage && pdfState.rotatePage(pdfState.selectedPage)} 
                                  title={pdfState.selectedPage ? `旋转第${pdfState.selectedPage}页` : "请先点击要旋转的页面"}
                                  disabled={pdfState.selectedPage === null}
                                  className="h-7 w-7 p-0"
                                >
                                  <RotateCw className="w-3 h-3" />
                                </Button>
                                
                                {pdfState.selectedPage && (
                                  <span className="text-xs text-muted-foreground border rounded px-2 py-1 whitespace-nowrap">
                                    第{pdfState.selectedPage}页
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <PDFPreviewPanel
                            task={currentTask}
                            selectedPage={pdfState.selectedPage}
                            onPageSelect={pdfState.selectPage}
                            onRotate={pdfState.rotatePage}
                            externalPageRotations={pdfState.pageRotations}
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
                      <ResizablePanel defaultSize={50} minSize={30} maxSize={70}>
                        <div className="h-full flex flex-col">
                          <DocumentToolbar
                            showBlockActions={blockSync.selectedBlock.isActive && blockSyncEnabled}
                            selectedBlockIndex={blockSync.selectedBlock.blockIndex}
                            blockData={blockData}
                            onTranslateBlock={handleTranslateBlock}
                            onExplainBlock={handleExplainBlock}
                            fontSizeLevel={fontSizeLevel}
                            onFontSizeChange={handleFontSizeChange}
                            onCopy={handleCopyMarkdown}
                            onDownload={handleDownload}
                            onTranslateAll={handleTranslateAll}
                            showTranslateAll={blockSyncEnabled}
                            isTranslatingAll={isTranslatingAll}
                            searchQuery={documentSearch.localQuery}
                            onSearch={handleSearch}
                          />
                          {blockSyncEnabled ? (
                            <BlockSyncMarkdownPanel 
                              originalMarkdown={currentResult?.markdown_content || ''}
                              markdownZoom={markdownZoom}
                              blockData={blockData}
                              selectedBlock={blockSync.selectedBlock}
                              highlightedBlocks={blockSync.highlightedBlocks}
                              syncEnabled={blockSync.isSyncEnabled}
                              onBlockClick={handleMarkdownBlockClickWithTimestamp}
                              activeSearchQuery={documentSearch.activeQuery}
                              onMarkdownGenerated={setBlockBasedMarkdownForCopy}
                              onTranslateAllStatusChange={handleTranslateAllStatusChange}
                            />
                          ) : (
                            <MarkdownContentPanel 
                              processedMarkdown={documentSearch.processedContent}
                              markdownZoom={markdownZoom}
                            />
                          )}
                        </div>
                      </ResizablePanel>
                    </ResizablePanelGroup>
                  </div>
                  
                  {/* Floating Action Bar - only visible in compare view */}
                  <FloatingActionBar 
                    visible={activeDocumentTab === TAB_TYPES.COMPARE && !!currentResult}
                    onTranslate={() => {
                      // Trigger translate for selected block or all blocks
                      if (blockSync.selectedBlock.blockIndex !== null) {
                        handleTranslateBlock(blockSync.selectedBlock.blockIndex);
                      } else {
                        handleTranslateAll();
                      }
                    }}
                    onExplain={() => {
                      // Trigger explain for selected block
                      if (blockSync.selectedBlock.blockIndex !== null) {
                        handleExplainBlock(blockSync.selectedBlock.blockIndex);
                      } else {
                        toast.info('请先选择一个区块');
                      }
                    }}
                  />
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
            <div className={`absolute inset-0 ${activeDocumentTab === TAB_TYPES.CONTENT ? 'block' : 'hidden'}`}>
              {currentResult ? (
                <div className="flex-1 flex flex-col overflow-hidden h-full">
                  <DocumentToolbar
                    title="文档查看器"
                    fileType={currentTask.file_type}
                    extractionType={currentResult.metadata.extraction_type}
                    fontSizeLevel={fontSizeLevel}
                    onFontSizeChange={handleFontSizeChange}
                    onCopy={handleCopyMarkdown}
                    onDownload={handleDownload}
                    searchQuery={documentSearch.localQuery}
                    onSearch={handleSearch}
                    searchPlaceholder="在文档内容中搜索...（按回车搜索）"
                  />
                  <MarkdownContentPanel 
                    processedMarkdown={documentSearch.processedContent}
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
            <div className={`absolute inset-0 ${activeDocumentTab === TAB_TYPES.IMAGES ? 'block' : 'hidden'}`}>
              {currentResult ? (
                <ImageGallery 
                  images={currentResult.images}
                  className="h-full"
                />
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <Eye className="w-8 h-8 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">
                      等待OCR处理完成以查看提取的图片
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Metadata tab */}
            <div className={`absolute inset-0 ${activeDocumentTab === TAB_TYPES.METADATA ? 'block' : 'hidden'}`}>
              {currentResult ? (
                <DocumentMetadata
                  metadata={currentResult.metadata}
                  content={currentResult.markdown_content}
                  imageCount={currentResult.images.length}
                  onDownload={handleDownload}
                  onCopy={handleCopyMarkdown}
                  className="h-full"
                />
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
    </div>
  );
};

export default DocumentViewer;