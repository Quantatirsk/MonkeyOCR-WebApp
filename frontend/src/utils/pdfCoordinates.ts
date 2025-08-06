/**
 * PDF Coordinate Utilities
 * Handles coordinate transformations and geometric calculations for PDF display
 */

import { BlockData } from '../types';

export class PDFCoordinateUtils {
  /**
   * Convert PDF coordinates (bottom-left origin) to Canvas coordinates (top-left origin)
   */
  static pdfToCanvas(
    bbox: [number, number, number, number],
    pageSize: [number, number],
    scale: number = 1,
    rotation: number = 0
  ): [number, number, number, number] {
    const [x1, y1, x2, y2] = bbox;
    const [pageWidth, pageHeight] = pageSize;

    let canvasX1 = x1 * scale;
    let canvasY1 = (pageHeight - y2) * scale;
    let canvasX2 = x2 * scale;
    let canvasY2 = (pageHeight - y1) * scale;

    // Apply rotation if needed
    if (rotation !== 0) {
      const centerX = (pageWidth * scale) / 2;
      const centerY = (pageHeight * scale) / 2;
      
      [canvasX1, canvasY1] = this.rotatePoint([canvasX1, canvasY1], [centerX, centerY], rotation);
      [canvasX2, canvasY2] = this.rotatePoint([canvasX2, canvasY2], [centerX, centerY], rotation);
      
      // Ensure proper ordering after rotation
      if (canvasX1 > canvasX2) [canvasX1, canvasX2] = [canvasX2, canvasX1];
      if (canvasY1 > canvasY2) [canvasY1, canvasY2] = [canvasY2, canvasY1];
    }

    return [canvasX1, canvasY1, canvasX2, canvasY2];
  }

  /**
   * Convert Canvas coordinates to PDF coordinates
   */
  static canvasToPdf(
    bbox: [number, number, number, number],
    pageSize: [number, number],
    scale: number = 1,
    rotation: number = 0
  ): [number, number, number, number] {
    let [canvasX1, canvasY1, canvasX2, canvasY2] = bbox;
    const [pageWidth, pageHeight] = pageSize;

    // Apply reverse rotation if needed
    if (rotation !== 0) {
      const centerX = (pageWidth * scale) / 2;
      const centerY = (pageHeight * scale) / 2;
      
      [canvasX1, canvasY1] = this.rotatePoint([canvasX1, canvasY1], [centerX, centerY], -rotation);
      [canvasX2, canvasY2] = this.rotatePoint([canvasX2, canvasY2], [centerX, centerY], -rotation);
    }

    const pdfX1 = canvasX1 / scale;
    const pdfY1 = pageHeight - (canvasY2 / scale);
    const pdfX2 = canvasX2 / scale;
    const pdfY2 = pageHeight - (canvasY1 / scale);

    return [pdfX1, pdfY1, pdfX2, pdfY2];
  }

  /**
   * Rotate a point around a center point by given degrees
   */
  static rotatePoint(
    point: [number, number], 
    center: [number, number], 
    degrees: number
  ): [number, number] {
    const [x, y] = point;
    const [cx, cy] = center;
    const radians = (degrees * Math.PI) / 180;
    
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    
    const nx = cos * (x - cx) - sin * (y - cy) + cx;
    const ny = sin * (x - cx) + cos * (y - cy) + cy;
    
    return [nx, ny];
  }

  /**
   * Calculate the bounds of multiple blocks
   */
  static calculateBounds(blocks: BlockData[], scale: number = 1): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  } {
    if (blocks.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    blocks.forEach(block => {
      const [x1, y1, x2, y2] = this.pdfToCanvas(
        block.bbox, 
        block.page_size, 
        scale
      );
      
      minX = Math.min(minX, x1);
      minY = Math.min(minY, y1);
      maxX = Math.max(maxX, x2);
      maxY = Math.max(maxY, y2);
    });

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Check if two bounding boxes overlap
   */
  static doBoxesOverlap(
    bbox1: [number, number, number, number],
    bbox2: [number, number, number, number]
  ): boolean {
    const [x1a, y1a, x2a, y2a] = bbox1;
    const [x1b, y1b, x2b, y2b] = bbox2;

    return !(x2a < x1b || x2b < x1a || y2a < y1b || y2b < y1a);
  }

  /**
   * Calculate the area of a bounding box
   */
  static calculateArea(bbox: [number, number, number, number]): number {
    const [x1, y1, x2, y2] = bbox;
    return Math.abs((x2 - x1) * (y2 - y1));
  }

  /**
   * Calculate the center point of a bounding box
   */
  static calculateCenter(bbox: [number, number, number, number]): [number, number] {
    const [x1, y1, x2, y2] = bbox;
    return [(x1 + x2) / 2, (y1 + y2) / 2];
  }

  /**
   * Calculate the distance between two points
   */
  static calculateDistance(point1: [number, number], point2: [number, number]): number {
    const [x1, y1] = point1;
    const [x2, y2] = point2;
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  /**
   * Find the closest block to a given point
   */
  static findClosestBlock(
    point: [number, number],
    blocks: BlockData[],
    scale: number = 1
  ): BlockData | null {
    if (blocks.length === 0) return null;

    let closestBlock = blocks[0];
    let closestDistance = Infinity;

    blocks.forEach(block => {
      const canvasBbox = this.pdfToCanvas(block.bbox, block.page_size, scale);
      const blockCenter = this.calculateCenter(canvasBbox);
      const distance = this.calculateDistance(point, blockCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestBlock = block;
      }
    });

    return closestBlock;
  }

  /**
   * Normalize coordinates to ensure proper ordering
   */
  static normalizeBox(bbox: [number, number, number, number]): [number, number, number, number] {
    const [x1, y1, x2, y2] = bbox;
    return [
      Math.min(x1, x2),
      Math.min(y1, y2),
      Math.max(x1, x2),
      Math.max(y1, y2)
    ];
  }

  /**
   * Scale a bounding box by a factor
   */
  static scaleBox(
    bbox: [number, number, number, number], 
    scale: number
  ): [number, number, number, number] {
    const [x1, y1, x2, y2] = bbox;
    return [x1 * scale, y1 * scale, x2 * scale, y2 * scale];
  }

  /**
   * Expand a bounding box by a margin
   */
  static expandBox(
    bbox: [number, number, number, number], 
    margin: number
  ): [number, number, number, number] {
    const [x1, y1, x2, y2] = bbox;
    return [x1 - margin, y1 - margin, x2 + margin, y2 + margin];
  }

  /**
   * Check if a point is inside a bounding box
   */
  static isPointInBox(
    point: [number, number], 
    bbox: [number, number, number, number]
  ): boolean {
    const [x, y] = point;
    const [x1, y1, x2, y2] = bbox;
    return x >= x1 && x <= x2 && y >= y1 && y <= y2;
  }

  /**
   * Convert viewport coordinates to PDF page coordinates
   */
  static viewportToPdfCoordinates(
    viewportPoint: [number, number],
    viewportSize: [number, number],
    pageSize: [number, number],
    scale: number = 1,
    offset: [number, number] = [0, 0]
  ): [number, number] {
    const [vx, vy] = viewportPoint;
    const [_vw, _vh] = viewportSize;
    const [_pw, ph] = pageSize;
    const [ox, oy] = offset;

    // Account for offset and scale
    const normalizedX = (vx - ox) / scale;
    const normalizedY = (vy - oy) / scale;

    // Convert to PDF coordinates (flip Y axis)
    const pdfX = normalizedX;
    const pdfY = ph - normalizedY;

    return [pdfX, pdfY];
  }

  /**
   * Get page dimensions accounting for rotation
   */
  static getRotatedPageSize(
    pageSize: [number, number], 
    rotation: number
  ): [number, number] {
    const [width, height] = pageSize;
    
    // Normalize rotation to 0, 90, 180, 270
    const normalizedRotation = ((rotation % 360) + 360) % 360;
    
    if (normalizedRotation === 90 || normalizedRotation === 270) {
      return [height, width]; // Swap dimensions
    }
    
    return [width, height];
  }
}