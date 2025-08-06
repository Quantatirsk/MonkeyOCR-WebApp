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

  middleData.pdf_info.forEach((pageInfo: PageInfo) => {
    if (pageInfo.preproc_blocks) {
      pageInfo.preproc_blocks.forEach((block: ProcessingBlock) => {
        // Enhance block with extracted content for matching
        const processedBlock: ProcessingBlock = {
          ...block,
          content: extractContentFromBlock(block)
        };
        
        allBlocks.push(processedBlock);
      });
    }
  });

  // Sort blocks by their natural reading order
  return allBlocks.sort((a, b) => {
    // First by vertical position (assuming top-to-bottom reading)
    const aTopY = Math.min(...a.lines.map(line => line.bbox[1]));
    const bTopY = Math.min(...b.lines.map(line => line.bbox[1]));
    
    if (Math.abs(aTopY - bTopY) > 10) { // 10px tolerance for same-line elements
      return aTopY - bTopY;
    }
    
    // Then by horizontal position (left-to-right)
    const aLeftX = Math.min(...a.lines.map(line => line.bbox[0]));
    const bLeftX = Math.min(...b.lines.map(line => line.bbox[0]));
    
    return aLeftX - bLeftX;
  });
}

/**
 * Extract readable content from a block's lines and spans
 */
export function extractContentFromBlock(block: ProcessingBlock): string {
  if (!block.lines || block.lines.length === 0) {
    return '';
  }

  const content = block.lines
    .map(line => 
      line.spans
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
      typeof block.index === 'number'
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