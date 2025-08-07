/**
 * ContentEnhancementOverlay Component
 * 在原始内容后直接显示AI增强结果（翻译/解释）的覆盖层
 */

import React, { useMemo, useEffect, useRef } from 'react';
import { Languages, Copy, MessageSquare, RefreshCw, ChevronDown, ChevronUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import type { ContentEnhancementOverlayProps } from './types';
import { CompactMarkdownViewer } from './CompactMarkdownViewer';

const ContentEnhancementOverlay: React.FC<ContentEnhancementOverlayProps> = ({
  blockIndex,
  originalContent: _originalContent,
  translationContent,
  isStreaming,
  streamContent,
  overlayType = 'translate',
  onRefresh
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [showScrollHint, setShowScrollHint] = React.useState(false);
  const userScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  
  // 检测用户是否正在滚动
  useEffect(() => {
    const handleScroll = () => {
      userScrollingRef.current = true;
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        userScrollingRef.current = false;
      }, 150); // 用户停止滚动150ms后重置标记
    };
    
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);
  
  // 智能滚动提示 - 仅在内容不在视口内时显示
  useEffect(() => {
    if (!isStreaming) {
      setShowScrollHint(false);
      return;
    }
    
    let rafId: number;
    let lastCheckTime = 0;
    const CHECK_INTERVAL = 500; // 每500ms检查一次，避免过于频繁
    
    const checkVisibility = () => {
      const now = Date.now();
      if (now - lastCheckTime < CHECK_INTERVAL) {
        rafId = requestAnimationFrame(checkVisibility);
        return;
      }
      lastCheckTime = now;
      
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        // 检查内容是否在视口内（给一些缓冲区）
        const buffer = 100;
        const isVisible = rect.top >= -buffer && rect.top <= window.innerHeight + buffer;
        // 如果内容不在视口内且用户没有在滚动，显示提示
        setShowScrollHint(!isVisible && !userScrollingRef.current);
      }
      
      rafId = requestAnimationFrame(checkVisibility);
    };
    
    rafId = requestAnimationFrame(checkVisibility);
    
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isStreaming]);
  
  // 手动滚动到内容
  const scrollToContent = React.useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      setShowScrollHint(false);
    }
  }, []);
  
  // 复制翻译内容到剪贴板
  const handleCopyTranslation = React.useCallback(async () => {
    const contentToCopy = translationContent || streamContent;
    if (!contentToCopy) return;
    
    try {
      await navigator.clipboard.writeText(contentToCopy);
      toast.success('翻译内容已复制到剪贴板');
    } catch (error) {
      console.error('Copy failed:', error);
      toast.error('复制失败');
    }
  }, [translationContent, streamContent]);

  // 如果没有翻译内容且不在流式传输，不显示
  if (!translationContent && !isStreaming) {
    return null;
  }

  // 显示的翻译内容
  const displayContent = translationContent || streamContent || '';
  
  // 使用 useMemo 缓存标题栏
  const headerSection = useMemo(() => {
    const isExplain = overlayType === 'explain';
    const Icon = isExplain ? MessageSquare : Languages;
    const label = isExplain ? '解释' : '翻译';
    const colorClass = isExplain ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400';
    const bgClass = isExplain ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    
    return (
      <div className="flex items-center justify-between mb-2 min-w-0">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Icon className={`w-3 h-3 ${colorClass}`} />
          <span className={`text-xs ${bgClass} px-1.5 py-0.5 rounded whitespace-nowrap`}>
            {label}
          </span>
        </div>
      
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* 流式状态指示 */}
        {isStreaming && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">生成中...</span>
          </div>
        )}
        
          {/* 刷新按钮 */}
          {displayContent && (
            <button
              onClick={() => {
                if (onRefresh) {
                  onRefresh();
                } else {
                  console.log('Refresh clicked but no handler provided');
                }
              }}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              title={`重新生成${overlayType === 'explain' ? '解释' : '翻译'}`}
              disabled={isStreaming}
            >
              <RefreshCw className="w-3 h-3 text-gray-500" />
            </button>
          )}
          
          {/* 复制按钮 */}
          {displayContent && (
            <button
              onClick={handleCopyTranslation}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              title={`复制${overlayType === 'explain' ? '解释' : '翻译'}内容`}
            >
              <Copy className="w-3 h-3 text-gray-500" />
            </button>
          )}
          
          {/* 折叠/展开按钮 */}
          {displayContent && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              title={isCollapsed ? '展开内容' : '折叠内容'}
            >
              {isCollapsed ? (
                <ChevronDown className="w-3 h-3 text-gray-500" />
              ) : (
                <ChevronUp className="w-3 h-3 text-gray-500" />
              )}
            </button>
          )}
        </div>
      </div>
    );
  }, [blockIndex, isStreaming, displayContent, handleCopyTranslation, overlayType, onRefresh, isCollapsed]);

  // 使用 useMemo 缓存内容区域
  const contentSection = useMemo(() => {
    if (isCollapsed) return null;
    
    return (
      <div className="text-sm leading-relaxed w-full overflow-x-auto">
        {isStreaming && !displayContent ? (
          // 流式加载提示
          <div className="text-gray-400">
            {overlayType === 'explain' ? '正在生成解释...' : '正在翻译...'}
          </div>
        ) : (
          // 使用 CompactMarkdownViewer 渲染 Markdown 内容
          <div className="relative w-full">
            <CompactMarkdownViewer 
              content={displayContent}
              overlayType={overlayType}
            />
          </div>
        )}
      </div>
    );
  }, [isStreaming, displayContent, overlayType, isCollapsed]);

  const containerClass = overlayType === 'explain' 
    ? "mt-2 p-3 bg-green-50/50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded relative w-full box-border"
    : "mt-2 p-3 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded relative w-full box-border";
  
  return (
    <>
      <div ref={containerRef} className={containerClass} data-overlay-type={overlayType}>
        {headerSection}
        {contentSection}
      </div>
      
      {/* 滚动提示 - 固定在屏幕底部 */}
      {showScrollHint && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
          <button
            onClick={scrollToContent}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-colors animate-pulse"
          >
            <ArrowDown className="w-4 h-4" />
            <span className="text-sm">
              {overlayType === 'explain' ? '正在生成解释...' : '正在翻译...'}
            </span>
          </button>
        </div>
      )}
    </>
  );
};

// 使用 React.memo 并提供优化的比较函数
export default React.memo(ContentEnhancementOverlay, (prevProps, nextProps) => {
  // 如果正在流式传输，只比较关键属性，允许 streamContent 更新
  if (nextProps.isStreaming) {
    return (
      prevProps.blockIndex === nextProps.blockIndex &&
      prevProps.translationContent === nextProps.translationContent &&
      prevProps.isStreaming === nextProps.isStreaming
      // 不比较 streamContent，让它可以更新
    );
  }
  
  // 如果不在流式传输，比较所有属性
  return (
    prevProps.blockIndex === nextProps.blockIndex &&
    prevProps.translationContent === nextProps.translationContent &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.streamContent === nextProps.streamContent
  );
});