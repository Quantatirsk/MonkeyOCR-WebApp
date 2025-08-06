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
  selectedBlock,
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

  // Scroll to specific block in PDF - 优化版本，减少日志和延迟
  const scrollToBlockInPdf = useCallback((blockIndex: number) => {
    const pdfContainer = pdfContainerRef.current;
    if (!pdfContainer || !syncEnabledRef.current) return;

    const block = BlockProcessor.findBlockByIndex(blockData, blockIndex);
    if (!block) return;

    // Find the actual scrollable viewport and target page quickly
    const scrollableElement = pdfContainer.querySelector('[data-radix-scroll-area-viewport]') || pdfContainer;
    const targetPageElement = scrollableElement.querySelector(`[data-page-number="${block.page_num}"]`) || 
                             pdfContainer.querySelector(`[data-page-number="${block.page_num}"]`);

    if (targetPageElement) {
      // Calculate position quickly without excessive logging
      const [, bboxY1, ,] = block.bbox;
      const [, pageHeight] = block.page_size;
      const relativeY = bboxY1 / pageHeight;
      
      const pageRect = targetPageElement.getBoundingClientRect();
      const scrollableRect = (scrollableElement as HTMLElement).getBoundingClientRect();
      const pageTopInContainer = (targetPageElement as HTMLElement).offsetTop;
      const blockPositionInPage = relativeY * pageRect.height;
      const targetScrollTop = pageTopInContainer + blockPositionInPage - (scrollableRect.height / 3);
      
      // 快速滚动动画，保持视觉效果但大幅提升速度
      (scrollableElement as HTMLElement).scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth' // 保持smooth动画，但通过CSS加速
      });
      
      console.log(`⚡ Fast PDF scroll to block ${blockIndex}`);
    }
    
    lastSyncSourceRef.current = 'markdown';
  }, [blockData]);

  // Scroll to specific block in Markdown
  const scrollToBlockInMarkdown = useCallback((blockIndex: number) => {
    const markdownContainer = markdownContainerRef.current;
    if (!markdownContainer || !syncEnabledRef.current) return;

    const blockElement = markdownContainer.querySelector(`[data-block-index="${blockIndex}"]`);
    if (blockElement) {
      blockElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
    
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

  // Auto-scroll to selected block (仅处理PDF→Markdown方向，Markdown→PDF由DocumentViewer处理)
  useEffect(() => {
    if (!selectedBlock?.isActive || selectedBlock.blockIndex === null) return;
    
    const blockIndex = selectedBlock.blockIndex;
    
    // 使用requestAnimationFrame确保DOM更新完成，比setTimeout更快
    requestAnimationFrame(() => {
      if (lastSyncSourceRef.current === 'pdf') {
        scrollToBlockInMarkdown(blockIndex);
      }
      // 注释掉Markdown→PDF滚动，由DocumentViewer统一处理以避免冲突
      // else if (lastSyncSourceRef.current === 'markdown') {
      //   scrollToBlockInPdf(blockIndex);
      // }
    });
  }, [selectedBlock, scrollToBlockInMarkdown]); // 移除scrollToBlockInPdf依赖

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