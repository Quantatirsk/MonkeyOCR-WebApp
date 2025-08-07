/**
 * useDocumentSearch Hook
 * Manages document search state and highlighting
 */

import { useState, useMemo, useCallback } from 'react';
import { applySearchHighlight } from '../utils';

interface UseDocumentSearchProps {
  content: string;
  initialQuery?: string;
}

interface UseDocumentSearchReturn {
  localQuery: string;
  activeQuery: string;
  processedContent: string;
  setLocalQuery: (query: string) => void;
  executeSearch: (query?: string) => void;
  clearSearch: () => void;
}

export const useDocumentSearch = ({
  content,
  initialQuery = ''
}: UseDocumentSearchProps): UseDocumentSearchReturn => {
  const [localQuery, setLocalQuery] = useState(initialQuery);
  const [activeQuery, setActiveQuery] = useState('');

  const processedContent = useMemo(() => {
    return applySearchHighlight(content, activeQuery);
  }, [content, activeQuery]);

  const executeSearch = useCallback((query?: string) => {
    const searchQuery = query !== undefined ? query : localQuery;
    setActiveQuery(searchQuery);
  }, [localQuery]);

  const clearSearch = useCallback(() => {
    setLocalQuery('');
    setActiveQuery('');
  }, []);

  return {
    localQuery,
    activeQuery,
    processedContent,
    setLocalQuery,
    executeSearch,
    clearSearch
  };
};