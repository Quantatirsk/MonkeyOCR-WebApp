/**
 * ImageBlockOverlay Component
 * Renders interactive block overlays on image files for the sync feature
 */

import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { BlockData, BlockSelection } from '../../types';
import { BlockProcessor } from '../../utils/blockProcessor';

export interface ImageBlockOverlayProps {
  /** Block data for the current image */
  blocks: BlockData[];
  /** Original image dimensions */
  imageDimensions: [number, number];
  /** Display image dimensions */
  displayDimensions: [number, number];
  /** Current rotation angle (0, 90, 180, 270) */
  rotation: number;
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

export const ImageBlockOverlay: React.FC<ImageBlockOverlayProps> = ({
  blocks,
  imageDimensions,
  displayDimensions,
  rotation: _rotation, // Rotation handled by container CSS transform
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

  // Canvas dimensions match display dimensions
  const [canvasWidth, canvasHeight] = displayDimensions;

  // Filter blocks for page 1 (images are treated as single page)
  // Sort by semantic reading order to match Markdown generation
  const imageBlocks = useMemo(() => {
    const blocksForImage = BlockProcessor.getBlocksForPage(blocks, 1);
    return blocksForImage.sort((a, b) => a.index - b.index);
  }, [blocks]);

  /**
   * Convert block coordinates from original image space to display canvas space
   * Simplified version - no rotation transformation (handled by container CSS transform)
   */
  const convertBlockCoordinates = useCallback((
    bbox: [number, number, number, number],
    originalDims: [number, number],
    displayDims: [number, number]
  ): [number, number, number, number] => {
    const [origWidth, origHeight] = originalDims;
    const [dispWidth, dispHeight] = displayDims;
    const [x1, y1, x2, y2] = bbox;

    // Normalize coordinates to [0,1] range based on original dimensions
    const normX1 = x1 / origWidth;
    const normY1 = y1 / origHeight;
    const normX2 = x2 / origWidth;
    const normY2 = y2 / origHeight;

    // Convert to display dimensions
    const displayX1 = Math.round(normX1 * dispWidth);
    const displayY1 = Math.round(normY1 * dispHeight);
    const displayX2 = Math.round(normX2 * dispWidth);
    const displayY2 = Math.round(normY2 * dispHeight);

    return [displayX1, displayY1, displayX2, displayY2];
  }, []);

  // Draw blocks on canvas
  const drawBlocks = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !syncEnabled || canvasWidth <= 0 || canvasHeight <= 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw blocks in reverse order so larger blocks are drawn first (lower z-index)
    // This ensures smaller blocks appear on top for better interaction
    const blocksToRender = [...imageBlocks].reverse();
    blocksToRender.forEach((block) => {
      const isSelected = selectedBlock.blockIndex === block.index && selectedBlock.isActive;
      const isHighlighted = highlightedBlocks.includes(block.index);
      const isHovered = hoveredBlock === block.index;

      // Only draw blocks that are selected, highlighted, or hovered
      // Skip drawing default blocks to keep image clean
      if (!isSelected && !isHighlighted && !isHovered) {
        return; // Skip this block - no visual rendering
      }

      // Get color scheme
      const colorScheme = BlockProcessor.getBlockColorScheme(block.type);

      // Convert block coordinates
      const [displayX1, displayY1, displayX2, displayY2] = convertBlockCoordinates(
        block.bbox,
        imageDimensions,
        [canvasWidth, canvasHeight]
      );
      
      // Apply padding for better visual appearance
      const leftPadding = 2;
      const topPadding = 2;
      const rightPadding = 6;
      const bottomPadding = 6;
      
      const adjustedX1 = displayX1 - leftPadding;
      const adjustedY1 = displayY1 - topPadding;
      const adjustedX2 = displayX2 + rightPadding;
      const adjustedY2 = displayY2 + bottomPadding;
      
      const width = adjustedX2 - adjustedX1;
      const height = adjustedY2 - adjustedY1;

      // Determine block style based on state
      let borderColor = '';
      let backgroundColor = '';
      let lineWidth = 1;
      let alpha = 1;

      if (isSelected) {
        lineWidth = 1;
        borderColor = '#3B82F6'; // blue-500
        backgroundColor = 'rgba(59, 130, 246, 0.15)';
      } else if (isHighlighted) {
        lineWidth = 1;
        borderColor = colorScheme.border;
        backgroundColor = colorScheme.background;
      } else if (isHovered) {
        lineWidth = 0;
        borderColor = 'transparent';
        backgroundColor = 'rgba(59, 130, 246, 0.15)';
      }

      // Draw rounded rectangle with 4px radius
      const borderRadius = 4;
      
      // Half-pixel offset for crisp 1px borders
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

      // Draw block border with rounded corners
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = lineWidth;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.roundRect(drawX, drawY, drawWidth, drawHeight, borderRadius);
      ctx.stroke();
    });
  }, [
    imageBlocks,
    imageDimensions,
    canvasWidth,
    canvasHeight,
    selectedBlock,
    highlightedBlocks,
    hoveredBlock,
    syncEnabled,
    isDragging,
    convertBlockCoordinates
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

      // Find clicked block
      for (const block of imageBlocks) {
        const [displayX1, displayY1, displayX2, displayY2] = convertBlockCoordinates(
          block.bbox,
          imageDimensions,
          [canvasWidth, canvasHeight]
        );
        
        // Apply same padding as drawing
        const adjustedX1 = displayX1 - 2;
        const adjustedY1 = displayY1 - 2;
        const adjustedX2 = displayX2 + 6;
        const adjustedY2 = displayY2 + 6;
        
        // Check if click is inside block
        if (canvasX >= adjustedX1 && canvasX <= adjustedX2 && 
            canvasY >= adjustedY1 && canvasY <= adjustedY2) {
          onBlockClick(block.index, 1); // Images are page 1
          return;
        }
      }

      // Click outside blocks - clear selection
      onBlockClick(-1, 1);
    },
    [syncEnabled, onBlockClick, imageBlocks, imageDimensions, canvasWidth, canvasHeight, convertBlockCoordinates]
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

      // Find hovered block
      let foundBlock: number | null = null;
      for (const block of imageBlocks) {
        const [displayX1, displayY1, displayX2, displayY2] = convertBlockCoordinates(
          block.bbox,
          imageDimensions,
          [canvasWidth, canvasHeight]
        );
        
        // Apply same padding as drawing
        const adjustedX1 = displayX1 - 2;
        const adjustedY1 = displayY1 - 2;
        const adjustedX2 = displayX2 + 6;
        const adjustedY2 = displayY2 + 6;
        
        // Check if mouse is inside block
        if (canvasX >= adjustedX1 && canvasX <= adjustedX2 && 
            canvasY >= adjustedY1 && canvasY <= adjustedY2) {
          foundBlock = block.index;
          break;
        }
      }

      if (foundBlock !== hoveredBlock) {
        setHoveredBlock(foundBlock);
        if (onBlockHover) {
          onBlockHover(foundBlock, 1); // Images are page 1
        }
      }

      // Update cursor
      canvas.style.cursor = foundBlock !== null ? 'pointer' : 'default';
    },
    [syncEnabled, imageBlocks, imageDimensions, canvasWidth, canvasHeight, hoveredBlock, onBlockHover, convertBlockCoordinates]
  );

  // Handle canvas mouse leave
  const handleCanvasMouseLeave = useCallback(() => {
    if (hoveredBlock !== null) {
      setHoveredBlock(null);
      if (onBlockHover) {
        onBlockHover(null, 1); // Images are page 1
      }
    }
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'default';
    }
  }, [hoveredBlock, onBlockHover]);

  // Schedule redraw when dependencies change using RAF
  useEffect(() => {
    scheduleRedraw();
  }, [scheduleRedraw]);

  // Handle canvas resize and setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // Set Canvas rendering quality for crisp edges
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

  if (!syncEnabled || canvasWidth <= 0 || canvasHeight <= 0) {
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
          width: '100%',
          height: '100%',
          imageRendering: 'crisp-edges',
          objectFit: 'fill'
        }}
        title="点击区块进行同步对照"
      />
    </div>
  );
};

export default ImageBlockOverlay;