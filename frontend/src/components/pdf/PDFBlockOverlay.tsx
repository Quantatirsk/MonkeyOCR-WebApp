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
  /** Current rotation angle (0, 90, 180, 270) - handled by container CSS transform */
  rotation?: number;
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
  rotation = 0, // Rotation angle in degrees (0, 90, 180, 270)
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

  // Canvas dimensions - swap width/height for 90/270 degree rotations
  const isRotated = rotation === 90 || rotation === 270;
  const baseWidth = 800; // Fixed reference width for consistent rendering
  const baseHeight = (baseWidth * pageSize[1]) / pageSize[0]; // Maintain aspect ratio
  
  // Swap dimensions for rotated pages
  const canvasWidth = isRotated ? baseHeight : baseWidth;
  const canvasHeight = isRotated ? baseWidth : baseHeight;

  // Filter blocks for current page and sort by semantic reading order (same as Markdown generation)
  const pageBlocks = useMemo(() => {
    const blocksForPage = BlockProcessor.getBlocksForPage(blocks, pageNumber);
    // Sort by index (semantic reading order) to match Markdown generation order
    // This ensures consistent mapping between PDF and Markdown content even in complex layouts
    return blocksForPage.sort((a, b) => a.index - b.index);
  }, [blocks, pageNumber]);

  // Transform coordinates based on rotation
  const transformCoordinates = useCallback((x: number, y: number, width: number, height: number): [number, number, number, number] => {
    switch (rotation) {
      case 90:
        // Rotate 90 degrees clockwise: (x,y) -> (h-y-height, x)
        return [canvasWidth - y - height, x, height, width];
      case 180:
        // Rotate 180 degrees: (x,y) -> (w-x-width, h-y-height)
        return [canvasWidth - x - width, canvasHeight - y - height, width, height];
      case 270:
        // Rotate 270 degrees clockwise: (x,y) -> (y, w-x-width)
        return [y, canvasHeight - x - width, height, width];
      default:
        // No rotation
        return [x, y, width, height];
    }
  }, [rotation, canvasWidth, canvasHeight]);

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
      
      // Use base dimensions for normalization (before rotation)
      const normalizedX1 = bboxX1 / pageWidth;
      const normalizedY1 = bboxY1 / pageHeight;
      const normalizedX2 = bboxX2 / pageWidth;  
      const normalizedY2 = bboxY2 / pageHeight;
      
      // Map to base dimensions first
      const x1 = Math.round(normalizedX1 * baseWidth);
      const y1 = Math.round(normalizedY1 * baseHeight);
      const x2 = Math.round(normalizedX2 * baseWidth);
      const y2 = Math.round(normalizedY2 * baseHeight);
      
      // Calculate base dimensions and padding
      const leftPadding = 2;
      const topPadding = 2;
      const rightPadding = 6;
      const bottomPadding = 6;
      
      const baseX = x1 - leftPadding;
      const baseY = y1 - topPadding;
      const baseW = (x2 + rightPadding) - (x1 - leftPadding);
      const baseH = (y2 + bottomPadding) - (y1 - topPadding);
      
      // Apply rotation transformation
      const [adjustedX1, adjustedY1, width, height] = transformCoordinates(baseX, baseY, baseW, baseH);

      // Determine block style based on state - 与 Markdown 保持一致
      let borderColor = '';
      let backgroundColor = '';
      let lineWidth = 1;
      let alpha = 1; // 使用完全不透明度，颜色已经包含透明度

      if (isSelected) {
        lineWidth = 1; // 与 Markdown 一致：1px 边框
        borderColor = '#3B82F6'; // blue-500 与 Markdown 一致
        backgroundColor = 'rgba(59, 130, 246, 0.15)'; // 与 Markdown 一致
      } else if (isHighlighted) {
        lineWidth = 1;
        borderColor = colorScheme.border;
        backgroundColor = colorScheme.background;
      } else if (isHovered) {
        lineWidth = 0; // 无边框
        borderColor = 'transparent'; // 透明边框
        backgroundColor = 'rgba(59, 130, 246, 0.15)'; // 蓝色背景 与 Markdown 一致
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
    baseWidth,
    baseHeight,
    canvasWidth,
    canvasHeight,
    selectedBlock,
    highlightedBlocks,
    hoveredBlock,
    syncEnabled,
    isDragging,
    rotation,
    transformCoordinates
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

  // Inverse transform for mouse coordinates
  const inverseTransformCoordinates = useCallback((canvasX: number, canvasY: number): [number, number] => {
    switch (rotation) {
      case 90:
        // Inverse of 90 degree rotation
        return [canvasY, canvasWidth - canvasX];
      case 180:
        // Inverse of 180 degree rotation
        return [canvasWidth - canvasX, canvasHeight - canvasY];
      case 270:
        // Inverse of 270 degree rotation
        return [canvasHeight - canvasY, canvasX];
      default:
        // No rotation
        return [canvasX, canvasY];
    }
  }, [rotation, canvasWidth, canvasHeight]);

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
      const rawCanvasX = (x / rect.width) * canvasWidth;
      const rawCanvasY = (y / rect.height) * canvasHeight;
      
      // Apply inverse rotation to get original coordinates
      const [canvasX, canvasY] = inverseTransformCoordinates(rawCanvasX, rawCanvasY);

      // Find clicked block using base coordinates (before rotation)
      for (const block of pageBlocks) {
        const [bboxX1, bboxY1, bboxX2, bboxY2] = block.bbox;
        const [pageWidth, pageHeight] = pageSize;
        
        // Convert block coordinates to base canvas space (before rotation)
        const blockX1 = (bboxX1 / pageWidth) * baseWidth;
        const blockY1 = (bboxY1 / pageHeight) * baseHeight;
        const blockX2 = (bboxX2 / pageWidth) * baseWidth;
        const blockY2 = (bboxY2 / pageHeight) * baseHeight;
        
        // Apply same padding as drawing
        const adjustedBlockX1 = blockX1 - 2;
        const adjustedBlockY1 = blockY1 - 2;
        const adjustedBlockX2 = blockX2 + 6;
        const adjustedBlockY2 = blockY2 + 6;
        
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
    [syncEnabled, onBlockClick, pageBlocks, pageNumber, pageSize, baseWidth, baseHeight, inverseTransformCoordinates]
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
      const rawCanvasX = (x / rect.width) * canvasWidth;
      const rawCanvasY = (y / rect.height) * canvasHeight;
      
      // Apply inverse rotation to get original coordinates
      const [canvasX, canvasY] = inverseTransformCoordinates(rawCanvasX, rawCanvasY);

      // Find hovered block using base coordinates (before rotation)
      let foundBlock: number | null = null;
      for (const block of pageBlocks) {
        const [bboxX1, bboxY1, bboxX2, bboxY2] = block.bbox;
        const [pageWidth, pageHeight] = pageSize;
        
        // Convert block coordinates to base canvas space (before rotation)
        const blockX1 = (bboxX1 / pageWidth) * baseWidth;
        const blockY1 = (bboxY1 / pageHeight) * baseHeight;
        const blockX2 = (bboxX2 / pageWidth) * baseWidth;
        const blockY2 = (bboxY2 / pageHeight) * baseHeight;
        
        // Apply same padding as drawing
        const adjustedBlockX1 = blockX1 - 2;
        const adjustedBlockY1 = blockY1 - 2;
        const adjustedBlockX2 = blockX2 + 6;
        const adjustedBlockY2 = blockY2 + 6;
        
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
    [syncEnabled, pageBlocks, pageNumber, pageSize, baseWidth, baseHeight, hoveredBlock, onBlockHover, inverseTransformCoordinates]
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