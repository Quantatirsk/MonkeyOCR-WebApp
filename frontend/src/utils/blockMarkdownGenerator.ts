/**
 * Block-based Markdown Generator
 * Reconstructs markdown content from block data for perfect 1:1 mapping in compare view
 */

import { BlockData } from '../types';

export class BlockMarkdownGenerator {
  /**
   * Generate markdown content from block data with 1:1 block-to-paragraph mapping
   */
  static generateFromBlocks(blocks: BlockData[]): string {
    if (!blocks || blocks.length === 0) {
      return '';
    }

    const markdownParts: string[] = [];
    let currentPage = 1;

    // Sort blocks by page and then by index (semantic reading order)
    const sortedBlocks = [...blocks].sort((a, b) => {
      if (a.page_num !== b.page_num) {
        return a.page_num - b.page_num;
      }
      // Sort by index (semantic reading order from MonkeyOCR)
      // This preserves the correct reading order even in complex layouts
      return a.index - b.index;
    });

    console.log('📝 Markdown generation blocks order (by index):', sortedBlocks.map(b => ({
      index: b.index,
      page: b.page_num,
      y: b.bbox[1],
      content: b.content.substring(0, 30) + '...'
    })));

    for (const block of sortedBlocks) {
      // Add page break if we're on a new page
      if (block.page_num > currentPage) {
        markdownParts.push('\n---\n'); // Page separator
        currentPage = block.page_num;
      }

      // Format content based on block type
      const formattedContent = this.formatBlockContent(block);
      if (formattedContent.trim()) {
        markdownParts.push(formattedContent);
      }
    }

    return markdownParts.join('\n\n');
  }

  /**
   * Format individual block content based on its type
   */
  private static formatBlockContent(block: BlockData): string {
    const content = block.content.trim();
    if (!content) return '';

    switch (block.type) {
      case 'title':
        return this.formatTitle(content);
      case 'text':
        return this.formatText(content);
      case 'image':
        return this.formatImage(content);
      default:
        return content;
    }
  }

  /**
   * Format title blocks
   */
  private static formatTitle(content: string): string {
    // Determine header level based on content characteristics
    const headerLevel = this.determineHeaderLevel(content);
    const prefix = '#'.repeat(headerLevel);
    
    return `${prefix} ${content}`;
  }

  /**
   * Format text blocks
   */
  private static formatText(content: string): string {
    // Clean up spacing and line breaks
    const cleanContent = content
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/([.!?])\s+/g, '$1 ') // Normalize sentence spacing
      .trim();

    return cleanContent;
  }

  /**
   * Format image blocks
   */
  private static formatImage(content: string): string {
    // For image blocks, create a markdown image reference
    return `![Image](${content})`;
  }

  /**
   * Determine appropriate header level for titles
   */
  private static determineHeaderLevel(content: string): number {
    const length = content.length;
    const words = content.split(/\s+/).length;

    // Main title characteristics
    if (words <= 10 && this.isAllCaps(content)) {
      return 1;
    }

    // Section headers
    if (words <= 8 && length < 80) {
      return 2;
    }

    // Subsection headers
    if (words <= 6 && length < 60) {
      return 3;
    }

    // Default to h2
    return 2;
  }

  /**
   * Check if content is mostly uppercase (indicating main titles)
   */
  private static isAllCaps(content: string): boolean {
    const letters = content.replace(/[^a-zA-Z]/g, '');
    if (letters.length === 0) return false;
    
    const upperCaseCount = content.replace(/[^A-Z]/g, '').length;
    return upperCaseCount / letters.length > 0.7;
  }

  /**
   * Create block mapping for the generated markdown
   * Returns a map of block index to paragraph index
   */
  static createBlockMapping(blocks: BlockData[]): Map<number, number> {
    const mapping = new Map<number, number>();
    
    // Sort blocks the same way as in generateFromBlocks
    const sortedBlocks = [...blocks].sort((a, b) => {
      if (a.page_num !== b.page_num) {
        return a.page_num - b.page_num;
      }
      return a.index - b.index;
    });

    console.log('🗺️ Block mapping creation order (by index):', sortedBlocks.map(b => ({
      index: b.index,
      page: b.page_num,
      y: b.bbox[1],
      content: b.content.substring(0, 30) + '...'
    })));

    let paragraphIndex = 0;
    let currentPage = 1;

    for (const block of sortedBlocks) {
      // Track page changes but don't increment paragraphIndex for separators
      // The separator is rendered but skipped in DOM mapping, so shouldn't count
      if (block.page_num > currentPage) {
        currentPage = block.page_num;
        // NOTE: Page separator '---' exists in markdown but is skipped in DOM mapping
        // So we don't increment paragraphIndex here to avoid offset
      }

      // Only map blocks with actual content
      if (block.content.trim()) {
        mapping.set(block.index, paragraphIndex);
        paragraphIndex++;
      }
    }

    console.log('🎯 Final block mapping (FIXED - no page separator offset):', Array.from(mapping.entries()).map(([blockIndex, paragraphIndex]) => ({
      blockIndex,
      paragraphIndex,
      pageNum: blocks.find(b => b.index === blockIndex)?.page_num,
      blockContent: blocks.find(b => b.index === blockIndex)?.content.substring(0, 30) + '...'
    })));
    
    console.log(`📄 Total content paragraphs: ${paragraphIndex}, Total pages: ${Math.max(...blocks.map(b => b.page_num))}`);

    return mapping;
  }

  /**
   * Generate markdown with block markers for debugging
   */
  static generateWithBlockMarkers(blocks: BlockData[]): string {
    if (!blocks || blocks.length === 0) {
      return '';
    }

    const markdownParts: string[] = [];
    const sortedBlocks = [...blocks].sort((a, b) => {
      if (a.page_num !== b.page_num) {
        return a.page_num - b.page_num;
      }
      return a.index - b.index;
    });

    for (const block of sortedBlocks) {
      const formattedContent = this.formatBlockContent(block);
      if (formattedContent.trim()) {
        // Add block marker as HTML comment
        const blockMarker = `<!-- BLOCK_${block.index}_PAGE_${block.page_num} -->`;
        markdownParts.push(`${blockMarker}\n${formattedContent}`);
      }
    }

    return markdownParts.join('\n\n');
  }

  /**
   * Extract block index from content with block markers
   */
  static extractBlockIndexFromMarker(content: string): number | null {
    const match = content.match(/<!-- BLOCK_(\d+)_PAGE_\d+ -->/);
    return match ? parseInt(match[1], 10) : null;
  }
}