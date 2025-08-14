/**
 * useScrollSync Hook
 * Manages bidirectional scroll synchronization between PDF and Markdown views
 */

import { useCallback, useRef, useEffect } from 'react';
import { BlockData, BlockSelection } from '../types';
import { BlockProcessor, ContentMatcher } from '../utils/blockProcessor';

export interface UseScrollSyncOptions {
  /** Block data for mapping */
  blockData: BlockData[];
  /** Markdown content */
  markdownContent: string;
  /** Whether scroll sync is enabled */
  enabled?: boolean;
  /** Currently selected block */
  selectedBlock?: BlockSelection;
  /** Scroll sync sensitivity (0-1) */
  sensitivity?: number;
  /** Debounce delay for scroll events (ms) */
  debounceDelay?: number;
}

export interface UseScrollSyncReturn {
  /** Ref for PDF container */
  pdfContainerRef: React.RefObject<HTMLElement>;
  /** Ref for Markdown container */
  markdownContainerRef: React.RefObject<HTMLElement>;
  /** Scroll to a specific block in PDF */
  scrollToBlockInPdf: (blockIndex: number) => void;
  /** Scroll to a specific block in Markdown */
  scrollToBlockInMarkdown: (blockIndex: number) => void;
  /** Sync scroll from PDF to Markdown */
  syncPdfToMarkdown: () => void;
  /** Sync scroll from Markdown to PDF */
  syncMarkdownToPdf: () => void;
  /** Enable/disable scroll sync temporarily */
  setScrollSyncEnabled: (enabled: boolean) => void;
  /** Get the last sync source */
  getLastSyncSource: () => 'pdf' | 'markdown' | null;
}

export const useScrollSync = ({
  blockData,
  markdownContent,
  enabled = true,
  selectedBlock: _selectedBlock,
  sensitivity = 0.7,
  debounceDelay = 50
}: UseScrollSyncOptions): UseScrollSyncReturn => {
  // Container refs
  const pdfContainerRef = useRef<HTMLElement>(null);
  const markdownContainerRef = useRef<HTMLElement>(null);
  
  // State refs
  const syncEnabledRef = useRef(enabled);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncSourceRef = useRef<'pdf' | 'markdown' | null>(null);
  
  // Block mapping
  const blockMappingRef = useRef<Map<number, number>>(new Map());
  
  // Update block mapping when data changes
  useEffect(() => {
    if (blockData.length > 0) {
      blockMappingRef.current = ContentMatcher.matchBlocksToMarkdown(blockData, markdownContent);
    }
  }, [blockData, markdownContent]);

  // Update sync enabled state
  useEffect(() => {
    syncEnabledRef.current = enabled;
  }, [enabled]);

  // Utility: Get visible blocks in container (commented out - unused but may be needed later)
  // const getVisibleBlocks = useCallback((
  //   container: HTMLElement, 
  //   blockElements: NodeListOf<Element>
  // ): number[] => {
  //   const containerRect = container.getBoundingClientRect();
  //   const visibleBlocks: number[] = [];
    
  //   blockElements.forEach((element) => {
  //     const rect = element.getBoundingClientRect();
  //     const blockIndex = parseInt(element.getAttribute('data-block-index') || '-1', 10);
      
  //     if (blockIndex >= 0) {
  //       // Check if block is visible (intersects with container)
  //       const isVisible = (
  //         rect.bottom > containerRect.top &&
  //         rect.top < containerRect.bottom &&
  //         rect.right > containerRect.left &&
  //         rect.left < containerRect.right
  //       );
        
  //       if (isVisible) {
  //         visibleBlocks.push(blockIndex);
  //       }
  //     }
  //   });
    
  //   return visibleBlocks;
  // }, []);

  // Utility: Get scroll position as percentage
  const getScrollPercentage = useCallback((container: HTMLElement): number => {
    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollHeight <= clientHeight) return 0;
    return scrollTop / (scrollHeight - clientHeight);
  }, []);

  // Utility: Set scroll position by percentage
  const setScrollPercentage = useCallback((container: HTMLElement, percentage: number) => {
    const { scrollHeight, clientHeight } = container;
    if (scrollHeight <= clientHeight) return;
    
    const maxScroll = scrollHeight - clientHeight;
    container.scrollTop = Math.max(0, Math.min(maxScroll, percentage * maxScroll));
  }, []);

  // Scroll to specific block in PDF - 强制瞬间定位版本
  const scrollToBlockInPdf = useCallback((blockIndex: number) => {
    const pdfContainer = pdfContainerRef.current;
    if (!pdfContainer || !syncEnabledRef.current) return;

    const block = BlockProcessor.findBlockByIndex(blockData, blockIndex);
    if (!block) return;

    // Find the actual viewport element inside ScrollArea or other scrollable container
    const scrollableElement = pdfContainer.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement ||
                            pdfContainer.querySelector('.overflow-auto') as HTMLElement || 
                            pdfContainer as HTMLElement;
    
    // Find the target page element
    const targetPageElement = pdfContainer.querySelector(`[data-page-number="${block.page_num}"]`) as HTMLElement;
    if (!targetPageElement) return;
    
    // Add instant-scroll class to disable transitions
    scrollableElement.classList.add('instant-scroll');
    pdfContainer.classList.add('instant-scroll');
    
    // Calculate position
    const [, bboxY1, ,] = block.bbox;
    const [, pageHeight] = block.page_size;
    const relativeY = bboxY1 / pageHeight;
    
    const pageRect = targetPageElement.getBoundingClientRect();
    const scrollableRect = scrollableElement.getBoundingClientRect();
    const pageTopInContainer = targetPageElement.offsetTop;
    const blockPositionInPage = relativeY * pageRect.height;
    const targetScrollTop = pageTopInContainer + blockPositionInPage - (scrollableRect.height / 3);
    const finalScrollTop = Math.max(0, targetScrollTop);
    
    // Force instant positioning
    scrollableElement.scrollTop = finalScrollTop;
    if (scrollableElement.scrollTo) {
      scrollableElement.scrollTo({
        top: finalScrollTop,
        left: 0,
        behavior: 'instant' as ScrollBehavior
      });
    }
    
    // Remove instant-scroll class after positioning
    requestAnimationFrame(() => {
      scrollableElement.scrollTop = finalScrollTop;
      requestAnimationFrame(() => {
        scrollableElement.classList.remove('instant-scroll');
        pdfContainer.classList.remove('instant-scroll');
      });
    });
    
    lastSyncSourceRef.current = 'markdown';
  }, [blockData]);

  // Scroll to specific block in Markdown - 强制瞬间定位版本
  const scrollToBlockInMarkdown = useCallback((blockIndex: number) => {
    const markdownContainer = markdownContainerRef.current;
    if (!markdownContainer || !syncEnabledRef.current) return;

    // Find the actual viewport element inside ScrollArea
    const scrollableElement = markdownContainer.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement ||
                            (markdownContainer.hasAttribute('data-radix-scroll-area-viewport') ? markdownContainer : markdownContainer) as HTMLElement;
    
    // Find the block element within the scrollable area
    const blockElement = scrollableElement.querySelector(`[data-block-index="${blockIndex}"]`) as HTMLElement;
    if (!blockElement) return;
    
    // Add instant-scroll class to disable transitions
    scrollableElement.classList.add('instant-scroll');
    markdownContainer.classList.add('instant-scroll');
    
    // Calculate position
    const elementRect = blockElement.getBoundingClientRect();
    const containerRect = scrollableElement.getBoundingClientRect();
    const elementTop = blockElement.offsetTop;
    const elementHeight = elementRect.height;
    const containerHeight = containerRect.height;
    
    // 计算将元素居中的位置
    const targetScrollTop = elementTop - (containerHeight / 2) + (elementHeight / 2);
    const finalScrollTop = Math.max(0, targetScrollTop);
    
    // Force instant positioning
    scrollableElement.scrollTop = finalScrollTop;
    if (scrollableElement.scrollTo) {
      scrollableElement.scrollTo({
        top: finalScrollTop,
        left: 0,
        behavior: 'instant' as ScrollBehavior
      });
    }
    
    // Remove instant-scroll class after positioning
    requestAnimationFrame(() => {
      scrollableElement.scrollTop = finalScrollTop;
      requestAnimationFrame(() => {
        scrollableElement.classList.remove('instant-scroll');
        markdownContainer.classList.remove('instant-scroll');
      });
    });
    
    lastSyncSourceRef.current = 'pdf';
  }, []);

  // Sync from PDF to Markdown
  const syncPdfToMarkdown = useCallback(() => {
    if (!syncEnabledRef.current || lastSyncSourceRef.current === 'markdown') return;
    
    const pdfContainer = pdfContainerRef.current;
    const markdownContainer = markdownContainerRef.current;
    
    if (!pdfContainer || !markdownContainer) return;

    // Simple percentage-based sync as fallback
    const pdfScrollPercentage = getScrollPercentage(pdfContainer);
    setScrollPercentage(markdownContainer, pdfScrollPercentage * sensitivity);
  }, [sensitivity, getScrollPercentage, setScrollPercentage]);

  // Sync from Markdown to PDF
  const syncMarkdownToPdf = useCallback(() => {
    if (!syncEnabledRef.current || lastSyncSourceRef.current === 'pdf') return;
    
    const pdfContainer = pdfContainerRef.current;
    const markdownContainer = markdownContainerRef.current;
    
    if (!pdfContainer || !markdownContainer) return;

    // Simple percentage-based sync as fallback
    const markdownScrollPercentage = getScrollPercentage(markdownContainer);
    setScrollPercentage(pdfContainer, markdownScrollPercentage * sensitivity);
  }, [sensitivity, getScrollPercentage, setScrollPercentage]);

  // Debounced scroll handlers
  const handlePdfScroll = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      if (lastSyncSourceRef.current !== 'markdown') {
        lastSyncSourceRef.current = 'pdf';
        syncPdfToMarkdown();
      }
      // Reset after delay to allow natural scrolling
      setTimeout(() => {
        if (lastSyncSourceRef.current === 'pdf') {
          lastSyncSourceRef.current = null;
        }
      }, 500);
    }, debounceDelay);
  }, [syncPdfToMarkdown, debounceDelay]);

  const handleMarkdownScroll = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      if (lastSyncSourceRef.current !== 'pdf') {
        lastSyncSourceRef.current = 'markdown';
        syncMarkdownToPdf();
      }
      // Reset after delay to allow natural scrolling
      setTimeout(() => {
        if (lastSyncSourceRef.current === 'markdown') {
          lastSyncSourceRef.current = null;
        }
      }, 500);
    }, debounceDelay);
  }, [syncMarkdownToPdf, debounceDelay]);

  // Attach scroll listeners
  useEffect(() => {
    const pdfContainer = pdfContainerRef.current;
    const markdownContainer = markdownContainerRef.current;
    
    if (!pdfContainer || !markdownContainer || !enabled) return;

    // Use passive listeners for better performance
    pdfContainer.addEventListener('scroll', handlePdfScroll, { passive: true });
    markdownContainer.addEventListener('scroll', handleMarkdownScroll, { passive: true });

    return () => {
      pdfContainer.removeEventListener('scroll', handlePdfScroll);
      markdownContainer.removeEventListener('scroll', handleMarkdownScroll);
      
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [enabled, handlePdfScroll, handleMarkdownScroll]);

  // Removed automatic scrolling on selection change
  // All scrolling is now handled explicitly through direct function calls
  // This prevents conflicts and unwanted bidirectional scrolling

  // Control function
  const setScrollSyncEnabled = useCallback((enabled: boolean) => {
    syncEnabledRef.current = enabled;
  }, []);

  // Get last sync source
  const getLastSyncSource = useCallback(() => {
    return lastSyncSourceRef.current;
  }, []);

  return {
    pdfContainerRef,
    markdownContainerRef,
    scrollToBlockInPdf,
    scrollToBlockInMarkdown,
    syncPdfToMarkdown,
    syncMarkdownToPdf,
    setScrollSyncEnabled,
    getLastSyncSource
  };
};