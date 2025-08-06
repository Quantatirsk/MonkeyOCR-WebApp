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
}

export const PDFBlockOverlay: React.FC<PDFBlockOverlayProps> = ({
  blocks,
  pageNumber,
  pageSize,
  scale,
  selectedBlock,
  highlightedBlocks,
  syncEnabled,
  onBlockClick,
  onBlockHover,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredBlock, setHoveredBlock] = React.useState<number | null>(null);

  // Calculate canvas dimensions
  const canvasWidth = pageSize[0] * scale;
  const canvasHeight = pageSize[1] * scale;

  // Filter blocks for current page
  const pageBlocks = useMemo(() => 
    BlockProcessor.getBlocksForPage(blocks, pageNumber),
    [blocks, pageNumber]
  );

  // Draw blocks on canvas
  const drawBlocks = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !syncEnabled) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw each block
    pageBlocks.forEach((block) => {
      const isSelected = selectedBlock.blockIndex === block.index && selectedBlock.isActive;
      const isHighlighted = highlightedBlocks.includes(block.index);
      const isHovered = hoveredBlock === block.index;

      // Get color scheme
      const colorScheme = BlockProcessor.getBlockColorScheme(block.type);

      // Convert coordinates
      const [x1, y1, x2, y2] = BlockProcessor.convertPdfToCanvasCoordinates(
        block.bbox,
        pageSize,
        scale
      );

      const width = x2 - x1;
      const height = y2 - y1;

      // Determine block style based on state
      let borderColor = colorScheme.border;
      let backgroundColor = colorScheme.background;
      let lineWidth = 1;
      let alpha = 0.6;

      if (isSelected) {
        lineWidth = 3;
        alpha = 0.8;
        borderColor = '#EF4444'; // red-500 for selection
        backgroundColor = 'rgba(239, 68, 68, 0.1)';
      } else if (isHighlighted) {
        lineWidth = 2;
        alpha = 0.7;
      } else if (isHovered) {
        lineWidth = 2;
        alpha = 0.8;
        borderColor = '#8B5CF6'; // violet-500 for hover
        backgroundColor = 'rgba(139, 92, 246, 0.1)';
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

      // Draw block index label
      const labelSize = Math.max(10, Math.min(16, width / 8));
      const labelPadding = 4;
      const labelText = `${block.index}`;

      ctx.font = `${labelSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Draw label background
      const labelMetrics = ctx.measureText(labelText);
      const labelWidth = labelMetrics.width + labelPadding * 2;
      const labelHeight = labelSize + labelPadding * 2;

      const labelX = x1;
      const labelY = y1 - labelHeight;

      // Ensure label stays within canvas bounds
      const adjustedLabelX = Math.max(0, Math.min(canvasWidth - labelWidth, labelX));
      const adjustedLabelY = Math.max(0, labelY);

      ctx.fillStyle = borderColor;
      ctx.fillRect(adjustedLabelX, adjustedLabelY, labelWidth, labelHeight);

      // Draw label text
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(
        labelText,
        adjustedLabelX + labelWidth / 2,
        adjustedLabelY + labelHeight / 2
      );

      // Draw block type indicator (small dot)
      if (width > 30 && height > 30) {
        const dotSize = 6;
        const dotX = x2 - dotSize - 4;
        const dotY = y1 + 4;

        ctx.beginPath();
        ctx.arc(dotX, dotY, dotSize / 2, 0, 2 * Math.PI);
        ctx.fillStyle = colorScheme.border;
        ctx.fill();

        // Add type letter
        ctx.font = `${dotSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(
          block.type === 'title' ? 'T' : block.type === 'image' ? 'I' : 'P',
          dotX,
          dotY + 1
        );
      }
    });
  }, [
    pageBlocks,
    pageSize,
    scale,
    canvasWidth,
    canvasHeight,
    selectedBlock,
    highlightedBlocks,
    hoveredBlock,
    syncEnabled
  ]);

  // Handle canvas click
  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!syncEnabled || !onBlockClick) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Find clicked block
      for (const block of pageBlocks) {
        if (BlockProcessor.isPointInBlock([x, y], block, scale)) {
          onBlockClick(block.index, pageNumber);
          return;
        }
      }

      // Click outside blocks - clear selection
      onBlockClick(-1, pageNumber);
    },
    [syncEnabled, onBlockClick, pageBlocks, pageNumber, scale]
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

      // Find hovered block
      let foundBlock: number | null = null;
      for (const block of pageBlocks) {
        if (BlockProcessor.isPointInBlock([x, y], block, scale)) {
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
    [syncEnabled, pageBlocks, pageNumber, scale, hoveredBlock, onBlockHover]
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

  // Redraw canvas when dependencies change
  useEffect(() => {
    drawBlocks();
  }, [drawBlocks]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Redraw
    drawBlocks();
  }, [canvasWidth, canvasHeight, drawBlocks]);

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
          width: canvasWidth,
          height: canvasHeight,
          imageRendering: 'crisp-edges'
        }}
        title="点击区块进行同步对照"
      />
      
      {/* Block count indicator */}
      {pageBlocks.length > 0 && (
        <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded pointer-events-none">
          {pageBlocks.length} 个区块
        </div>
      )}
    </div>
  );
};

export default PDFBlockOverlay;