import { ProcessingBlock, MiddleData, PageInfo, BlockSyncState } from '@/types';
import { matchBlocksToSections, MatchResult } from './contentMatcher';

/**
 * Block data processing utilities for PDF-Markdown synchronization
 * Handles extraction, processing, and mapping of block data from middle.json
 */

/**
 * Extract and process block data from middle.json structure
 */
export function extractBlocksFromMiddleData(middleData: MiddleData): ProcessingBlock[] {
  if (!middleData?.pdf_info) {
    return [];
  }

  const allBlocks: ProcessingBlock[] = [];

  middleData.pdf_info.forEach((pageInfo: PageInfo, pageIndex: number) => {
    if (pageInfo && pageInfo.preproc_blocks && Array.isArray(pageInfo.preproc_blocks)) {
      const pageNumber = pageInfo.page_num || (pageIndex + 1); // 使用实际页码或从索引推断
      
      pageInfo.preproc_blocks.forEach((block: ProcessingBlock) => {
        // Skip invalid blocks
        if (!block || !block.lines || !Array.isArray(block.lines)) {
          return;
        }
        
        // Enhance block with extracted content and page information
        const processedBlock: ProcessingBlock = {
          ...block,
          content: extractContentFromBlock(block),
          // 重要：添加页面信息用于坐标转换
          page_num: pageNumber,
          page_size: pageInfo.page_size
        };
        
        allBlocks.push(processedBlock);
      });
    }
  });

  // Sort blocks by their natural reading order
  return allBlocks
    .filter(block => block && block.lines && block.lines.length > 0)
    .sort((a, b) => {
      // 首先按页面编号排序
      const aPageNum = a.page_num || 1;
      const bPageNum = b.page_num || 1;
      
      if (aPageNum !== bPageNum) {
        return aPageNum - bPageNum;
      }
      
      // 同一页面内，按垂直位置排序 (从上到下)
      const aLines = a.lines.filter(line => line && line.bbox && line.bbox.length >= 2);
      const bLines = b.lines.filter(line => line && line.bbox && line.bbox.length >= 2);
      
      if (aLines.length === 0 || bLines.length === 0) {
        return 0; // Keep original order if no valid lines
      }
      
      // 使用区块的bbox而不是行的bbox来获得更准确的位置
      const aTopY = a.bbox ? a.bbox[1] : Math.min(...aLines.map(line => line.bbox[1]));
      const bTopY = b.bbox ? b.bbox[1] : Math.min(...bLines.map(line => line.bbox[1]));
      
      if (Math.abs(aTopY - bTopY) > 10) { // 10px tolerance for same-line elements
        return aTopY - bTopY;
      }
      
      // 然后按水平位置排序 (从左到右)
      const aLeftX = a.bbox ? a.bbox[0] : Math.min(...aLines.map(line => line.bbox[0]));
      const bLeftX = b.bbox ? b.bbox[0] : Math.min(...bLines.map(line => line.bbox[0]));
      
      return aLeftX - bLeftX;
    })
    .map((block, index) => ({
      ...block,
      index // 重新分配索引以确保连续性
    }));
}

/**
 * Extract readable content from a block's lines and spans
 */
export function extractContentFromBlock(block: ProcessingBlock): string {
  if (!block || !block.lines || block.lines.length === 0) {
    return '';
  }

  const content = block.lines
    .filter(line => line && line.spans && Array.isArray(line.spans))
    .map(line => 
      line.spans
        .filter(span => span && span.content)
        .map(span => span.content || '')
        .join(' ')
    )
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return content;
}

/**
 * Create block mappings between JSON blocks and Markdown sections
 */
export function createBlockMappings(
  blocks: ProcessingBlock[],
  markdownContent: string
): Map<string, string> {
  const mappings = new Map<string, string>();
  
  // Split markdown into sections (paragraphs, headers, etc.)
  const sections = splitMarkdownIntoSections(markdownContent);
  
  if (blocks.length === 0 || sections.length === 0) {
    return mappings;
  }

  // Use content matcher to find correspondences
  const matches = matchBlocksToSections(blocks, sections);
  
  // Convert match results to mapping format
  matches.forEach((match: MatchResult) => {
    const blockId = `block-${match.blockIndex}`;
    const sectionId = `section-${match.sectionIndex}`;
    
    mappings.set(blockId, sectionId);
    // Also create reverse mapping for quick lookup
    mappings.set(sectionId, blockId);
  });

  return mappings;
}

/**
 * Split markdown content into logical sections for matching
 */
export function splitMarkdownIntoSections(markdownContent: string): string[] {
  if (!markdownContent) return [];

  // Split by double newlines to get paragraphs/sections
  const rawSections = markdownContent
    .split(/\n\s*\n/)
    .map(section => section.trim())
    .filter(section => section.length > 0);

  // Further split large sections that might contain multiple logical blocks
  const processedSections: string[] = [];

  rawSections.forEach(section => {
    // If section is very long, try to split it further
    if (section.length > 500) {
      // Split by single newlines and group related lines
      const lines = section.split('\n').map(line => line.trim()).filter(line => line);
      
      if (lines.length > 1) {
        let currentSection = '';
        
        lines.forEach((line, index) => {
          currentSection += (currentSection ? '\n' : '') + line;
          
          // Split on headers, list items, or after certain patterns
          const shouldSplit = (
            index === lines.length - 1 || // Last line
            lines[index + 1]?.startsWith('#') || // Next line is header
            lines[index + 1]?.match(/^[-*+]\s/) || // Next line is list item
            lines[index + 1]?.match(/^\d+\.\s/) || // Next line is numbered list
            currentSection.length > 300 // Section getting too long
          );
          
          if (shouldSplit) {
            processedSections.push(currentSection);
            currentSection = '';
          }
        });
      } else {
        processedSections.push(section);
      }
    } else {
      processedSections.push(section);
    }
  });

  return processedSections;
}

/**
 * Initialize block synchronization state
 */
export function initializeBlockSyncState(
  blocks: ProcessingBlock[],
  markdownContent: string
): BlockSyncState {
  const blockMappings = createBlockMappings(blocks, markdownContent);
  
  return {
    selectedBlockId: null,
    highlightedBlocks: new Set(),
    scrollSyncEnabled: true,
    blockMappings
  };
}

/**
 * Update block sync state with new selection
 */
export function updateBlockSyncState(
  currentState: BlockSyncState,
  updates: Partial<BlockSyncState>
): BlockSyncState {
  return {
    ...currentState,
    ...updates,
    // Preserve Set and Map instances properly
    highlightedBlocks: updates.highlightedBlocks || currentState.highlightedBlocks,
    blockMappings: updates.blockMappings || currentState.blockMappings
  };
}

/**
 * Find corresponding block/section for synchronization
 */
export function findCorrespondingElement(
  sourceId: string,
  blockMappings: Map<string, string>
): string | null {
  return blockMappings.get(sourceId) || null;
}

/**
 * Get block by index from blocks array
 */
export function getBlockById(blockId: string, blocks: ProcessingBlock[]): ProcessingBlock | null {
  const index = parseInt(blockId.replace('block-', ''));
  return blocks[index] || null;
}

/**
 * Calculate block statistics for debugging/monitoring
 */
export interface BlockProcessingStats {
  totalBlocks: number;
  blocksByType: Record<string, number>;
  averageBlockSize: number;
  mappingSuccessRate: number;
  processingTime: number;
}

export function calculateBlockStats(
  blocks: ProcessingBlock[],
  mappings: Map<string, string>,
  processingStartTime: number
): BlockProcessingStats {
  const blocksByType: Record<string, number> = {
    text: 0,
    title: 0,
    image: 0
  };

  let totalContentLength = 0;

  blocks.forEach(block => {
    blocksByType[block.type] = (blocksByType[block.type] || 0) + 1;
    totalContentLength += (block.content || '').length;
  });

  const blockMappingCount = Array.from(mappings.keys())
    .filter(key => key.startsWith('block-')).length;

  return {
    totalBlocks: blocks.length,
    blocksByType,
    averageBlockSize: blocks.length > 0 ? totalContentLength / blocks.length : 0,
    mappingSuccessRate: blocks.length > 0 ? blockMappingCount / blocks.length : 0,
    processingTime: Date.now() - processingStartTime
  };
}

/**
 * Validate middle.json data structure
 */
export function validateMiddleData(data: any): data is MiddleData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  if (!Array.isArray(data.pdf_info)) {
    return false;
  }

  // Check if at least one page has valid block structure
  return data.pdf_info.some((page: any) => 
    page && 
    Array.isArray(page.preproc_blocks) &&
    page.preproc_blocks.some((block: any) =>
      block &&
      typeof block.type === 'string' &&
      Array.isArray(block.bbox) &&
      block.bbox.length === 4 &&
      Array.isArray(block.lines) &&
      typeof block.index === 'number' &&
      // Validate lines structure
      block.lines.every((line: any) => 
        line &&
        Array.isArray(line.spans) &&
        Array.isArray(line.bbox) &&
        line.bbox.length === 4
      )
    )
  );
}

/**
 * Clean and normalize block data for processing
 */
export function normalizeBlockData(blocks: ProcessingBlock[]): ProcessingBlock[] {
  return blocks
    .filter(block => block && block.lines && block.lines.length > 0)
    .map((block, index) => ({
      ...block,
      index: block.index ?? index, // Ensure index is set
      content: extractContentFromBlock(block),
      // Ensure bbox is properly formatted as tuple
      bbox: block.bbox && block.bbox.length === 4 ? 
        [block.bbox[0], block.bbox[1], block.bbox[2], block.bbox[3]] as [number, number, number, number] : 
        [0, 0, 0, 0] as [number, number, number, number]
    }))
    .filter(block => block.content && block.content.length > 0); // Remove empty blocks
}