/**
 * Block Interaction Utilities
 * Handles click highlighting, auto-positioning, and cross-view synchronization
 */

// Currently unused imports - keeping for future implementation
// import { BlockData, BlockSelection } from '../types';
// import { BlockProcessor } from './blockProcessor';

export interface HighlightOptions {
  /** Duration of highlight animation in milliseconds */
  duration?: number;
  /** Highlight color */
  color?: string;
  /** Animation easing */
  easing?: string;
  /** Whether to scroll to highlighted element */
  scrollIntoView?: boolean;
  /** Scroll behavior */
  scrollBehavior?: 'auto' | 'smooth';
  /** Scroll block position */
  scrollBlock?: 'start' | 'center' | 'end' | 'nearest';
}

export interface AutoPositionOptions {
  /** Container to position within */
  container?: HTMLElement;
  /** Offset from container edges */
  offset?: { top?: number; bottom?: number; left?: number; right?: number };
  /** Animation duration */
  duration?: number;
  /** Whether to use smooth scrolling */
  smooth?: boolean;
}

export class BlockInteractionManager {
  private static instance: BlockInteractionManager;
  private highlightTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private animationFrames: Map<string, number> = new Map();

  static getInstance(): BlockInteractionManager {
    if (!BlockInteractionManager.instance) {
      BlockInteractionManager.instance = new BlockInteractionManager();
    }
    return BlockInteractionManager.instance;
  }

  /**
   * Highlight a block element temporarily
   */
  highlightElement(
    element: HTMLElement,
    options: HighlightOptions = {}
  ): void {
    const {
      duration = 2000,
      color = 'rgba(59, 130, 246, 0.3)', // blue-500 with opacity
      easing = 'ease-out',
      scrollIntoView = true,
      scrollBehavior = 'smooth',
      scrollBlock = 'center'
    } = options;

    const elementId = this.getElementId(element);
    
    // Clear existing highlight
    this.clearHighlight(elementId);

    // Add highlight class
    element.classList.add('block-temp-highlight');
    
    // Apply highlight styles
    const originalBackgroundColor = element.style.backgroundColor;
    const originalTransition = element.style.transition;
    
    element.style.transition = `background-color 200ms ${easing}`;
    element.style.backgroundColor = color;

    // Scroll into view if requested
    if (scrollIntoView) {
      element.scrollIntoView({
        behavior: scrollBehavior,
        block: scrollBlock
      });
    }

    // Set timeout to remove highlight
    const timeout = setTimeout(() => {
      element.style.backgroundColor = originalBackgroundColor;
      
      // Remove highlight class after transition
      setTimeout(() => {
        element.classList.remove('block-temp-highlight');
        element.style.transition = originalTransition;
        this.highlightTimeouts.delete(elementId);
      }, 200);
    }, duration);

    this.highlightTimeouts.set(elementId, timeout);
  }

  /**
   * Clear highlight from an element
   */
  clearHighlight(elementId: string): void {
    const timeout = this.highlightTimeouts.get(elementId);
    if (timeout) {
      clearTimeout(timeout);
      this.highlightTimeouts.delete(elementId);
    }
  }

  /**
   * Clear all highlights
   */
  clearAllHighlights(): void {
    this.highlightTimeouts.forEach((timeout, _elementId) => {
      clearTimeout(timeout);
    });
    this.highlightTimeouts.clear();

    // Remove all highlight classes
    document.querySelectorAll('.block-temp-highlight').forEach(element => {
      element.classList.remove('block-temp-highlight');
    });
  }

  /**
   * Auto-position element within container
   */
  autoPosition(
    element: HTMLElement,
    options: AutoPositionOptions = {}
  ): void {
    const {
      container = document.documentElement,
      offset: _offset = { top: 20, bottom: 20, left: 20, right: 20 },
      duration = 300,
      smooth = true
    } = options;

    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    // Calculate optimal scroll position
    const elementCenter = elementRect.top + elementRect.height / 2;
    const containerCenter = containerRect.top + containerRect.height / 2;
    const scrollOffset = elementCenter - containerCenter;

    if (smooth) {
      this.smoothScrollBy(container, scrollOffset, duration);
    } else {
      container.scrollTop += scrollOffset;
    }
  }

  /**
   * Smooth scroll by offset
   */
  private smoothScrollBy(
    element: HTMLElement,
    offset: number,
    duration: number
  ): void {
    const elementId = this.getElementId(element);
    
    // Cancel existing animation
    const existingFrame = this.animationFrames.get(elementId);
    if (existingFrame) {
      cancelAnimationFrame(existingFrame);
    }

    const start = element.scrollTop;
    const target = start + offset;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out)
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      
      element.scrollTop = start + (target - start) * easedProgress;
      
      if (progress < 1) {
        const frame = requestAnimationFrame(animate);
        this.animationFrames.set(elementId, frame);
      } else {
        this.animationFrames.delete(elementId);
      }
    };

    const frame = requestAnimationFrame(animate);
    this.animationFrames.set(elementId, frame);
  }

  /**
   * Get unique identifier for element
   */
  private getElementId(element: HTMLElement): string {
    return element.dataset.blockIndex || element.id || Math.random().toString(36);
  }

  /**
   * Find block element by index in container
   */
  findBlockElement(
    container: HTMLElement,
    blockIndex: number
  ): HTMLElement | null {
    return container.querySelector(`[data-block-index="${blockIndex}"]`) as HTMLElement;
  }

  /**
   * Highlight and scroll to block in PDF
   */
  highlightBlockInPdf(
    pdfContainer: HTMLElement,
    blockIndex: number,
    options: HighlightOptions = {}
  ): boolean {
    const blockElement = this.findBlockElement(pdfContainer, blockIndex);
    if (!blockElement) return false;

    this.highlightElement(blockElement, {
      ...options,
      color: options.color || 'rgba(239, 68, 68, 0.3)' // red highlight for PDF
    });

    return true;
  }

  /**
   * Highlight and scroll to block in Markdown
   */
  highlightBlockInMarkdown(
    markdownContainer: HTMLElement,
    blockIndex: number,
    options: HighlightOptions = {}
  ): boolean {
    const blockElement = this.findBlockElement(markdownContainer, blockIndex);
    if (!blockElement) return false;

    this.highlightElement(blockElement, {
      ...options,
      color: options.color || 'rgba(16, 185, 129, 0.3)' // green highlight for Markdown
    });

    return true;
  }

  /**
   * Synchronize highlighting between PDF and Markdown
   */
  syncHighlight(
    pdfContainer: HTMLElement,
    markdownContainer: HTMLElement,
    blockIndex: number,
    source: 'pdf' | 'markdown' = 'pdf',
    options: HighlightOptions = {}
  ): void {
    if (source === 'pdf') {
      // Highlight in Markdown when PDF is clicked
      this.highlightBlockInMarkdown(markdownContainer, blockIndex, {
        ...options,
        duration: options.duration || 1500
      });
    } else {
      // Highlight in PDF when Markdown is clicked
      this.highlightBlockInPdf(pdfContainer, blockIndex, {
        ...options,
        duration: options.duration || 1500
      });
    }
  }

  /**
   * Create visual connection line between elements (experimental)
   */
  createConnectionLine(
    fromElement: HTMLElement,
    toElement: HTMLElement,
    options: { color?: string; duration?: number; width?: number } = {}
  ): void {
    const { color = '#3B82F6', duration = 1000, width = 2 } = options;

    const fromRect = fromElement.getBoundingClientRect();
    const toRect = toElement.getBoundingClientRect();

    // Create SVG line
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'fixed';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100vw';
    svg.style.height = '100vh';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '1000';

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', (fromRect.left + fromRect.width / 2).toString());
    line.setAttribute('y1', (fromRect.top + fromRect.height / 2).toString());
    line.setAttribute('x2', (toRect.left + toRect.width / 2).toString());
    line.setAttribute('y2', (toRect.top + toRect.height / 2).toString());
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', width.toString());
    line.style.opacity = '0';
    line.style.transition = 'opacity 300ms ease-in-out';

    svg.appendChild(line);
    document.body.appendChild(svg);

    // Animate in
    requestAnimationFrame(() => {
      line.style.opacity = '0.8';
    });

    // Remove after duration
    setTimeout(() => {
      line.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(svg);
      }, 300);
    }, duration);
  }

  /**
   * Cleanup all animations and timeouts
   */
  cleanup(): void {
    this.clearAllHighlights();
    
    this.animationFrames.forEach((frame) => {
      cancelAnimationFrame(frame);
    });
    this.animationFrames.clear();
  }
}

/**
 * Convenience functions for common operations
 */
export const blockInteraction = BlockInteractionManager.getInstance();

export const highlightBlock = (
  element: HTMLElement,
  options?: HighlightOptions
) => blockInteraction.highlightElement(element, options);

export const autoPositionBlock = (
  element: HTMLElement,
  options?: AutoPositionOptions
) => blockInteraction.autoPosition(element, options);

export const syncBlockHighlight = (
  pdfContainer: HTMLElement,
  markdownContainer: HTMLElement,
  blockIndex: number,
  source?: 'pdf' | 'markdown',
  options?: HighlightOptions
) => blockInteraction.syncHighlight(pdfContainer, markdownContainer, blockIndex, source, options);

export const clearAllBlockHighlights = () => blockInteraction.clearAllHighlights();

export default BlockInteractionManager;