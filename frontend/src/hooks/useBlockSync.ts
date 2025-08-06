import { useState, useCallback, useRef, useEffect } from 'react';
import { ProcessingBlock, BlockSyncState } from '@/types';
import { 
  initializeBlockSyncState, 
  updateBlockSyncState,
  findCorrespondingElement
} from '@/utils/blockProcessor';

export interface UseBlockSyncOptions {
  blocks: ProcessingBlock[];
  markdownContent: string;
  onBlockChange?: (blockId: string | null) => void;
  onSyncStateChange?: (state: BlockSyncState) => void;
  enableScrollSync?: boolean;
  debounceMs?: number;
}

export interface UseBlockSyncReturn {
  // Current state
  blockSyncState: BlockSyncState;
  
  // Actions
  selectBlock: (blockIndex: number | null) => void;
  highlightBlock: (blockIndex: number, temporary?: boolean) => void;
  clearHighlights: () => void;
  toggleScrollSync: () => void;
  
  // Utilities
  getCorrespondingBlockId: (sectionId: string) => string | null;
  getCorrespondingSectionId: (blockId: string) => string | null;
  scrollToBlock: (blockIndex: number) => void;
  scrollToSection: (sectionIndex: number) => void;
  
  // State queries
  isBlockSelected: (blockIndex: number) => boolean;
  isBlockHighlighted: (blockIndex: number) => boolean;
  getSelectedBlock: () => ProcessingBlock | null;
}

/**
 * Hook for managing block synchronization state and interactions
 * between PDF blocks and Markdown sections
 */
export const useBlockSync = ({
  blocks,
  markdownContent,
  onBlockChange,
  onSyncStateChange,
  enableScrollSync = true,
  debounceMs = 100
}: UseBlockSyncOptions): UseBlockSyncReturn => {
  
  // Initialize sync state
  const [blockSyncState, setBlockSyncState] = useState<BlockSyncState>(() => 
    initializeBlockSyncState(blocks, markdownContent)
  );
  
  // Refs for scroll sync
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollSourceRef = useRef<'pdf' | 'markdown' | null>(null);
  
  // Update state when blocks or content change
  useEffect(() => {
    const newState = initializeBlockSyncState(blocks, markdownContent);
    setBlockSyncState(newState);
  }, [blocks, markdownContent]);
  
  // Call callbacks when state changes
  useEffect(() => {
    onSyncStateChange?.(blockSyncState);
  }, [blockSyncState, onSyncStateChange]);
  
  useEffect(() => {
    onBlockChange?.(blockSyncState.selectedBlockId);
  }, [blockSyncState.selectedBlockId, onBlockChange]);
  
  // Update sync state with debouncing
  const updateSyncState = useCallback((
    updates: Partial<BlockSyncState>,
    immediate = false
  ) => {
    const updateFn = () => {
      setBlockSyncState(prevState => {
        const newState = updateBlockSyncState(prevState, updates);
        return newState;
      });
    };
    
    if (immediate) {
      updateFn();
    } else {
      // Debounce updates
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      scrollTimeoutRef.current = setTimeout(updateFn, debounceMs);
    }
  }, [debounceMs]);
  
  // Select a block by index
  const selectBlock = useCallback((blockIndex: number | null) => {
    const blockId = blockIndex !== null ? `block-${blockIndex}` : null;
    
    updateSyncState({
      selectedBlockId: blockId,
      highlightedBlocks: new Set(blockId ? [blockId] : [])
    }, true);
    
    // Auto-scroll to corresponding section if scroll sync is enabled
    if (blockId && blockSyncState.scrollSyncEnabled) {
      const correspondingSectionId = findCorrespondingElement(blockId, blockSyncState.blockMappings);
      if (correspondingSectionId) {
        const sectionIndex = parseInt(correspondingSectionId.replace('section-', ''));
        scrollToSection(sectionIndex);
      }
    }
  }, [blockSyncState.blockMappings, blockSyncState.scrollSyncEnabled, updateSyncState]);
  
  // Highlight a block temporarily
  const highlightBlock = useCallback((blockIndex: number, temporary = true) => {
    const blockId = `block-${blockIndex}`;
    const newHighlights = new Set(blockSyncState.highlightedBlocks);
    newHighlights.add(blockId);
    
    updateSyncState({
      highlightedBlocks: newHighlights
    });
    
    // Clear temporary highlight after delay
    if (temporary) {
      setTimeout(() => {
        const clearedHighlights = new Set(blockSyncState.highlightedBlocks);
        clearedHighlights.delete(blockId);
        updateSyncState({
          highlightedBlocks: clearedHighlights
        });
      }, 2000);
    }
  }, [blockSyncState.highlightedBlocks, updateSyncState]);
  
  // Clear all highlights
  const clearHighlights = useCallback(() => {
    updateSyncState({
      highlightedBlocks: new Set()
    });
  }, [updateSyncState]);
  
  // Toggle scroll synchronization
  const toggleScrollSync = useCallback(() => {
    updateSyncState({
      scrollSyncEnabled: !blockSyncState.scrollSyncEnabled
    });
  }, [blockSyncState.scrollSyncEnabled, updateSyncState]);
  
  // Get corresponding element IDs
  const getCorrespondingBlockId = useCallback((sectionId: string) => {
    return findCorrespondingElement(sectionId, blockSyncState.blockMappings);
  }, [blockSyncState.blockMappings]);
  
  const getCorrespondingSectionId = useCallback((blockId: string) => {
    return findCorrespondingElement(blockId, blockSyncState.blockMappings);
  }, [blockSyncState.blockMappings]);
  
  // Scroll functions (these would integrate with PDF viewer and markdown viewer components)
  const scrollToBlock = useCallback((blockIndex: number) => {
    lastScrollSourceRef.current = 'pdf';
    
    // Dispatch custom event for PDF viewer to handle
    window.dispatchEvent(new CustomEvent('blockSync:scrollToBlock', {
      detail: { blockIndex }
    }));
  }, []);
  
  const scrollToSection = useCallback((sectionIndex: number) => {
    lastScrollSourceRef.current = 'markdown';
    
    // Dispatch custom event for markdown viewer to handle
    window.dispatchEvent(new CustomEvent('blockSync:scrollToSection', {
      detail: { sectionIndex }
    }));
  }, []);
  
  // State query functions
  const isBlockSelected = useCallback((blockIndex: number) => {
    const blockId = `block-${blockIndex}`;
    return blockSyncState.selectedBlockId === blockId;
  }, [blockSyncState.selectedBlockId]);
  
  const isBlockHighlighted = useCallback((blockIndex: number) => {
    const blockId = `block-${blockIndex}`;
    return blockSyncState.highlightedBlocks.has(blockId);
  }, [blockSyncState.highlightedBlocks]);
  
  const getSelectedBlock = useCallback(() => {
    if (!blockSyncState.selectedBlockId) return null;
    
    const blockIndex = parseInt(blockSyncState.selectedBlockId.replace('block-', ''));
    return blocks[blockIndex] || null;
  }, [blockSyncState.selectedBlockId, blocks]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);
  
  return {
    blockSyncState,
    selectBlock,
    highlightBlock,
    clearHighlights,
    toggleScrollSync,
    getCorrespondingBlockId,
    getCorrespondingSectionId,
    scrollToBlock,
    scrollToSection,
    isBlockSelected,
    isBlockHighlighted,
    getSelectedBlock
  };
};