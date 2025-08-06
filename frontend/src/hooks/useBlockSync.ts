/**
 * useBlockSync Hook
 * Manages block selection state and synchronization between PDF and Markdown views
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { BlockData, BlockSelection, BlockSyncState } from '../types';
import { BlockProcessor } from '../utils/blockProcessor';

export interface UseBlockSyncOptions {
  /** Block data for synchronization */
  blockData: BlockData[];
  /** Whether sync is enabled */
  enabled?: boolean;
  /** Initial selected block */
  initialSelection?: BlockSelection;
  /** Callback for selection changes */
  onSelectionChange?: (selection: BlockSelection) => void;
  /** Callback for block interactions */
  onBlockInteraction?: (blockIndex: number, action: 'click' | 'hover' | 'unhover') => void;
}

export interface UseBlockSyncReturn {
  /** Current sync state */
  syncState: BlockSyncState;
  /** Currently selected block */
  selectedBlock: BlockSelection;
  /** Array of highlighted block indices */
  highlightedBlocks: number[];
  /** Whether sync is currently enabled */
  isSyncEnabled: boolean;
  /** Whether scroll sync is enabled */
  isScrollSyncEnabled: boolean;
  
  /** Select a block */
  selectBlock: (blockIndex: number, pageNumber?: number) => void;
  /** Clear selection */
  clearSelection: () => void;
  /** Highlight blocks */
  highlightBlocks: (blockIndices: number[]) => void;
  /** Clear highlights */
  clearHighlights: () => void;
  /** Toggle sync enabled state */
  toggleSync: () => void;
  /** Toggle scroll sync */
  toggleScrollSync: () => void;
  /** Handle block click from PDF */
  handlePdfBlockClick: (blockIndex: number, pageNumber: number) => void;
  /** Handle block hover from PDF */
  handlePdfBlockHover: (blockIndex: number | null, pageNumber: number) => void;
  /** Handle block click from Markdown */
  handleMarkdownBlockClick: (blockIndex: number) => void;
  /** Handle block hover from Markdown */
  handleMarkdownBlockHover: (blockIndex: number | null) => void;
  /** Get block by index */
  getBlock: (blockIndex: number) => BlockData | null;
  /** Get blocks for specific page */
  getBlocksForPage: (pageNumber: number) => BlockData[];
}

export const useBlockSync = ({
  blockData,
  enabled = true,
  initialSelection,
  onSelectionChange,
  onBlockInteraction
}: UseBlockSyncOptions): UseBlockSyncReturn => {
  // Core state
  const [syncState, setSyncState] = useState<BlockSyncState>(() => ({
    selectedBlock: initialSelection || BlockProcessor.createEmptySelection(),
    highlightedBlocks: [],
    syncEnabled: enabled,
    scrollSyncEnabled: enabled
  }));

  // Hover tracking
  const [hoveredBlock, setHoveredBlock] = useState<number | null>(null);
  
  // Refs for avoiding stale closures
  const syncStateRef = useRef(syncState);
  syncStateRef.current = syncState;

  // Update sync state when enabled changes
  useEffect(() => {
    setSyncState(prev => ({
      ...prev,
      syncEnabled: enabled,
      scrollSyncEnabled: enabled
    }));
  }, [enabled]);

  // Notify selection changes
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(syncState.selectedBlock);
    }
  }, [syncState.selectedBlock, onSelectionChange]);

  // Core actions
  const selectBlock = useCallback((blockIndex: number, pageNumber?: number) => {
    if (!syncState.syncEnabled) return;

    const block = BlockProcessor.findBlockByIndex(blockData, blockIndex);
    if (!block) return;

    const newSelection = BlockProcessor.createBlockSelection(
      blockIndex, 
      pageNumber || block.page_num
    );

    setSyncState(prev => ({
      ...prev,
      selectedBlock: newSelection
    }));

    if (onBlockInteraction) {
      onBlockInteraction(blockIndex, 'click');
    }
  }, [blockData, syncState.syncEnabled, onBlockInteraction]);

  const clearSelection = useCallback(() => {
    setSyncState(prev => ({
      ...prev,
      selectedBlock: BlockProcessor.createEmptySelection()
    }));
  }, []);

  const highlightBlocks = useCallback((blockIndices: number[]) => {
    setSyncState(prev => ({
      ...prev,
      highlightedBlocks: [...blockIndices]
    }));
  }, []);

  const clearHighlights = useCallback(() => {
    setSyncState(prev => ({
      ...prev,
      highlightedBlocks: []
    }));
  }, []);

  const toggleSync = useCallback(() => {
    setSyncState(prev => ({
      ...prev,
      syncEnabled: !prev.syncEnabled
    }));
  }, []);

  const toggleScrollSync = useCallback(() => {
    setSyncState(prev => ({
      ...prev,
      scrollSyncEnabled: !prev.scrollSyncEnabled
    }));
  }, []);

  // PDF interaction handlers
  const handlePdfBlockClick = useCallback((blockIndex: number, pageNumber: number) => {
    if (blockIndex < 0) {
      clearSelection();
      return;
    }

    selectBlock(blockIndex, pageNumber);
  }, [selectBlock, clearSelection]);

  const handlePdfBlockHover = useCallback((blockIndex: number | null, _pageNumber: number) => {
    setHoveredBlock(blockIndex);
    
    if (blockIndex !== null && onBlockInteraction) {
      onBlockInteraction(blockIndex, 'hover');
    }
  }, [onBlockInteraction]);

  // Markdown interaction handlers
  const handleMarkdownBlockClick = useCallback((blockIndex: number) => {
    selectBlock(blockIndex);
  }, [selectBlock]);

  const handleMarkdownBlockHover = useCallback((blockIndex: number | null) => {
    setHoveredBlock(blockIndex);
    
    if (blockIndex !== null && onBlockInteraction) {
      onBlockInteraction(blockIndex, 'hover');
    }
  }, [onBlockInteraction]);

  // Utility functions
  const getBlock = useCallback((blockIndex: number): BlockData | null => {
    return BlockProcessor.findBlockByIndex(blockData, blockIndex);
  }, [blockData]);

  const getBlocksForPage = useCallback((pageNumber: number): BlockData[] => {
    return BlockProcessor.getBlocksForPage(blockData, pageNumber);
  }, [blockData]);

  // Enhanced highlighted blocks including hover
  const enhancedHighlightedBlocks = [...syncState.highlightedBlocks];
  if (hoveredBlock !== null && !enhancedHighlightedBlocks.includes(hoveredBlock)) {
    enhancedHighlightedBlocks.push(hoveredBlock);
  }

  return {
    // State
    syncState,
    selectedBlock: syncState.selectedBlock,
    highlightedBlocks: enhancedHighlightedBlocks,
    isSyncEnabled: syncState.syncEnabled,
    isScrollSyncEnabled: syncState.scrollSyncEnabled,
    
    // Actions
    selectBlock,
    clearSelection,
    highlightBlocks,
    clearHighlights,
    toggleSync,
    toggleScrollSync,
    
    // Interaction handlers
    handlePdfBlockClick,
    handlePdfBlockHover,
    handleMarkdownBlockClick,
    handleMarkdownBlockHover,
    
    // Utilities
    getBlock,
    getBlocksForPage
  };
};