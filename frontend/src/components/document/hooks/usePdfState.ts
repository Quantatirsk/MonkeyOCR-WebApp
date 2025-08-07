/**
 * usePdfState Hook
 * Manages PDF-related state
 */

import { useState, useCallback, useEffect } from 'react';

interface PdfState {
  selectedPage: number | null;
  pageRotations: Record<number, number>;
}

interface UsePdfStateReturn {
  selectedPage: number | null;
  pageRotations: Record<number, number>;
  selectPage: (page: number) => void;
  rotatePage: (page: number) => void;
  resetState: () => void;
}

export const usePdfState = (taskId?: string): UsePdfStateReturn => {
  const [state, setState] = useState<PdfState>({
    selectedPage: null,
    pageRotations: {}
  });

  // Reset state when task changes
  useEffect(() => {
    setState({
      selectedPage: null,
      pageRotations: {}
    });
  }, [taskId]);

  const selectPage = useCallback((page: number) => {
    setState(prev => ({
      ...prev,
      selectedPage: page
    }));
  }, []);

  const rotatePage = useCallback((page: number) => {
    setState(prev => ({
      ...prev,
      pageRotations: {
        ...prev.pageRotations,
        [page]: ((prev.pageRotations[page] || 0) + 90) % 360
      }
    }));
  }, []);

  const resetState = useCallback(() => {
    setState({
      selectedPage: null,
      pageRotations: {}
    });
  }, []);

  return {
    selectedPage: state.selectedPage,
    pageRotations: state.pageRotations,
    selectPage,
    rotatePage,
    resetState
  };
};