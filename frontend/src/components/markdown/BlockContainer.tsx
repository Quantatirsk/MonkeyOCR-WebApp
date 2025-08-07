/**
 * BlockContainer Component
 * 处理区块容器的渲染和翻译覆盖层
 */

import React, { useMemo } from 'react';
import { ContentEnhancementOverlay } from '../translation';
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
  children,
  ...props
}) => {
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
  
  return (
    <div {...props} className="block-container">
      <div className="block-content-wrapper">
        {children}
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