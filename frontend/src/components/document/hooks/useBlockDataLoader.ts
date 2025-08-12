/**
 * useBlockDataLoader Hook
 * Manages block data loading for compare and translation views
 */

import { useState, useEffect } from 'react';
import { apiClient } from '../../../api/client';
import type { BlockData } from '../../../types';
import { TAB_TYPES } from '../constants';

interface UseBlockDataLoaderProps {
  taskId?: string | null;
  hasResult: boolean;
  activeTab: string;
  enabled?: boolean;
}

interface UseBlockDataLoaderReturn {
  blockData: BlockData[];
  loading: boolean;
  error: string | null;
}

export const useBlockDataLoader = ({
  taskId,
  hasResult,
  activeTab,
  enabled = true
}: UseBlockDataLoaderProps): UseBlockDataLoaderReturn => {
  const [blockData, setBlockData] = useState<BlockData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedTaskId, setLoadedTaskId] = useState<string | null>(null);

  useEffect(() => {
    const shouldLoad = 
      enabled &&
      taskId &&
      hasResult &&
      (activeTab === TAB_TYPES.COMPARE || activeTab === TAB_TYPES.TRANSLATION) &&
      !loading &&
      loadedTaskId !== taskId;

    if (shouldLoad) {
      const loadBlockData = async () => {
        setLoading(true);
        setError(null);

        // Clear previous data if switching tasks
        if (loadedTaskId !== null && loadedTaskId !== taskId) {
          setBlockData([]);
        }

        try {
          const response = await apiClient.getTaskBlockData(taskId);
          if (response.success && response.data?.preproc_blocks) {
            setBlockData(response.data.preproc_blocks);
            setLoadedTaskId(taskId);

            // Verify block indices are sequential
            const blocks = response.data.preproc_blocks;
            const indices = blocks.map(b => b.index).sort((a, b) => a - b);
            const isSequential = indices.every((val, i) => val === i + 1);
            
            if (!isSequential) {
              console.warn('Block indices are not sequential:', indices);
            }
          } else {
            setBlockData([]);
            setLoadedTaskId(taskId);
          }
        } catch (err) {
          console.error('Failed to load block data:', err);
          setError(err instanceof Error ? err.message : 'Failed to load block data');
          setBlockData([]);
          setLoadedTaskId(taskId);
        } finally {
          setLoading(false);
        }
      };

      loadBlockData();
    }
  }, [taskId, hasResult, activeTab, enabled, loading, loadedTaskId]);

  // Clear block data when leaving compare/translation tabs
  useEffect(() => {
    if (activeTab !== TAB_TYPES.COMPARE && activeTab !== TAB_TYPES.TRANSLATION && blockData.length > 0) {
      setBlockData([]);
      setLoadedTaskId(null);
    }
  }, [activeTab, blockData.length]);

  return {
    blockData,
    loading,
    error
  };
};