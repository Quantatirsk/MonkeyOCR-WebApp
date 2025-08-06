import { ProcessingBlock, BlockSyncState } from '@/types';

export interface BlockInteractionOptions {
  smoothScrolling?: boolean;
  highlightDuration?: number;
  clickFeedback?: boolean;
  autoScrollOffset?: number;
  animationDuration?: number;
}

const DEFAULT_OPTIONS: BlockInteractionOptions = {
  smoothScrolling: true,
  highlightDuration: 2000,
  clickFeedback: true,
  autoScrollOffset: 100,
  animationDuration: 300
};

/**
 * Block interaction utilities for handling click events, highlighting,
 * and automatic positioning between PDF and Markdown views
 */
export class BlockInteractionManager {
  private options: BlockInteractionOptions;
  private activeHighlights = new Set<string>();
  private clickFeedbackTimeout: NodeJS.Timeout | null = null;
  
  constructor(options: Partial<BlockInteractionOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }
  
  /**
   * Handle block click event with visual feedback and synchronization
   */
  async handleBlockClick(
    blockIndex: number,
    source: 'pdf' | 'markdown',
    onSync: (targetBlockIndex: number, targetSource: 'pdf' | 'markdown') => void,
    blockSyncState: BlockSyncState
  ): Promise<void> {
    const blockId = `block-${blockIndex}`;
    
    // Provide immediate click feedback
    if (this.options.clickFeedback) {
      this.showClickFeedback(blockId, source);
    }
    
    // Find corresponding element in the other view
    const correspondingId = source === 'pdf' 
      ? blockSyncState.blockMappings.get(blockId)
      : blockSyncState.blockMappings.get(`section-${blockIndex}`);
    
    if (correspondingId) {
      const targetIndex = parseInt(
        correspondingId.replace(source === 'pdf' ? 'section-' : 'block-', '')
      );
      const targetSource = source === 'pdf' ? 'markdown' : 'pdf';
      
      // Trigger synchronization
      onSync(targetIndex, targetSource);
      
      // Scroll to target with animation
      await this.scrollToTarget(targetIndex, targetSource);
      
      // Highlight both source and target
      this.highlightBlockPair(blockIndex, targetIndex, source);
    }
  }
  
  /**
   * Show visual click feedback
   */
  private showClickFeedback(blockId: string, source: 'pdf' | 'markdown'): void {
    const selector = source === 'pdf' 
      ? `[data-block-id="${blockId}"]`
      : `[data-block-index="${blockId.replace('block-', '')}"]`;
    
    const element = document.querySelector(selector) as HTMLElement;
    if (!element) return;
    
    // Add click feedback class
    element.classList.add('block-click-feedback');
    
    // Remove feedback class after animation
    if (this.clickFeedbackTimeout) {
      clearTimeout(this.clickFeedbackTimeout);
    }
    
    this.clickFeedbackTimeout = setTimeout(() => {
      element.classList.remove('block-click-feedback');
    }, this.options.animationDuration || 300);
  }
  
  /**
   * Scroll to target block/section with animation
   */
  private async scrollToTarget(
    targetIndex: number,
    targetSource: 'pdf' | 'markdown'
  ): Promise<void> {
    return new Promise((resolve) => {
      // Dispatch custom event for the target view to handle scrolling
      const eventName = targetSource === 'pdf' 
        ? 'blockSync:scrollToBlock' 
        : 'blockSync:scrollToSection';
      
      const event = new CustomEvent(eventName, {
        detail: {
          [targetSource === 'pdf' ? 'blockIndex' : 'sectionIndex']: targetIndex,
          smooth: this.options.smoothScrolling,
          offset: this.options.autoScrollOffset,
          callback: resolve
        }
      });
      
      window.dispatchEvent(event);
      
      // Fallback timeout in case event isn't handled
      setTimeout(resolve, 500);
    });
  }
  
  /**
   * Highlight both blocks in the synchronized pair
   */
  private highlightBlockPair(
    sourceIndex: number,
    targetIndex: number,
    source: 'pdf' | 'markdown'
  ): void {
    const sourceId = `${source}-block-${sourceIndex}`;
    const targetId = `${source === 'pdf' ? 'markdown' : 'pdf'}-block-${targetIndex}`;
    
    // Add to active highlights
    this.activeHighlights.add(sourceId);
    this.activeHighlights.add(targetId);
    
    // Apply highlight styles
    this.applyHighlight(sourceIndex, source);
    this.applyHighlight(targetIndex, source === 'pdf' ? 'markdown' : 'pdf');
    
    // Remove highlights after duration
    setTimeout(() => {
      this.removeHighlight(sourceIndex, source);
      this.removeHighlight(targetIndex, source === 'pdf' ? 'markdown' : 'pdf');
      
      this.activeHighlights.delete(sourceId);
      this.activeHighlights.delete(targetId);
    }, this.options.highlightDuration);
  }
  
  /**
   * Apply highlight style to a specific block
   */
  private applyHighlight(blockIndex: number, source: 'pdf' | 'markdown'): void {
    const selector = source === 'pdf'
      ? `[data-block-id="block-${blockIndex}"]`
      : `[data-block-index="${blockIndex}"]`;
    
    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      element.classList.add('block-sync-highlight');
      
      // Add pulse animation for emphasis
      element.style.animation = `blockPulse ${this.options.animationDuration}ms ease-in-out`;
    }
  }
  
  /**
   * Remove highlight style from a specific block
   */
  private removeHighlight(blockIndex: number, source: 'pdf' | 'markdown'): void {
    const selector = source === 'pdf'
      ? `[data-block-id="block-${blockIndex}"]`
      : `[data-block-index="${blockIndex}"]`;
    
    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      element.classList.remove('block-sync-highlight');
      element.style.animation = '';
    }
  }
  
  /**
   * Handle mouse hover events for preview highlighting
   */
  handleBlockHover(
    blockIndex: number | null,
    source: 'pdf' | 'markdown',
    blockSyncState: BlockSyncState
  ): void {
    // Clear previous hover highlights
    this.clearHoverHighlights();
    
    if (blockIndex === null) return;
    
    const blockId = source === 'markdown' ? `section-${blockIndex}` : `block-${blockIndex}`;
    const correspondingId = blockSyncState.blockMappings.get(blockId);
    
    if (correspondingId) {
      const targetIndex = parseInt(
        correspondingId.replace(source === 'pdf' ? 'section-' : 'block-', '')
      );
      
      // Apply hover highlight to corresponding block
      this.applyHoverHighlight(targetIndex, source === 'pdf' ? 'markdown' : 'pdf');
    }
  }
  
  /**
   * Apply hover highlight (lighter than click highlight)
   */
  private applyHoverHighlight(blockIndex: number, source: 'pdf' | 'markdown'): void {
    const selector = source === 'pdf'
      ? `[data-block-id="block-${blockIndex}"]`
      : `[data-block-index="${blockIndex}"]`;
    
    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      element.classList.add('block-hover-highlight');
    }
  }
  
  /**
   * Clear all hover highlights
   */
  private clearHoverHighlights(): void {
    document.querySelectorAll('.block-hover-highlight').forEach(element => {
      element.classList.remove('block-hover-highlight');
    });
  }
  
  /**
   * Auto-position blocks based on current viewport
   */
  autoPositionBlocks(
    visibleBlocks: number[],
    source: 'pdf' | 'markdown',
    blockSyncState: BlockSyncState,
    onPositionUpdate?: (blockIndex: number) => void
  ): void {
    if (visibleBlocks.length === 0) return;
    
    // Get the most prominent visible block (usually the first one)
    const primaryBlock = visibleBlocks[0];
    const blockId = source === 'markdown' ? `section-${primaryBlock}` : `block-${primaryBlock}`;
    const correspondingId = blockSyncState.blockMappings.get(blockId);
    
    if (correspondingId && onPositionUpdate) {
      const targetIndex = parseInt(
        correspondingId.replace(source === 'pdf' ? 'section-' : 'block-', '')
      );
      
      onPositionUpdate(targetIndex);
    }
  }
  
  /**
   * Calculate optimal scroll position for a block
   */
  calculateOptimalScrollPosition(
    blockIndex: number,
    containerElement: HTMLElement,
    blocks: ProcessingBlock[]
  ): number {
    if (!blocks[blockIndex]) return 0;
    
    const block = blocks[blockIndex];
    const containerHeight = containerElement.clientHeight;
    
    // Calculate block position (this would need to be adapted based on actual rendering)
    const blockPosition = this.estimateBlockPosition(block, containerElement);
    const blockHeight = Math.abs(block.bbox[3] - block.bbox[1]);
    
    // Position block in the upper third of the viewport for optimal readability
    const targetPosition = blockPosition - (containerHeight / 3);
    
    return Math.max(0, targetPosition);
  }
  
  /**
   * Estimate block position in the rendered container
   */
  private estimateBlockPosition(block: ProcessingBlock, containerElement: HTMLElement): number {
    // This is a simplified estimation - in practice, you'd need to account for:
    // - PDF scaling factors
    // - Page breaks and margins
    // - Actual rendered positions
    
    const bbox = block.bbox;
    const blockY = bbox[1]; // y-coordinate from bbox
    
    // Apply scaling and positioning logic based on container
    // This would need to be customized based on your PDF rendering implementation
    return blockY * (containerElement.scrollHeight / 1000); // Example scaling
  }
  
  /**
   * Cleanup method to clear all active highlights and timeouts
   */
  cleanup(): void {
    this.clearHoverHighlights();
    this.activeHighlights.clear();
    
    if (this.clickFeedbackTimeout) {
      clearTimeout(this.clickFeedbackTimeout);
      this.clickFeedbackTimeout = null;
    }
    
    // Remove all sync highlights
    document.querySelectorAll('.block-sync-highlight, .block-click-feedback').forEach(element => {
      element.classList.remove('block-sync-highlight', 'block-click-feedback');
      (element as HTMLElement).style.animation = '';
    });
  }
  
  /**
   * Update interaction options
   */
  updateOptions(newOptions: Partial<BlockInteractionOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }
}

/**
 * Create and configure a global block interaction manager
 */
export const createBlockInteractionManager = (
  options?: Partial<BlockInteractionOptions>
): BlockInteractionManager => {
  return new BlockInteractionManager(options);
};

/**
 * CSS animation keyframes for block interactions (to be added to global styles)
 */
export const BLOCK_INTERACTION_STYLES = `
.block-click-feedback {
  transform: scale(1.02) !important;
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.3) !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

.block-sync-highlight {
  background-color: rgba(59, 130, 246, 0.15) !important;
  border-left-color: rgb(59, 130, 246) !important;
  box-shadow: 0 0 15px rgba(59, 130, 246, 0.2) !important;
}

.block-hover-highlight {
  background-color: rgba(59, 130, 246, 0.08) !important;
  transition: background-color 0.2s ease !important;
}

@keyframes blockPulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.01);
    opacity: 0.9;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
`;

// Export utility functions
export {
  DEFAULT_OPTIONS as DEFAULT_BLOCK_INTERACTION_OPTIONS
};