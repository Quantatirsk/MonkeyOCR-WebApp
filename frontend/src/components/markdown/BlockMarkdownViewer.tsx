import React, { useRef, useEffect, useMemo } from 'react';
import { ProcessingBlock, BlockSyncState } from '@/types';
import { ModernMarkdownViewer } from './ModernMarkdownViewer';
import { cn } from '@/lib/utils';
import './block-styles.css';

interface BlockMarkdownViewerProps {
  content: string;
  blocks: ProcessingBlock[];
  blockSyncState: BlockSyncState;
  onBlockClick: (blockIndex: number) => void;
  onBlockHover: (blockIndex: number | null) => void;
}

/**
 * Enhanced Markdown viewer with block marking capabilities
 * Renders markdown content with clickable block markers for PDF synchronization
 */
export const BlockMarkdownViewer: React.FC<BlockMarkdownViewerProps> = ({
  content,
  blocks,
  blockSyncState,
  onBlockClick,
  onBlockHover
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Process markdown content to inject block markers
  const processedContent = useMemo(() => {
    if (!blocks || blocks.length === 0) {
      return content;
    }

    // Split content into paragraphs/sections
    const sections = content.split(/\n\n+/);
    const processedSections: string[] = [];

    // Track used blocks to avoid duplicates
    const usedBlockIndexes = new Set<number>();

    sections.forEach((section) => {
      if (!section.trim()) {
        processedSections.push(section);
        return;
      }

      // Find best matching block for this section
      const matchingBlock = findBestMatchingBlock(section, blocks, usedBlockIndexes);
      
      if (matchingBlock) {
        usedBlockIndexes.add(matchingBlock.index);
        
        // Wrap section with block marker
        const blockType = matchingBlock.type;
        const blockId = `block-${matchingBlock.index}`;
        const isSelected = blockSyncState.selectedBlockId === blockId;
        const isHighlighted = blockSyncState.highlightedBlocks.has(blockId);
        
        const markedSection = `
<div class="block-container ${blockType}" data-block-index="${matchingBlock.index}" data-block-id="${blockId}">
  <div class="block-marker ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''}" title="Block ${matchingBlock.index}">
    <span class="block-number">${matchingBlock.index + 1}</span>
  </div>
  <div class="block-content">
${section}
  </div>
</div>`;
        
        processedSections.push(markedSection);
      } else {
        // No matching block found, render without marker
        processedSections.push(section);
      }
    });

    return processedSections.join('\n\n');
  }, [content, blocks, blockSyncState.selectedBlockId, blockSyncState.highlightedBlocks]);

  // Handle block interactions
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const blockContainer = target.closest('.block-container') as HTMLElement;
      
      if (blockContainer) {
        const blockIndex = parseInt(blockContainer.dataset.blockIndex || '-1');
        if (blockIndex >= 0) {
          onBlockClick(blockIndex);
        }
      }
    };

    const handleMouseEnter = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const blockContainer = target.closest('.block-container') as HTMLElement;
      
      if (blockContainer) {
        const blockIndex = parseInt(blockContainer.dataset.blockIndex || '-1');
        if (blockIndex >= 0) {
          onBlockHover(blockIndex);
          blockContainer.classList.add('hovered');
        }
      }
    };

    const handleMouseLeave = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const blockContainer = target.closest('.block-container') as HTMLElement;
      
      if (blockContainer) {
        onBlockHover(null);
        blockContainer.classList.remove('hovered');
      }
    };

    container.addEventListener('click', handleClick);
    container.addEventListener('mouseenter', handleMouseEnter, true);
    container.addEventListener('mouseleave', handleMouseLeave, true);

    return () => {
      container.removeEventListener('click', handleClick);
      container.removeEventListener('mouseenter', handleMouseEnter, true);
      container.removeEventListener('mouseleave', handleMouseLeave, true);
    };
  }, [onBlockClick, onBlockHover]);

  // Scroll to selected block
  useEffect(() => {
    if (blockSyncState.selectedBlockId && containerRef.current) {
      const blockElement = containerRef.current.querySelector(
        `[data-block-id="${blockSyncState.selectedBlockId}"]`
      );
      
      if (blockElement) {
        blockElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [blockSyncState.selectedBlockId]);

  return (
    <div 
      ref={containerRef}
      className={cn(
        'block-markdown-viewer',
        blockSyncState.scrollSyncEnabled && 'sync-enabled'
      )}
    >
      <ModernMarkdownViewer
        content={processedContent}
      />
    </div>
  );
};

/**
 * Find the best matching block for a markdown section
 */
function findBestMatchingBlock(
  section: string, 
  blocks: ProcessingBlock[], 
  usedIndexes: Set<number>
): ProcessingBlock | null {
  // Clean section text for comparison
  const cleanSection = section
    .replace(/[#*_`\[\]]/g, '') // Remove markdown markers
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .toLowerCase();

  if (!cleanSection) return null;

  let bestMatch: ProcessingBlock | null = null;
  let bestScore = 0;

  for (const block of blocks) {
    if (usedIndexes.has(block.index)) continue;

    // Extract content from block lines
    const blockContent = block.lines
      .flatMap(line => line.spans.map(span => span.content))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    if (!blockContent) continue;

    // Calculate similarity score
    const score = calculateSimilarity(cleanSection, blockContent);
    
    if (score > bestScore && score > 0.3) { // Minimum similarity threshold
      bestScore = score;
      bestMatch = block;
    }
  }

  return bestMatch;
}

/**
 * Calculate text similarity score between two strings
 */
function calculateSimilarity(text1: string, text2: string): number {
  // Simple similarity calculation based on common words
  const words1 = text1.split(/\s+/).filter(w => w.length > 2);
  const words2 = text2.split(/\s+/).filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return 0;

  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = [...set1].filter(word => set2.has(word));
  const union = [...new Set([...words1, ...words2])];
  
  return intersection.length / union.length;
}