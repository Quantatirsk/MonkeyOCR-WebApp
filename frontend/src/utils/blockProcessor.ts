/**
 * Block Data Processing Utilities
 * Handles processing and transformation of block data from middle.json
 */

import { BlockData, BlockProcessingData, BlockSelection } from '../types';

export class BlockProcessor {
  /**
   * Process raw middle.json data into structured block data
   */
  static processRawBlockData(rawData: any): BlockProcessingData | null {
    if (!rawData || !rawData.preproc_blocks || !Array.isArray(rawData.preproc_blocks)) {
      return null;
    }

    try {
      const processedBlocks: BlockData[] = rawData.preproc_blocks.map((block: any, index: number) => ({
        index: block.index || index,
        bbox: Array.isArray(block.bbox) && block.bbox.length === 4 
          ? [block.bbox[0], block.bbox[1], block.bbox[2], block.bbox[3]] as [number, number, number, number]
          : [0, 0, 0, 0] as [number, number, number, number],
        type: this.normalizeBlockType(block.type),
        content: String(block.content || '').trim(),
        page_num: block.page_num || 1,
        page_size: Array.isArray(block.page_size) && block.page_size.length === 2
          ? [block.page_size[0], block.page_size[1]] as [number, number]
          : [595, 842] as [number, number] // Default A4 size in points
      }));

      return {
        preproc_blocks: processedBlocks,
        total_pages: this.calculateTotalPages(processedBlocks),
        document_metadata: {
          title: rawData.title || undefined,
          creation_date: rawData.creation_date || undefined,
          processing_timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error processing block data:', error);
      return null;
    }
  }

  /**
   * Normalize block type to ensure consistency
   */
  private static normalizeBlockType(type: any): 'text' | 'title' | 'image' {
    const typeStr = String(type || '').toLowerCase();
    
    if (typeStr.includes('title') || typeStr.includes('heading') || typeStr.includes('header')) {
      return 'title';
    }
    
    if (typeStr.includes('image') || typeStr.includes('figure') || typeStr.includes('img')) {
      return 'image';
    }
    
    return 'text';
  }

  /**
   * Calculate total pages from block data
   */
  private static calculateTotalPages(blocks: BlockData[]): number {
    if (blocks.length === 0) return 1;
    
    const maxPage = Math.max(...blocks.map(block => block.page_num));
    return Math.max(1, maxPage);
  }

  /**
   * Convert PDF coordinates to canvas coordinates
   * PDF: bottom-left origin, Canvas: top-left origin
   */
  static convertPdfToCanvasCoordinates(
    bbox: [number, number, number, number], 
    pageSize: [number, number],
    scale: number = 1
  ): [number, number, number, number] {
    const [x1, y1, x2, y2] = bbox;
    const [_pageWidth, _pageHeight] = pageSize;
    
    // Convert coordinates - check if block data is already in top-left coordinate system
    // If blocks appear upside down, the source data might already be canvas-based
    const canvasX1 = x1 * scale;
    const canvasY1 = y1 * scale; // Try direct mapping first
    const canvasX2 = x2 * scale;
    const canvasY2 = y2 * scale;
    
    return [canvasX1, canvasY1, canvasX2, canvasY2];
  }

  /**
   * Filter blocks by page number
   */
  static getBlocksForPage(blocks: BlockData[], pageNumber: number): BlockData[] {
    return blocks.filter(block => block.page_num === pageNumber);
  }

  /**
   * Get blocks by type
   */
  static getBlocksByType(blocks: BlockData[], type: 'text' | 'title' | 'image'): BlockData[] {
    return blocks.filter(block => block.type === type);
  }

  /**
   * Find block by index
   */
  static findBlockByIndex(blocks: BlockData[], index: number): BlockData | null {
    return blocks.find(block => block.index === index) || null;
  }

  /**
   * Get block color scheme based on type
   */
  static getBlockColorScheme(type: 'text' | 'title' | 'image' | 'table'): {
    border: string;
    background: string;
    label: string;
  } {
    switch (type) {
      case 'title':
        return {
          border: '#10B981', // green-500
          background: 'rgba(16, 185, 129, 0.1)', // green-500 with 10% opacity
          label: '#065F46' // green-800
        };
      case 'image':
        return {
          border: '#F59E0B', // amber-500
          background: 'rgba(245, 158, 11, 0.1)', // amber-500 with 10% opacity
          label: '#92400E' // amber-800
        };
      case 'table':
        return {
          border: '#8B5CF6', // violet-500
          background: 'rgba(139, 92, 246, 0.1)', // violet-500 with 10% opacity
          label: '#5B21B6' // violet-800
        };
      case 'text':
      default:
        return {
          border: '#3B82F6', // blue-500
          background: 'rgba(59, 130, 246, 0.1)', // blue-500 with 10% opacity
          label: '#1E40AF' // blue-800
        };
    }
  }

  /**
   * Check if a point is inside a block's bounding box
   */
  static isPointInBlock(
    point: [number, number], 
    block: BlockData, 
    scale: number = 1
  ): boolean {
    const [x, y] = point;
    const [pageWidth, pageHeight] = block.page_size;
    const [canvasX1, canvasY1, canvasX2, canvasY2] = this.convertPdfToCanvasCoordinates(
      block.bbox, 
      [pageWidth, pageHeight], 
      scale
    );
    
    return x >= canvasX1 && x <= canvasX2 && y >= canvasY1 && y <= canvasY2;
  }

  /**
   * Calculate block dimensions
   */
  static getBlockDimensions(
    block: BlockData, 
    scale: number = 1
  ): { width: number; height: number } {
    const [pageWidth, pageHeight] = block.page_size;
    const [canvasX1, canvasY1, canvasX2, canvasY2] = this.convertPdfToCanvasCoordinates(
      block.bbox,
      [pageWidth, pageHeight],
      scale
    );
    
    return {
      width: canvasX2 - canvasX1,
      height: canvasY2 - canvasY1
    };
  }

  /**
   * Create an empty block selection
   */
  static createEmptySelection(): BlockSelection {
    return {
      blockIndex: null,
      pageNumber: null,
      isActive: false
    };
  }

  /**
   * Create a block selection
   */
  static createBlockSelection(blockIndex: number, pageNumber: number): BlockSelection {
    return {
      blockIndex,
      pageNumber,
      isActive: true
    };
  }

  /**
   * Check if two block selections are equal
   */
  static areSelectionsEqual(a: BlockSelection, b: BlockSelection): boolean {
    return a.blockIndex === b.blockIndex && 
           a.pageNumber === b.pageNumber && 
           a.isActive === b.isActive;
  }
}

/**
 * Content matching utilities for mapping blocks to markdown content
 */
export class ContentMatcher {
  /**
   * Match blocks to markdown paragraphs using multiple strategies
   */
  static matchBlocksToMarkdown(
    blocks: BlockData[], 
    markdownContent: string
  ): Map<number, number> {
    const blockToMarkdownMap = new Map<number, number>();
    const markdownParagraphs = this.extractMarkdownParagraphs(markdownContent);
    
    // Try different matching strategies
    for (const block of blocks) {
      if (block.content.trim() === '') continue;
      
      const matchIndex = this.findBestMatch(block.content, markdownParagraphs);
      if (matchIndex !== -1) {
        blockToMarkdownMap.set(block.index, matchIndex);
      }
    }
    
    return blockToMarkdownMap;
  }

  /**
   * Extract paragraphs from markdown content
   */
  private static extractMarkdownParagraphs(markdown: string): string[] {
    // Split by double newlines to get paragraphs
    return markdown
      .split(/\n\s*\n/)
      .map(para => para.trim())
      .filter(para => para.length > 0);
  }

  /**
   * Find the best matching paragraph for a block's content
   */
  private static findBestMatch(blockContent: string, paragraphs: string[]): number {
    if (!blockContent.trim()) return -1;
    
    const normalizedBlockContent = this.normalizeTextGently(blockContent);
    
    // Strategy 1: Direct substring match (most reliable)
    for (let i = 0; i < paragraphs.length; i++) {
      const normalizedPara = this.normalizeTextGently(paragraphs[i]);
      
      // Check both directions with minimum content length filter
      if (normalizedBlockContent.length > 10 && normalizedPara.length > 10) {
        if (normalizedPara.includes(normalizedBlockContent) || 
            normalizedBlockContent.includes(normalizedPara)) {
          return i;
        }
      }
    }
    
    // Strategy 2: Exact match after normalization
    for (let i = 0; i < paragraphs.length; i++) {
      if (this.normalizeText(paragraphs[i]) === this.normalizeText(blockContent)) {
        return i;
      }
    }
    
    // Strategy 3: Fuzzy match with lower threshold
    let bestMatch = -1;
    let bestSimilarity = 0.3; // Reduced threshold for better matching
    
    for (let i = 0; i < paragraphs.length; i++) {
      const similarity = this.calculateSimilarity(
        this.normalizeText(blockContent), 
        this.normalizeText(paragraphs[i])
      );
      
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = i;
      }
    }
    
    return bestMatch;
  }

  /**
   * Normalize text for comparison (gentle version for better matching)
   */
  private static normalizeTextGently(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ') // Collapse whitespace only
      .trim();
  }

  /**
   * Normalize text for comparison (aggressive version)
   */
  private static normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim();
  }

  /**
   * Calculate text similarity using Jaccard index
   */
  private static calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(' '));
    const words2 = new Set(text2.split(' '));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return union.size === 0 ? 0 : intersection.size / union.size;
  }
}