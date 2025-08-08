/**
 * PDFBlockOverlay Component
 * Renders interactive block overlays on PDF pages for the sync feature
 */

import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { BlockData, BlockSelection } from '../../types';
import { BlockProcessor } from '../../utils/blockProcessor';

export interface PDFBlockOverlayProps {
  /** Block data for the current page */
  blocks: BlockData[];
  /** Current page number */
  pageNumber: number;
  /** PDF page dimensions */
  pageSize: [number, number];
  /** Display scale factor */
  scale: number;
  /** Currently selected block */
  selectedBlock: BlockSelection;
  /** Highlighted blocks */
  highlightedBlocks: number[];
  /** Whether sync is enabled */
  syncEnabled: boolean;
  /** Callback for block click */
  onBlockClick?: (blockIndex: number, pageNumber: number) => void;
  /** Callback for block hover */
  onBlockHover?: (blockIndex: number | null, pageNumber: number) => void;
  /** CSS class name */
  className?: string;
  /** Whether the user is currently dragging (for performance optimization) */
  isDragging?: boolean;
}

export const PDFBlockOverlay: React.FC<PDFBlockOverlayProps> = ({
  blocks,
  pageNumber,
  pageSize,
  scale: _scale, // Keep for interface compatibility but unused
  selectedBlock,
  highlightedBlocks,
  syncEnabled,
  onBlockClick,
  onBlockHover,
  className = '',
  isDragging = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredBlock, setHoveredBlock] = React.useState<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Canvas uses 100% dimensions to bind with PDF page - no JavaScript scaling needed
  // We'll use percentage-based coordinates instead of absolute scaling
  const canvasWidth = 800; // Fixed reference width for consistent rendering
  const canvasHeight = (canvasWidth * pageSize[1]) / pageSize[0]; // Maintain aspect ratio

  // Filter blocks for current page and sort by semantic reading order (same as Markdown generation)
  const pageBlocks = useMemo(() => {
    const blocksForPage = BlockProcessor.getBlocksForPage(blocks, pageNumber);
    // Sort by index (semantic reading order) to match Markdown generation order
    // This ensures consistent mapping between PDF and Markdown content even in complex layouts
    const sorted = blocksForPage.sort((a, b) => a.index - b.index);
    
    // console.log(`📋 PDF Page ${pageNumber} blocks order (by index):`, sorted.map(b => ({
    //   index: b.index,
    //   y: b.bbox[1],
    //   content: b.content.substring(0, 30) + '...'
    // })));
    
    return sorted;
  }, [blocks, pageNumber]);

  // Draw blocks on canvas
  const drawBlocks = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !syncEnabled) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw blocks in reverse order so larger blocks are drawn first (lower z-index)
    // This ensures smaller blocks appear on top for better interaction
    const blocksToRender = [...pageBlocks].reverse();
    blocksToRender.forEach((block) => {
      const isSelected = selectedBlock.blockIndex === block.index && selectedBlock.isActive;
      const isHighlighted = highlightedBlocks.includes(block.index);
      const isHovered = hoveredBlock === block.index;

      // Get color scheme
      const colorScheme = BlockProcessor.getBlockColorScheme(block.type);

      // Convert to percentage-based coordinates - no scaling needed
      const [bboxX1, bboxY1, bboxX2, bboxY2] = block.bbox;
      const [pageWidth, pageHeight] = pageSize;
      
      // Normalize coordinates to [0,1] range
      const normalizedX1 = bboxX1 / pageWidth;
      const normalizedY1 = bboxY1 / pageHeight;
      const normalizedX2 = bboxX2 / pageWidth;  
      const normalizedY2 = bboxY2 / pageHeight;
      
      // Map to canvas dimensions
      const x1 = normalizedX1 * canvasWidth;
      const y1 = normalizedY1 * canvasHeight;
      const x2 = normalizedX2 * canvasWidth;
      const y2 = normalizedY2 * canvasHeight;
      
      // 扩展右边和下边边界，避免框线遮挡文字
      const rightPadding = 4; // 向右扩展4像素
      const bottomPadding = 4; // 向下扩展4像素
      
      const adjustedX2 = x2 + rightPadding;
      const adjustedY2 = y2 + bottomPadding;
      
      const width = adjustedX2 - x1;
      const height = adjustedY2 - y1;

      // Determine block style based on state
      let borderColor = colorScheme.border;
      let backgroundColor = colorScheme.background;
      let lineWidth = 1;
      let alpha = 0.6;

      if (isSelected) {
        lineWidth = 2; // 调整为正常粗度
        alpha = 0.8;
        borderColor = '#EF4444'; // red-500 for selection (原始红色)
        backgroundColor = 'rgba(239, 68, 68, 0.15)'; // 原始红色背景，稍微加深一点
      } else if (isHighlighted) {
        lineWidth = 2;
        alpha = 0.7;
      } else if (isHovered) {
        lineWidth = 2;
        alpha = 0.8;
        borderColor = '#3B82F6'; // blue-500 for hover
        backgroundColor = 'rgba(59, 130, 246, 0.1)'; // 浅蓝色背景
      }

      // Draw block background
      ctx.fillStyle = backgroundColor;
      ctx.globalAlpha = alpha;
      ctx.fillRect(x1, y1, width, height);

      // Draw block border
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = lineWidth;
      ctx.globalAlpha = 1;
      ctx.strokeRect(x1, y1, width, height);

    });
  }, [
    pageBlocks,
    pageSize,
    canvasWidth,
    canvasHeight,
    selectedBlock,
    highlightedBlocks,
    hoveredBlock,
    syncEnabled,
    isDragging
  ]);

  // RAF-driven redraw scheduler with performance optimization
  const scheduleRedraw = useCallback(() => {
    if (animationFrameRef.current) return; // Already scheduled
    
    if (isDragging) {
      // High-performance mode: prioritize smooth animation over precision
      animationFrameRef.current = requestAnimationFrame(() => {
        drawBlocks();
        animationFrameRef.current = null;
      });
    } else {
      // High-precision mode: slight delay for better accuracy
      animationFrameRef.current = requestAnimationFrame(() => {
        drawBlocks();
        animationFrameRef.current = null;
      });
    }
  }, [drawBlocks, isDragging]);

  // Handle canvas click
  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!syncEnabled || !onBlockClick) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Convert click coordinates to canvas space
      const canvasX = (x / rect.width) * canvasWidth;
      const canvasY = (y / rect.height) * canvasHeight;

      // Find clicked block using percentage-based coordinates
      for (const block of pageBlocks) {
        const [bboxX1, bboxY1, bboxX2, bboxY2] = block.bbox;
        const [pageWidth, pageHeight] = pageSize;
        
        // Convert block coordinates to canvas space
        const blockX1 = (bboxX1 / pageWidth) * canvasWidth;
        const blockY1 = (bboxY1 / pageHeight) * canvasHeight;
        const blockX2 = (bboxX2 / pageWidth) * canvasWidth;
        const blockY2 = (bboxY2 / pageHeight) * canvasHeight;
        
        // 应用与绘制时相同的扩展，确保点击区域与视觉区域一致
        const adjustedBlockX2 = blockX2 + 4; // 向右扩展4像素
        const adjustedBlockY2 = blockY2 + 4; // 向下扩展4像素
        
        // Check if click is inside block
        if (canvasX >= blockX1 && canvasX <= adjustedBlockX2 && 
            canvasY >= blockY1 && canvasY <= adjustedBlockY2) {
          onBlockClick(block.index, pageNumber);
          return;
        }
      }

      // Click outside blocks - clear selection
      onBlockClick(-1, pageNumber);
    },
    [syncEnabled, onBlockClick, pageBlocks, pageNumber, pageSize, canvasWidth, canvasHeight]
  );

  // Handle canvas mouse move
  const handleCanvasMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!syncEnabled) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Convert mouse coordinates to canvas space
      const canvasX = (x / rect.width) * canvasWidth;
      const canvasY = (y / rect.height) * canvasHeight;

      // Find hovered block using percentage-based coordinates
      let foundBlock: number | null = null;
      for (const block of pageBlocks) {
        const [bboxX1, bboxY1, bboxX2, bboxY2] = block.bbox;
        const [pageWidth, pageHeight] = pageSize;
        
        // Convert block coordinates to canvas space
        const blockX1 = (bboxX1 / pageWidth) * canvasWidth;
        const blockY1 = (bboxY1 / pageHeight) * canvasHeight;
        const blockX2 = (bboxX2 / pageWidth) * canvasWidth;
        const blockY2 = (bboxY2 / pageHeight) * canvasHeight;
        
        // 应用与绘制时相同的扩展，确保hover区域与视觉区域一致
        const adjustedBlockX2 = blockX2 + 3; // 向右扩展3像素
        const adjustedBlockY2 = blockY2 + 3; // 向下扩展3像素
        
        // Check if mouse is inside block
        if (canvasX >= blockX1 && canvasX <= adjustedBlockX2 && 
            canvasY >= blockY1 && canvasY <= adjustedBlockY2) {
          foundBlock = block.index;
          break;
        }
      }

      if (foundBlock !== hoveredBlock) {
        setHoveredBlock(foundBlock);
        if (onBlockHover) {
          onBlockHover(foundBlock, pageNumber);
        }
      }

      // Update cursor
      canvas.style.cursor = foundBlock !== null ? 'pointer' : 'default';
    },
    [syncEnabled, pageBlocks, pageNumber, pageSize, canvasWidth, canvasHeight, hoveredBlock, onBlockHover]
  );

  // Handle canvas mouse leave
  const handleCanvasMouseLeave = useCallback(() => {
    if (hoveredBlock !== null) {
      setHoveredBlock(null);
      if (onBlockHover) {
        onBlockHover(null, pageNumber);
      }
    }
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'default';
    }
  }, [hoveredBlock, onBlockHover, pageNumber]);

  // Schedule redraw when dependencies change using RAF
  useEffect(() => {
    scheduleRedraw();
  }, [scheduleRedraw]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Schedule redraw using RAF
    scheduleRedraw();
  }, [canvasWidth, canvasHeight, scheduleRedraw]);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, []);

  if (!syncEnabled) {
    return null;
  }

  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-auto"
        width={canvasWidth}
        height={canvasHeight}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={handleCanvasMouseLeave}
        style={{
          width: '100%', // CSS 100% width - binds to PDF page size
          height: '100%', // CSS 100% height - binds to PDF page size
          imageRendering: 'crisp-edges',
          objectFit: 'fill' // Ensure canvas fills the container exactly
        }}
        title="点击区块进行同步对照"
      />
      
    </div>
  );
};

export default PDFBlockOverlay;