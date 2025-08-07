/**
 * Block-based Markdown Generator
 * Reconstructs markdown content from block data for perfect 1:1 mapping in compare view
 */

import { BlockData } from '../types';

export class BlockMarkdownGenerator {
  /**
   * Generate markdown content from block data with 1:1 block-to-paragraph mapping
   */
  static generateFromBlocks(blocks: BlockData[], taskId?: string): string {
    if (!blocks || blocks.length === 0) {
      return '';
    }

    const markdownParts: string[] = [];
    let currentPage = 1;

    // Sort blocks by page and then by index (already correctly ordered by backend)
    // Backend has already sorted by (page_num, original_index, y, x) and assigned sequential index
    // So we can simply sort by the assigned index which preserves the correct reading order
    const sortedBlocks = [...blocks].sort((a, b) => {
      if (a.page_num !== b.page_num) {
        return a.page_num - b.page_num;
      }
      // Use the index assigned by backend (which reflects correct reading order)
      return a.index - b.index;
    });

    // Debug logging disabled for performance
    // console.log('📝 Markdown generation blocks order (by index):', sortedBlocks.map(b => ({
    //   index: b.index,
    //   page: b.page_num,
    //   y: b.bbox[1],
    //   content: b.content.substring(0, 30) + '...'
    // }));

    for (const block of sortedBlocks) {
      // Add page break if we're on a new page
      if (block.page_num > currentPage) {
        markdownParts.push('\n---\n'); // Page separator
        currentPage = block.page_num;
      }

      // Format content based on block type
      const formattedContent = this.formatBlockContent(block, taskId);
      if (formattedContent.trim()) {
        // Check if this is a list item that needs special handling
        const isListItem = this.isListItem(formattedContent) || this.isListItem(block.content);
        
        // Debug logging disabled for performance
        
        // Wrap ALL blocks (including list items) in a container div with block index
        // This ensures one block = one DOM element, regardless of internal structure
        if (isListItem) {
          // Convert list item markers to proper HTML list
          // Remove the list marker (-, *, +, or number.) from the beginning
          let cleanContent = formattedContent.trim();
          if (cleanContent.startsWith('- ') || cleanContent.startsWith('* ') || cleanContent.startsWith('+ ')) {
            cleanContent = cleanContent.substring(2); // Remove marker and space
          } else if (cleanContent.match(/^\d+\.\s/)) {
            cleanContent = cleanContent.replace(/^\d+\.\s/, ''); // Remove numbered marker
          }
          
          // Wrap in a proper list item
          markdownParts.push(`<div class="block-container" data-block-index="${block.index}" data-block-type="${block.type}">\n\n<ul class="markdown-unordered-list"><li class="markdown-list-item">${cleanContent}</li></ul>\n\n</div>`);
        } else {
          markdownParts.push(`<div class="block-container" data-block-index="${block.index}" data-block-type="${block.type}">\n\n${formattedContent}\n\n</div>`);
        }
      }
    }

    return markdownParts.join('\n\n');
  }


  /**
   * Format individual block content based on its type
   */
  private static formatBlockContent(block: BlockData, taskId?: string): string {
    const content = block.content.trim();
    if (!content) return '';

    switch (block.type) {
      case 'title':
        return this.formatTitle(content);
      case 'text':
        return this.formatText(content);
      case 'image':
        return this.formatImage(block, taskId);
      case 'table':
        return this.formatTable(block);
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
   * Check if content is a list item
   */
  private static isListItem(content: string): boolean {
    const trimmed = content.trim();
    return trimmed.startsWith('- ') || 
           trimmed.startsWith('* ') ||
           trimmed.startsWith('+ ') ||
           !!trimmed.match(/^\d+\.\s/);
  }

  /**
   * Format text blocks
   */
  private static formatText(content: string): string {
    const trimmed = content.trim();
    
    // Check if this is a list item
    const isListItem = trimmed.startsWith('- ') || 
                       trimmed.startsWith('* ') ||
                       trimmed.startsWith('+ ') ||
                       !!trimmed.match(/^\d+\.\s/);
    
    if (isListItem) {
      // For list items, return as-is to preserve the list marker
      return trimmed;
    }
    
    // Preserve paragraph structure while cleaning up each paragraph
    // Split by double (or more) newlines to identify paragraphs
    const paragraphs = content.split(/\n{2,}/);
    
    // Clean up each paragraph
    const cleanedParagraphs = paragraphs.map(para => {
      // Within each paragraph, single newlines should become spaces
      // This is standard Markdown behavior
      return para
        .replace(/\n/g, ' ') // Single newlines → spaces
        .replace(/\s+/g, ' ') // Multiple spaces → single space
        .trim();
    }).filter(para => para.length > 0); // Remove empty paragraphs
    
    // Rejoin with double newlines to maintain paragraph separation
    // This keeps it as ONE block but renders as multiple paragraphs
    return cleanedParagraphs.join('\n\n');
  }

  /**
   * Format image blocks
   */
  private static formatImage(block: BlockData, taskId?: string): string {
    const content = block.content.trim();
    
    // If the block already contains markdown-formatted content with image, use it
    if (content.startsWith('![') && content.includes('](')) {
      return this.processImagePath(content, taskId);
    }
    
    // Legacy support: treat content as image path
    if (content && !content.includes('\n')) {
      const processedPath = this.processImagePath(`![Image](${content})`, taskId);
      return processedPath;
    }
    
    return content;
  }
  
  /**
   * Format table blocks
   */
  private static formatTable(block: BlockData): string {
    // If we have HTML content, validate and fix it before returning
    if (block.html_content) {
      return this.validateAndFixTableHTML(block.html_content);
    }
    
    // Fallback to markdown content if no HTML is available
    const content = block.content.trim();
    return content;
  }

  /**
   * Validate and auto-fix incomplete HTML table structures
   */
  private static validateAndFixTableHTML(html: string): string {
    // Trim the HTML content
    let fixedHtml = html.trim();
    
    // Check if it starts with <table
    if (!fixedHtml.startsWith('<table')) {
      console.warn('Invalid table HTML: does not start with <table>', fixedHtml.substring(0, 50));
      return fixedHtml; // Return as-is if not a table
    }
    
    // Count open and close tags with improved regex patterns
    const countTag = (str: string, tag: string): { open: number; close: number } => {
      // More robust pattern for opening tags:
      // - Match <tag followed by whitespace, >, or any attribute
      // - Handle cases like <td>, <td class="x">, <td  >, <td colspan="2">
      const openPattern = new RegExp(`<${tag}(?:\\s[^>]*?)?(?:\\s*/)?>`, 'gi');
      
      // Pattern for closing tags - this is straightforward
      const closePattern = new RegExp(`</${tag}>`, 'gi');
      
      const openMatches = str.match(openPattern) || [];
      const closeMatches = str.match(closePattern) || [];
      
      // Filter out self-closing tags from open matches (though rare in tables)
      // Self-closing tags would be like <br/> or <img/>
      const nonSelfClosingOpens = openMatches.filter(match => !match.match(/\/\s*>$/));
      
      return { 
        open: nonSelfClosingOpens.length, 
        close: closeMatches.length 
      };
    };
    
    // Track unclosed tags in order
    const tagsToCheck = ['table', 'thead', 'tbody', 'tr', 'td', 'th'];
    const unclosedTags: string[] = [];
    
    // Check each tag type
    for (const tag of tagsToCheck) {
      const counts = countTag(fixedHtml, tag);
      const unclosedCount = counts.open - counts.close;
      
      // Add unclosed tags to the list (in reverse order for closing)
      for (let i = 0; i < unclosedCount; i++) {
        unclosedTags.unshift(tag); // Add to beginning for reverse order
      }
    }
    
    // Special handling for incomplete content within cells
    // Check if the HTML ends with an incomplete cell content (e.g., ends with "$" or other incomplete LaTeX)
    const lastCloseTagIndex = Math.max(
      fixedHtml.lastIndexOf('</td>'),
      fixedHtml.lastIndexOf('</th>'),
      fixedHtml.lastIndexOf('</tr>'),
      fixedHtml.lastIndexOf('</tbody>'),
      fixedHtml.lastIndexOf('</thead>'),
      fixedHtml.lastIndexOf('</table>')
    );
    
    // If there's content after the last close tag, we might have an incomplete cell
    if (lastCloseTagIndex === -1 || lastCloseTagIndex < fixedHtml.length - 10) {
      // Find the last open td or th tag
      const lastOpenTd = fixedHtml.lastIndexOf('<td');
      const lastOpenTh = fixedHtml.lastIndexOf('<th');
      const lastOpenCell = Math.max(lastOpenTd, lastOpenTh);
      
      if (lastOpenCell > lastCloseTagIndex) {
        // We have an unclosed cell
        // Check if it's td or th
        const cellType = lastOpenTd > lastOpenTh ? 'td' : 'th';
        
        // Find the position where the cell content starts
        const cellContentStart = fixedHtml.indexOf('>', lastOpenCell) + 1;
        
        // Check if the content looks incomplete (e.g., ends with "$" or other special chars)
        const cellContent = fixedHtml.substring(cellContentStart);
        if (cellContent && !cellContent.includes(`</${cellType}>`)) {
          // Close the incomplete cell content
          // If it ends with incomplete LaTeX or special characters, complete or remove them
          if (cellContent.endsWith('$') && !cellContent.endsWith('$$')) {
            // Incomplete LaTeX, close it
            fixedHtml += '$';
          }
          
          // Close the cell
          if (!unclosedTags.includes(cellType)) {
            unclosedTags.unshift(cellType);
          }
        }
      }
    }
    
    // Auto-close unclosed tags in the correct order
    if (unclosedTags.length > 0) {
      console.warn(`Auto-fixing incomplete table HTML. Unclosed tags: ${unclosedTags.join(', ')}`);
      
      // Close tags in the order they appear in unclosedTags (which is reverse order of opening)
      for (const tag of unclosedTags) {
        fixedHtml += `</${tag}>`;
      }
    }
    
    // Validate the structure one more time
    // Ensure it ends with </table>
    if (!fixedHtml.endsWith('</table>')) {
      // Find if there's a </table> somewhere in the string
      const tableCloseIndex = fixedHtml.lastIndexOf('</table>');
      if (tableCloseIndex === -1) {
        // No </table> at all, add it
        fixedHtml += '</table>';
      } else if (tableCloseIndex < fixedHtml.length - 8) {
        // There's content after </table>, which shouldn't happen
        // Truncate the content after </table>
        fixedHtml = fixedHtml.substring(0, tableCloseIndex + 8);
      }
    }
    
    return fixedHtml;
  }
  
  /**
   * Process image paths to construct proper static URLs
   */
  private static processImagePath(markdownContent: string, taskId?: string): string {
    // Try to get task ID from parameter or URL
    if (!taskId) {
      const currentUrl = window.location.href;
      const taskIdMatch = currentUrl.match(/[?&]task=([^&]+)/);
      if (taskIdMatch) {
        taskId = taskIdMatch[1];
      }
    }
    
    if (!taskId) {
      console.warn('Cannot determine task ID for image path processing');
      return markdownContent;
    }
    
    // Replace image paths with proper static URLs
    return markdownContent.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (match, altText, imagePath) => {
        // Skip if it's already a full URL
        if (imagePath.startsWith('http') || imagePath.startsWith('/static/')) {
          return match;
        }
        
        // Construct proper static URL
        let staticPath;
        if (imagePath.includes('/')) {
          // Path with directory structure (e.g., "images/filename.jpg")
          staticPath = `/static/${taskId}/${imagePath}`;
        } else {
          // Just filename, assume it's in images directory
          staticPath = `/static/${taskId}/images/${imagePath}`;
        }
        
        return `![${altText}](${staticPath})`;
      }
    );
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
   * 
   * NOTE: Since all blocks are now wrapped with explicit data-block-index attributes,
   * we don't need sequential mapping anymore. This method returns an empty map.
   */
  static createBlockMapping(_blocks: BlockData[]): Map<number, number> {
    const mapping = new Map<number, number>();
    
    // Block mapping: All blocks use explicit data-block-index attributes, no sequential mapping needed
    
    // Return empty map - blocks are self-identifying through data attributes
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

  /**
   * Generate clean markdown content for copying (without HTML block containers or page separators)
   * This produces pure markdown without any HTML wrapper elements or page breaks
   */
  static generateCleanMarkdown(blocks: BlockData[], taskId?: string): string {
    if (!blocks || blocks.length === 0) {
      return '';
    }

    const markdownParts: string[] = [];

    // Sort blocks by page and then by index
    const sortedBlocks = [...blocks].sort((a, b) => {
      if (a.page_num !== b.page_num) {
        return a.page_num - b.page_num;
      }
      return a.index - b.index;
    });

    for (const block of sortedBlocks) {
      // Format content based on block type
      const formattedContent = this.formatBlockContent(block, taskId);
      if (formattedContent.trim()) {
        // For clean markdown, just add the content without any HTML wrappers or page separators
        markdownParts.push(formattedContent);
      }
    }

    return markdownParts.join('\n\n');
  }
}