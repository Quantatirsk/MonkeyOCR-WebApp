/**
 * PDF坐标转换和区块位置计算工具
 * 处理PDF坐标系与Canvas坐标系的转换
 */

import { ProcessingBlock } from '@/types';

export interface PDFBlockPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
}

export interface PageDimensions {
  width: number;
  height: number;
}

/**
 * 将PDF坐标转换为Canvas坐标
 * PDF坐标系：左下角为原点(0,0)，向上向右为正
 * Canvas坐标系：左上角为原点(0,0)，向下向右为正
 */
export function convertPDFToCanvasCoordinates(
  pdfBbox: [number, number, number, number],
  pageHeight: number,
  scale: number = 1
): { x: number; y: number; width: number; height: number } {
  const [x1, y1, x2, y2] = pdfBbox;
  
  // 转换坐标系并应用缩放
  // PDF: (x1,y1)左下角, (x2,y2)右上角
  // Canvas: 需要转换为左上角起点
  const canvasX = x1 * scale;
  const canvasY = (pageHeight - y2) * scale; // y2是PDF中的上边界，转换后是Canvas的上边界
  const canvasWidth = (x2 - x1) * scale;
  const canvasHeight = (y2 - y1) * scale;
  
  // 调试日志
  console.log('Coordinate conversion:', {
    pdf: { x1, y1, x2, y2 },
    pageHeight,
    scale,
    canvas: {
      x: canvasX,
      y: canvasY,
      width: canvasWidth,
      height: canvasHeight
    }
  });
  
  return {
    x: canvasX,
    y: canvasY,
    width: canvasWidth,
    height: canvasHeight
  };
}

/**
 * 计算页面缩放比例
 */
export function calculateScale(
  originalPageSize: [number, number],
  displaySize: { width: number; height: number }
): number {
  const [originalWidth, originalHeight] = originalPageSize;
  
  const scaleX = displaySize.width / originalWidth;
  const scaleY = displaySize.height / originalHeight;
  
  // 使用较小的缩放比例以确保完整显示
  return Math.min(scaleX, scaleY);
}

/**
 * 从处理块数据中提取区块位置信息
 */
export function extractBlockPositions(
  blocks: ProcessingBlock[],
  pageDimensions: Map<number, PageDimensions>,
  scale: number = 1
): Map<number, PDFBlockPosition> {
  const positions = new Map<number, PDFBlockPosition>();
  
  blocks.forEach((block) => {
    if (!block.bbox || block.bbox.length !== 4) {
      console.warn('Block missing bbox:', block);
      return;
    }
    
    // 获取页面信息
    const pageNumber = block.page_num || 1;
    let pageHeight: number;
    
    // 首先尝试使用区块自身的页面尺寸信息
    if (block.page_size && block.page_size.length === 2) {
      pageHeight = block.page_size[1];
    } else {
      // 回退到从pageDimensions Map获取
      const pageDimension = pageDimensions.get(pageNumber);
      if (!pageDimension) {
        console.warn('No page dimension found for block:', pageNumber, block);
        return;
      }
      pageHeight = pageDimension.height;
    }
    
    const canvasCoords = convertPDFToCanvasCoordinates(
      block.bbox,
      pageHeight,
      scale
    );
    
    positions.set(block.index, {
      ...canvasCoords,
      pageNumber
    });
    
    // 调试信息
    console.log(`Block ${block.index} on page ${pageNumber}:`, {
      originalBbox: block.bbox,
      pageHeight,
      scale,
      converted: canvasCoords
    });
  });
  
  return positions;
}

/**
 * 根据区块类型获取颜色方案
 */
export function getBlockColorScheme(blockType: string): {
  borderColor: string;
  backgroundColor: string;
  hoverColor: string;
  selectedColor: string;
} {
  switch (blockType) {
    case 'text':
      return {
        borderColor: 'rgba(59, 130, 246, 0.8)', // blue
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        hoverColor: 'rgba(59, 130, 246, 0.2)',
        selectedColor: 'rgba(59, 130, 246, 0.3)'
      };
    case 'title':
      return {
        borderColor: 'rgba(34, 197, 94, 0.8)', // green
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        hoverColor: 'rgba(34, 197, 94, 0.2)',
        selectedColor: 'rgba(34, 197, 94, 0.3)'
      };
    case 'image':
      return {
        borderColor: 'rgba(249, 115, 22, 0.8)', // orange
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        hoverColor: 'rgba(249, 115, 22, 0.2)',
        selectedColor: 'rgba(249, 115, 22, 0.3)'
      };
    default:
      return {
        borderColor: 'rgba(107, 114, 128, 0.8)', // gray
        backgroundColor: 'rgba(107, 114, 128, 0.1)',
        hoverColor: 'rgba(107, 114, 128, 0.2)',
        selectedColor: 'rgba(107, 114, 128, 0.3)'
      };
  }
}

/**
 * 检查点是否在区块内
 */
export function isPointInBlock(
  point: { x: number; y: number },
  blockPosition: PDFBlockPosition
): boolean {
  return (
    point.x >= blockPosition.x &&
    point.x <= blockPosition.x + blockPosition.width &&
    point.y >= blockPosition.y &&
    point.y <= blockPosition.y + blockPosition.height
  );
}

/**
 * 获取指定点击位置的区块索引
 */
export function getBlockAtPoint(
  point: { x: number; y: number },
  blockPositions: Map<number, PDFBlockPosition>,
  pageNumber: number
): number | null {
  for (const [blockIndex, position] of blockPositions.entries()) {
    if (position.pageNumber === pageNumber && isPointInBlock(point, position)) {
      return blockIndex;
    }
  }
  return null;
}