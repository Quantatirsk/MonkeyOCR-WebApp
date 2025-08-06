import { useRef, useEffect, useCallback } from 'react';
import { ProcessingBlock, BlockSyncState } from '@/types';

export interface UseScrollSyncOptions {
  enabled: boolean;
  blockSyncState: BlockSyncState;
  blocks: ProcessingBlock[];
  onBlockInView?: (blockIndex: number) => void;
  throttleMs?: number;
}

export interface UseScrollSyncReturn {
  pdfContainerRef: React.RefObject<HTMLElement>;
  markdownContainerRef: React.RefObject<HTMLElement>;
  syncScrollPosition: (source: 'pdf' | 'markdown', scrollTop: number, containerHeight: number) => void;
  getCurrentVisibleBlocks: () => number[];
}

/**
 * Hook for bidirectional scroll synchronization between PDF and Markdown views
 * Implements intelligent scroll mapping based on block positions and content visibility
 */
export const useScrollSync = ({
  enabled,
  blockSyncState,
  blocks,
  onBlockInView,
  throttleMs = 100
}: UseScrollSyncOptions): UseScrollSyncReturn => {
  
  const pdfContainerRef = useRef<HTMLElement>(null);
  const markdownContainerRef = useRef<HTMLElement>(null);
  
  // Track scroll state to prevent infinite loops
  const scrollStateRef = useRef({
    isScrolling: false,
    lastScrollSource: null as 'pdf' | 'markdown' | null,
    scrollTimeout: null as NodeJS.Timeout | null
  });
  
  // Throttled scroll handler
  const throttledScrollHandler = useRef<{
    pdf: ((...args: any[]) => void) | null;
    markdown: ((...args: any[]) => void) | null;
  }>({
    pdf: null,
    markdown: null
  });
  
  // Initialize throttled handlers
  useEffect(() => {
    throttledScrollHandler.current.pdf = throttle(
      (scrollTop: number, containerHeight: number) => {
        if (scrollStateRef.current.lastScrollSource !== 'markdown') {
          syncFromPdfToMarkdown(scrollTop, containerHeight);
        }
      },
      throttleMs
    );
    
    throttledScrollHandler.current.markdown = throttle(
      (scrollTop: number, containerHeight: number) => {
        if (scrollStateRef.current.lastScrollSource !== 'pdf') {
          syncFromMarkdownToPdf(scrollTop, containerHeight);
        }
      },
      throttleMs
    );
  }, [throttleMs]);
  
  // Sync scroll from PDF to Markdown
  const syncFromPdfToMarkdown = useCallback((scrollTop: number, containerHeight: number) => {
    if (!enabled || !markdownContainerRef.current) return;
    
    scrollStateRef.current.lastScrollSource = 'pdf';
    scrollStateRef.current.isScrolling = true;
    
    // Find visible blocks in PDF viewport
    const visibleBlocks = findVisibleBlocks('pdf', scrollTop, containerHeight);
    
    if (visibleBlocks.length > 0) {
      // Get the primary visible block (usually the first one)
      const primaryBlockIndex = visibleBlocks[0];
      const blockId = `block-${primaryBlockIndex}`;
      
      // Find corresponding section
      const correspondingSectionId = blockSyncState.blockMappings.get(blockId);
      
      if (correspondingSectionId) {
        const sectionIndex = parseInt(correspondingSectionId.replace('section-', ''));
        scrollMarkdownToSection(sectionIndex);
      }
      
      // Notify about block in view
      onBlockInView?.(primaryBlockIndex);
    }
    
    // Reset scroll state after delay
    clearTimeout(scrollStateRef.current.scrollTimeout!);
    scrollStateRef.current.scrollTimeout = setTimeout(() => {
      scrollStateRef.current.isScrolling = false;
      scrollStateRef.current.lastScrollSource = null;
    }, 150);
  }, [enabled, blockSyncState.blockMappings, onBlockInView]);
  
  // Sync scroll from Markdown to PDF
  const syncFromMarkdownToPdf = useCallback((scrollTop: number, containerHeight: number) => {
    if (!enabled || !pdfContainerRef.current) return;
    
    scrollStateRef.current.lastScrollSource = 'markdown';
    scrollStateRef.current.isScrolling = true;
    
    // Find visible sections in Markdown viewport
    const visibleSections = findVisibleSections(scrollTop, containerHeight);
    
    if (visibleSections.length > 0) {
      // Get the primary visible section
      const primarySectionIndex = visibleSections[0];
      const sectionId = `section-${primarySectionIndex}`;
      
      // Find corresponding block
      const correspondingBlockId = blockSyncState.blockMappings.get(sectionId);
      
      if (correspondingBlockId) {
        const blockIndex = parseInt(correspondingBlockId.replace('block-', ''));
        scrollPdfToBlock(blockIndex);
        
        // Notify about block in view
        onBlockInView?.(blockIndex);
      }
    }
    
    // Reset scroll state after delay
    clearTimeout(scrollStateRef.current.scrollTimeout!);
    scrollStateRef.current.scrollTimeout = setTimeout(() => {
      scrollStateRef.current.isScrolling = false;
      scrollStateRef.current.lastScrollSource = null;
    }, 150);
  }, [enabled, blockSyncState.blockMappings, onBlockInView]);
  
  // Main sync function exposed to parent components
  const syncScrollPosition = useCallback((
    source: 'pdf' | 'markdown',
    scrollTop: number,
    containerHeight: number
  ) => {
    if (!enabled || scrollStateRef.current.isScrolling) return;
    
    if (source === 'pdf' && throttledScrollHandler.current.pdf) {
      throttledScrollHandler.current.pdf(scrollTop, containerHeight);
    } else if (source === 'markdown' && throttledScrollHandler.current.markdown) {
      throttledScrollHandler.current.markdown(scrollTop, containerHeight);
    }
  }, [enabled]);
  
  // Find visible blocks in PDF view
  const findVisibleBlocks = useCallback((
    viewType: 'pdf' | 'markdown',
    scrollTop: number,
    containerHeight: number
  ): number[] => {
    const visibleBlocks: number[] = [];
    const viewport = {
      top: scrollTop,
      bottom: scrollTop + containerHeight
    };
    
    blocks.forEach((block, index) => {
      // Calculate block position based on its bbox
      // This is a simplified calculation - in practice, you'd need to account for
      // PDF scaling, page breaks, and actual rendered positions
      const blockTop = calculateBlockPosition(block, viewType);
      const blockHeight = calculateBlockHeight(block);
      const blockBottom = blockTop + blockHeight;
      
      // Check if block intersects with viewport
      if (blockBottom > viewport.top && blockTop < viewport.bottom) {
        // Calculate intersection ratio for ranking
        const intersectionTop = Math.max(blockTop, viewport.top);
        const intersectionBottom = Math.min(blockBottom, viewport.bottom);
        const intersectionHeight = intersectionBottom - intersectionTop;
        const visibilityRatio = intersectionHeight / blockHeight;
        
        if (visibilityRatio > 0.1) { // At least 10% visible
          visibleBlocks.push(index);
        }
      }
    });
    
    return visibleBlocks.sort((a, b) => {
      // Sort by vertical position
      const blockA = blocks[a];
      const blockB = blocks[b];
      const posA = calculateBlockPosition(blockA, viewType);
      const posB = calculateBlockPosition(blockB, viewType);
      return posA - posB;
    });
  }, [blocks]);
  
  // Find visible sections in Markdown view
  const findVisibleSections = useCallback((
    scrollTop: number,
    containerHeight: number
  ): number[] => {
    if (!markdownContainerRef.current) return [];
    
    const container = markdownContainerRef.current;
    const visibleSections: number[] = [];
    const viewport = {
      top: scrollTop,
      bottom: scrollTop + containerHeight
    };
    
    // Find all section elements
    const sectionElements = container.querySelectorAll('[data-block-id]');
    
    sectionElements.forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      // Convert to container-relative coordinates
      const elementTop = rect.top - containerRect.top + scrollTop;
      const elementBottom = elementTop + rect.height;
      
      if (elementBottom > viewport.top && elementTop < viewport.bottom) {
        const intersectionHeight = Math.min(elementBottom, viewport.bottom) - Math.max(elementTop, viewport.top);
        const visibilityRatio = intersectionHeight / rect.height;
        
        if (visibilityRatio > 0.1) {
          visibleSections.push(index);
        }
      }
    });
    
    return visibleSections;
  }, []);
  
  // Calculate block position in rendered view
  const calculateBlockPosition = useCallback((block: ProcessingBlock, viewType: 'pdf' | 'markdown'): number => {
    if (viewType === 'pdf') {
      // For PDF, use the bbox coordinates
      // This would need to be adjusted based on PDF scaling and page layout
      return block.bbox[1]; // y-coordinate
    } else {
      // For markdown, this would be calculated based on DOM elements
      // This is a placeholder - actual implementation would query DOM elements
      return block.index * 100; // Simple approximation
    }
  }, []);
  
  // Calculate block height
  const calculateBlockHeight = useCallback((block: ProcessingBlock): number => {
    // Calculate height from bbox
    return Math.abs(block.bbox[3] - block.bbox[1]);
  }, []);
  
  // Scroll PDF to specific block
  const scrollPdfToBlock = useCallback((blockIndex: number) => {
    if (!pdfContainerRef.current) return;
    
    // Dispatch event for PDF viewer component
    window.dispatchEvent(new CustomEvent('blockSync:scrollToBlock', {
      detail: { blockIndex, smooth: true }
    }));
  }, []);
  
  // Scroll Markdown to specific section
  const scrollMarkdownToSection = useCallback((sectionIndex: number) => {
    if (!markdownContainerRef.current) return;
    
    const sectionElement = markdownContainerRef.current.querySelector(`[data-block-id="section-${sectionIndex}"]`);
    if (sectionElement) {
      sectionElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }, []);
  
  // Get currently visible blocks
  const getCurrentVisibleBlocks = useCallback((): number[] => {
    if (!pdfContainerRef.current) return [];
    
    const container = pdfContainerRef.current;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    
    return findVisibleBlocks('pdf', scrollTop, containerHeight);
  }, [findVisibleBlocks]);
  
  // Set up event listeners for custom scroll events
  useEffect(() => {
    const handleScrollToBlock = (event: CustomEvent) => {
      const { blockIndex } = event.detail;
      scrollPdfToBlock(blockIndex);
    };
    
    const handleScrollToSection = (event: CustomEvent) => {
      const { sectionIndex } = event.detail;
      scrollMarkdownToSection(sectionIndex);
    };
    
    window.addEventListener('blockSync:scrollToBlock', handleScrollToBlock as EventListener);
    window.addEventListener('blockSync:scrollToSection', handleScrollToSection as EventListener);
    
    return () => {
      window.removeEventListener('blockSync:scrollToBlock', handleScrollToBlock as EventListener);
      window.removeEventListener('blockSync:scrollToSection', handleScrollToSection as EventListener);
    };
  }, [scrollPdfToBlock, scrollMarkdownToSection]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scrollStateRef.current.scrollTimeout) {
        clearTimeout(scrollStateRef.current.scrollTimeout);
      }
    };
  }, []);
  
  return {
    pdfContainerRef,
    markdownContainerRef,
    syncScrollPosition,
    getCurrentVisibleBlocks
  };
};

// Throttle utility
function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastExecTime = 0;
  
  return (...args: Parameters<T>) => {
    const currentTime = Date.now();
    
    if (currentTime - lastExecTime > delay) {
      func(...args);
      lastExecTime = currentTime;
    } else {
      if (timeoutId) clearTimeout(timeoutId);
      
      timeoutId = setTimeout(() => {
        func(...args);
        lastExecTime = Date.now();
        timeoutId = null;
      }, delay - (currentTime - lastExecTime));
    }
  };
}