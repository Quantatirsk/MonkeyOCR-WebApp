/**
 * BlockContainer Component
 * 处理区块容器的渲染和翻译覆盖层
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { ContentEnhancementOverlay } from '../translation';
import { BlockHoverActions } from './BlockHoverActions';
import { BlockData } from '../../types';
import { BlockProcessor } from '../../utils/blockProcessor';

interface BlockContainerProps {
  blockIndex: number;
  blockData: BlockData[];
  translations: Map<number, string> | undefined;
  explanations: Map<number, string> | undefined;
  streamingTranslation: {
    blockIndex: number;
    content: string;
    isStreaming: boolean;
    type?: 'translate' | 'explain';
  } | undefined;
  onRefreshTranslation?: (blockIndex: number) => void;
  onRefreshExplanation?: (blockIndex: number) => void;
  onTranslateBlock?: (blockIndex: number) => void;
  onExplainBlock?: (blockIndex: number) => void;
  onMarkBlock?: (blockIndex: number) => void;
  children: React.ReactNode;
  [key: string]: any;
}

export const BlockContainer: React.FC<BlockContainerProps> = React.memo(({
  blockIndex,
  blockData,
  translations,
  explanations,
  streamingTranslation,
  onRefreshTranslation,
  onRefreshExplanation,
  onTranslateBlock,
  onExplainBlock,
  onMarkBlock,
  children,
  ...props
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [shouldShowAbove, setShouldShowAbove] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const currentBlockData = useMemo(() => 
    blockIndex >= 0 ? BlockProcessor.findBlockByIndex(blockData || [], blockIndex) : null,
    [blockIndex, blockData]
  );
  
  // 获取翻译内容
  const translationContent = useMemo(() => 
    translations?.get(blockIndex) || null,
    [translations, blockIndex]
  );
  
  // 获取解释内容
  const explanationContent = useMemo(() => 
    explanations?.get(blockIndex) || null,
    [explanations, blockIndex]
  );
  
  // 检查是否正在流式传输
  const isStreamingForThisBlock = streamingTranslation?.blockIndex === blockIndex;
  const streamContent = isStreamingForThisBlock ? streamingTranslation?.content || '' : '';
  const streamType = isStreamingForThisBlock ? streamingTranslation?.type : null;
  
  // 决定是否显示翻译覆盖层
  const shouldShowTranslation = !!(translationContent || (isStreamingForThisBlock && streamType === 'translate'));
  
  // 决定是否显示解释覆盖层
  const shouldShowExplanation = !!(explanationContent || (isStreamingForThisBlock && streamType === 'explain'));
  
  // 使用 useMemo 缓存翻译覆盖层
  const translationOverlay = useMemo(() => {
    if (!shouldShowTranslation || !currentBlockData) return null;
    
    return (
      <ContentEnhancementOverlay
        blockIndex={blockIndex}
        originalContent={currentBlockData.content || ''}
        translationContent={translationContent}
        isStreaming={isStreamingForThisBlock && streamType === 'translate'}
        streamContent={streamContent}
        overlayType="translate"
        onRefresh={() => onRefreshTranslation?.(blockIndex)}
      />
    );
  }, [
    shouldShowTranslation,
    blockIndex,
    currentBlockData,
    translationContent,
    isStreamingForThisBlock,
    streamContent,
    streamType,
    onRefreshTranslation
  ]);
  
  // 使用 useMemo 缓存解释覆盖层
  const explanationOverlay = useMemo(() => {
    if (!shouldShowExplanation || !currentBlockData) return null;
    
    return (
      <ContentEnhancementOverlay
        blockIndex={blockIndex}
        originalContent={currentBlockData.content || ''}
        translationContent={explanationContent}
        isStreaming={isStreamingForThisBlock && streamType === 'explain'}
        streamContent={streamContent}
        overlayType="explain"
        onRefresh={() => onRefreshExplanation?.(blockIndex)}
      />
    );
  }, [
    shouldShowExplanation,
    blockIndex,
    currentBlockData,
    explanationContent,
    isStreamingForThisBlock,
    streamContent,
    streamType,
    onRefreshExplanation
  ]);
  
  // Calculate whether to show hover actions above or below
  const checkPosition = useCallback(() => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const actionsHeight = 40; // Approximate height of hover actions
    const buffer = 20; // Extra buffer space
    
    // If there's not enough space below but enough space above, show above
    if (spaceBelow < (actionsHeight + buffer) && spaceAbove > (actionsHeight + buffer)) {
      setShouldShowAbove(true);
    } else {
      setShouldShowAbove(false);
    }
  }, []);
  
  // Handle hover events
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    checkPosition();
  }, [checkPosition]);
  
  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);
  
  // Update position when scrolling
  useEffect(() => {
    if (!isHovered) return;
    
    const handleScroll = () => {
      checkPosition();
    };
    
    // Find the markdown scroll container specifically
    const scrollContainer = containerRef.current?.closest('[class*="overflow-"], [class*="scroll-area"]');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHovered, checkPosition]);
  
  // Handle translate
  const handleTranslate = useCallback(() => {
    onTranslateBlock?.(blockIndex);
  }, [blockIndex, onTranslateBlock]);
  
  // Handle explain
  const handleExplain = useCallback(() => {
    onExplainBlock?.(blockIndex);
  }, [blockIndex, onExplainBlock]);
  
  // Handle mark
  const handleMark = useCallback(() => {
    onMarkBlock?.(blockIndex);
  }, [blockIndex, onMarkBlock]);
  
  return (
    <div 
      {...props} 
      ref={containerRef}
      className="block-container"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="block-content-wrapper relative">
        {children}
        
        {/* Block Hover Actions - positioned relative to content wrapper */}
        <BlockHoverActions
          blockIndex={blockIndex}
          blockContent={currentBlockData?.content || ''}
          onTranslate={onTranslateBlock ? handleTranslate : undefined}
          onExplain={onExplainBlock ? handleExplain : undefined}
          onMark={onMarkBlock ? handleMark : undefined}
          visible={isHovered && !streamingTranslation?.isStreaming}
          position={shouldShowAbove ? 'above' : 'below'}
        />
      </div>
      {translationOverlay}
      {explanationOverlay}
    </div>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数，优化重新渲染
  return (
    prevProps.blockIndex === nextProps.blockIndex &&
    prevProps.blockData === nextProps.blockData &&
    prevProps.translations === nextProps.translations &&
    prevProps.explanations === nextProps.explanations &&
    // 对于 streamingTranslation，需要深度比较
    prevProps.streamingTranslation?.blockIndex === nextProps.streamingTranslation?.blockIndex &&
    prevProps.streamingTranslation?.isStreaming === nextProps.streamingTranslation?.isStreaming &&
    prevProps.streamingTranslation?.content === nextProps.streamingTranslation?.content &&
    prevProps.streamingTranslation?.type === nextProps.streamingTranslation?.type &&
    // children 通常不会变化
    prevProps.children === nextProps.children
  );
});

BlockContainer.displayName = 'BlockContainer';