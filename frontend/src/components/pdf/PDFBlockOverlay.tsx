/**
 * PDF区块叠加组件
 * 在PDF页面上显示区块高亮和标记
 */

import React, { useMemo, useCallback } from 'react';
import { ProcessingBlock, BlockSyncState } from '@/types';
import {
  extractBlockPositions,
  getBlockColorScheme,
  getBlockAtPoint,
  PageDimensions,
  PDFBlockPosition
} from '@/utils/pdfCoordinates';

interface PDFBlockOverlayProps {
  blocks: ProcessingBlock[];
  pageNumber: number;
  pageDimensions: PageDimensions;
  scale: number;
  blockSyncState: BlockSyncState;
  onBlockClick?: (blockIndex: number) => void;
  onBlockHover?: (blockIndex: number | null) => void;
  className?: string;
}

export const PDFBlockOverlay: React.FC<PDFBlockOverlayProps> = ({
  blocks,
  pageNumber,
  pageDimensions,
  scale,
  blockSyncState,
  onBlockClick,
  onBlockHover,
  className = ''
}) => {
  // 计算当前页面的区块位置
  const blockPositions = useMemo(() => {
    const pageDimensionsMap = new Map();
    pageDimensionsMap.set(pageNumber, pageDimensions);
    return extractBlockPositions(blocks, pageDimensionsMap, scale);
  }, [blocks, pageNumber, pageDimensions, scale]);

  // 过滤出当前页面的区块
  const pageBlocks = useMemo(() => {
    return blocks.filter(block => {
      const blockPageNum = block.page_num || 1;
      return blockPageNum === pageNumber;
    });
  }, [blocks, pageNumber]);

  // 处理鼠标点击事件
  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!onBlockClick) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const point = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };

    const blockIndex = getBlockAtPoint(point, blockPositions, pageNumber);
    if (blockIndex !== null) {
      onBlockClick(blockIndex);
    }
  }, [onBlockClick, blockPositions, pageNumber]);

  // 处理鼠标悬停事件
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!onBlockHover) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const point = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };

    const blockIndex = getBlockAtPoint(point, blockPositions, pageNumber);
    onBlockHover(blockIndex);
  }, [onBlockHover, blockPositions, pageNumber]);

  const handleMouseLeave = useCallback(() => {
    if (onBlockHover) {
      onBlockHover(null);
    }
  }, [onBlockHover]);

  // 渲染单个区块标记
  const renderBlockMarker = (block: ProcessingBlock, position: PDFBlockPosition) => {
    const blockId = `block-${block.index}`;
    const isSelected = blockSyncState.selectedBlockId === blockId;
    const isHighlighted = blockSyncState.highlightedBlocks.has(blockId);
    const colorScheme = getBlockColorScheme(block.type);

    let backgroundColor = colorScheme.backgroundColor;
    let borderColor = colorScheme.borderColor;

    if (isSelected) {
      backgroundColor = colorScheme.selectedColor;
      borderColor = colorScheme.borderColor;
    } else if (isHighlighted) {
      backgroundColor = colorScheme.hoverColor;
    }

    return (
      <div
        key={`block-${block.index}`}
        className="absolute pointer-events-none transition-all duration-200"
        style={{
          left: position.x,
          top: position.y,
          width: position.width,
          height: position.height,
          backgroundColor,
          border: `2px solid ${borderColor}`,
          borderRadius: '4px',
          zIndex: isSelected ? 20 : 10
        }}
      >
        {/* 区块序号标签 */}
        <div
          className="absolute -top-1 -left-1 min-w-[20px] h-5 flex items-center justify-center text-xs font-medium text-white rounded"
          style={{
            backgroundColor: borderColor,
            fontSize: '11px',
            lineHeight: '1'
          }}
        >
          {block.index + 1}
        </div>

        {/* 悬停时显示内容预览 */}
        {isHighlighted && block.content && (
          <div
            className="absolute top-full left-0 mt-1 max-w-xs p-2 text-xs bg-gray-900 text-white rounded shadow-lg z-30 pointer-events-none"
            style={{
              wordBreak: 'break-word',
              maxHeight: '120px',
              overflowY: 'auto'
            }}
          >
            <div className="font-medium mb-1 text-gray-300">
              {block.type.toUpperCase()} #{block.index + 1}
            </div>
            <div className="line-clamp-4">
              {block.content.slice(0, 200)}
              {block.content.length > 200 ? '...' : ''}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`absolute inset-0 pointer-events-auto cursor-pointer ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        width: pageDimensions.width * scale,
        height: pageDimensions.height * scale
      }}
    >
      {/* 渲染所有区块标记 */}
      {pageBlocks.map(block => {
        const position = blockPositions.get(block.index);
        if (!position || position.pageNumber !== pageNumber) {
          return null;
        }
        return renderBlockMarker(block, position);
      })}

      {/* 调试信息（开发环境下显示） */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-2 right-2 text-xs bg-black/50 text-white px-2 py-1 rounded">
          Page {pageNumber} | Blocks: {pageBlocks.length} | Scale: {scale.toFixed(2)}
        </div>
      )}
    </div>
  );
};

export default PDFBlockOverlay;