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
    return blocksForPage.sort((a, b) => a.index - b.index);
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

      // Only draw blocks that are selected, highlighted, or hovered
      // Skip drawing default blocks to keep PDF clean
      if (!isSelected && !isHighlighted && !isHovered) {
        return; // Skip this block - no visual rendering
      }

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
      
      // Map to canvas dimensions - 使用 Math.round 确保像素对齐
      const x1 = Math.round(normalizedX1 * canvasWidth);
      const y1 = Math.round(normalizedY1 * canvasHeight);
      const x2 = Math.round(normalizedX2 * canvasWidth);
      const y2 = Math.round(normalizedY2 * canvasHeight);
      
      // 扩展所有边界，让框线更宽松
      const leftPadding = 2; // 向左扩展2像素
      const topPadding = 2; // 向上扩展2像素
      const rightPadding = 6; // 向右扩展6像素 (原4+2)
      const bottomPadding = 6; // 向下扩展6像素 (原4+2)
      
      const adjustedX1 = x1 - leftPadding;
      const adjustedY1 = y1 - topPadding;
      const adjustedX2 = x2 + rightPadding;
      const adjustedY2 = y2 + bottomPadding;
      
      const width = adjustedX2 - adjustedX1;
      const height = adjustedY2 - adjustedY1;

      // Determine block style based on state - 与 Markdown 保持一致
      let borderColor = '';
      let backgroundColor = '';
      let lineWidth = 1;
      let alpha = 1; // 使用完全不透明度，颜色已经包含透明度

      if (isSelected) {
        lineWidth = 1; // 与 Markdown 一致：1px 边框
        borderColor = '#EF4444'; // red-500 与 Markdown 一致
        backgroundColor = 'rgba(239, 68, 68, 0.15)'; // 与 Markdown 一致
      } else if (isHighlighted) {
        lineWidth = 1;
        borderColor = colorScheme.border;
        backgroundColor = colorScheme.background;
      } else if (isHovered) {
        lineWidth = 1; // 与 Markdown 一致：1px 边框
        borderColor = '#3B82F6'; // blue-500 与 Markdown 一致
        backgroundColor = 'rgba(59, 130, 246, 0.1)'; // 与 Markdown 一致
      }

      // Draw rounded rectangle with 4px radius (与 Markdown 一致)
      const borderRadius = 4;
      
      // 为 1px 边框进行半像素偏移，确保清晰
      const drawX = adjustedX1 + 0.5;
      const drawY = adjustedY1 + 0.5;
      const drawWidth = width - 1;
      const drawHeight = height - 1;
      
      // Draw block background with rounded corners
      ctx.fillStyle = backgroundColor;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.roundRect(adjustedX1, adjustedY1, width, height, borderRadius);
      ctx.fill();

      // Draw block border with rounded corners - 使用半像素偏移
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = lineWidth;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.roundRect(drawX, drawY, drawWidth, drawHeight, borderRadius);
      ctx.stroke();

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
        const adjustedBlockX1 = blockX1 - 2; // 向左扩展2像素
        const adjustedBlockY1 = blockY1 - 2; // 向上扩展2像素
        const adjustedBlockX2 = blockX2 + 6; // 向右扩展6像素
        const adjustedBlockY2 = blockY2 + 6; // 向下扩展6像素
        
        // Check if click is inside block
        if (canvasX >= adjustedBlockX1 && canvasX <= adjustedBlockX2 && 
            canvasY >= adjustedBlockY1 && canvasY <= adjustedBlockY2) {
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
        const adjustedBlockX1 = blockX1 - 2; // 向左扩展2像素
        const adjustedBlockY1 = blockY1 - 2; // 向上扩展2像素
        const adjustedBlockX2 = blockX2 + 6; // 向右扩展6像素
        const adjustedBlockY2 = blockY2 + 6; // 向下扩展6像素
        
        // Check if mouse is inside block
        if (canvasX >= adjustedBlockX1 && canvasX <= adjustedBlockX2 && 
            canvasY >= adjustedBlockY1 && canvasY <= adjustedBlockY2) {
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
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // 设置 Canvas 渲染质量，确保边缘清晰
    ctx.imageSmoothingEnabled = false;

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