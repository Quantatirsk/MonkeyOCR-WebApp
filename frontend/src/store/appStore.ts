/**
 * Zustand state management store for MonkeyOCR WebApp
 * Implements all state and actions defined in types/index.ts
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { 
  AppStore, 
  AppState, 
  ProcessingTask, 
  DocumentResult, 
  APIResponse 
} from '../types';
import { apiClient } from '../api/client';
import { syncManager, SyncStatus } from '../utils/syncManager';

// Store version for migration
const STORE_VERSION = 2;

// Type for serializable task (without File objects)
interface SerializableTask extends Omit<ProcessingTask, 'original_file' | 'original_file_url'> {
  // Keep track of whether original file exists for reconstruction
  has_original_file?: boolean;
}

// Custom storage with data migration
const customStorage = createJSONStorage<any>(() => localStorage);

// Migration function from v1 to v2
function migrateV1toV2(oldState: any) {
  return {
    ...oldState,
    tasks: (oldState.tasks || []).map((task: any) => {
      // Remove old non-serializable fields and mark if they existed
      const { original_file, original_file_url, ...cleanTask } = task;
      return {
        ...cleanTask,
        has_original_file: !!original_file
      };
    }),
    // Clear old results - they'll be fetched fresh from server
    results: {},
    _version: 2
  };
}

// Initial state
const initialState: AppState = {
  tasks: [],
  currentTaskId: null,
  results: new Map(),
  isUploading: false,
  searchQuery: '',
  theme: 'light',
  // Sync state (not persisted)
  syncStatus: null,
  isInitialized: false
};

// Create the Zustand store
export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // State
      ...initialState,
      
      // Sync state (not persisted)
      syncStatus: null as SyncStatus | null,
      isInitialized: false,

      // Computed properties
      get currentTask() {
        const { tasks, currentTaskId } = get();
        return tasks.find(task => task.id === currentTaskId) || null;
      },

      get currentResult() {
        const { results, currentTaskId } = get();
        return currentTaskId ? results.get(currentTaskId) || null : null;
      },

      get completedTasks() {
        const { tasks } = get();
        return tasks.filter(task => task.status === 'completed');
      },

      get isProcessing() {
        const { tasks } = get();
        return tasks.some(task => task.status === 'processing');
      },

      // Task management actions
      addTask: (taskData) => {
        const task: ProcessingTask = {
          id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...taskData,
        };
        
        set((state) => ({
          tasks: [...state.tasks, task],
          currentTaskId: task.id
        }));
      },

      updateTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map(task => 
            task.id === id ? { 
              ...task, 
              ...updates
            } : task
          )
        }));
      },

      setCurrentTask: (taskId) => {
        set({ currentTaskId: taskId });
      },

      removeTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter(task => task.id !== id),
          currentTaskId: state.currentTaskId === id ? null : state.currentTaskId
        }));
        
        // Also remove associated result
        const { results } = get();
        const newResults = new Map(results);
        newResults.delete(id);
        set({ results: newResults });
      },

      // Result management actions
      addResult: (result) => {
        set((state) => {
          const newResults = new Map(state.results);
          newResults.set(result.task_id, result);
          return { results: newResults };
        });
      },

      loadResult: async (taskId) => {
        try {
          const response: APIResponse<DocumentResult> = await apiClient.getTaskResult(taskId);
          if (response.success && response.data) {
            get().addResult(response.data);
          }
        } catch (error) {
          console.error('Failed to load result:', error);
        }
      },

      clearResults: () => {
        set({ results: new Map() });
      },

      // Clear all tasks and results
      clearTasks: () => {
        set({ 
          tasks: [],
          currentTaskId: null,
          results: new Map()
        });
      },

      // UI state actions
      setSearchQuery: (query) => {
        set({ searchQuery: query });
      },

      setUploading: (isUploading) => {
        set({ isUploading });
      },

      toggleTheme: () => {
        set((state) => ({
          theme: state.theme === 'light' ? 'dark' : 'light'
        }));
      },

      // File operations
      uploadFiles: async (files, options = {}) => {
        const { setUploading, pollTaskStatus } = get();
        
        setUploading(true);
        
        try {
          for (const file of files) {
            try {
              // Upload file via API first to get the real task ID
              const response: APIResponse<ProcessingTask> = await apiClient.uploadFile(file, options);
              
              if (response.success && response.data) {
                // Add the task returned from server (no longer storing File objects)
                const serverTask: ProcessingTask = {
                  ...response.data
                };
                
                set((state) => ({
                  tasks: [...state.tasks, serverTask],
                  currentTaskId: serverTask.id
                }));
                
                // Start polling for status updates using server task ID
                pollTaskStatus(serverTask.id);
              } else {
                console.error('Upload failed:', response.error);
              }
            } catch (error) {
              console.error('Upload error:', error);
            }
          }
        } finally {
          setUploading(false);
        }
      },

      pollTaskStatus: async (taskId) => {
        const { updateTask, loadResult } = get();
        const task = get().tasks.find(t => t.id === taskId);
        
        if (!task || task.status === 'completed' || task.status === 'failed') {
          return;
        }
        
        try {
          const response: APIResponse<ProcessingTask> = await apiClient.getTaskStatus(taskId);
          
          if (response.success && response.data) {
            updateTask(taskId, response.data);
            
            // If completed, load the result
            if (response.data.status === 'completed') {
              await loadResult(taskId);
            }
            
            // Continue polling if still processing
            if (response.data.status === 'processing') {
              setTimeout(() => get().pollTaskStatus(taskId), 2000);
            }
          }
        } catch (error) {
          console.error('Failed to poll task status:', error);
          updateTask(taskId, {
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Status check failed'
          });
        }
      },

      // Sync operations
      initializeSync: () => {
        const { isInitialized } = get();
        if (isInitialized) return;

        // 设置同步状态监听器
        syncManager.onSyncStatusChange((status) => {
          set({ syncStatus: status });
        });

        // 标记为已初始化
        set({ isInitialized: true });

        // 页面加载时自动同步（延迟执行避免冲突）
        setTimeout(() => {
          get().syncWithServer().catch(error => {
            console.error('Initial sync failed:', error);
          });
        }, 50);
      },

      syncWithServer: async () => {
        try {
          const serverTasks = await syncManager.smartSync();
          
          if (serverTasks.length > 0) {
            const { tasks, results } = get();
            const mergedTasks = syncManager.mergeTasks(tasks, serverTasks);
            
            set({ tasks: mergedTasks });
            
            // 处理任务状态变化
            mergedTasks.forEach(async (task) => {
              if (task.status === 'processing') {
                // 重新启动处理中任务的轮询
                get().pollTaskStatus(task.id);
              } else if (task.status === 'completed') {
                // 为已完成的任务加载OCR结果（如果还没有加载）
                if (!results.has(task.id)) {
                  try {
                    await get().loadResult(task.id);
                  } catch (error) {
                    console.error(`Failed to load result for task ${task.id}:`, error);
                  }
                }
              }
            });
          }
        } catch (error) {
          console.error('Sync with server failed:', error);
          throw error;
        }
      }
    }),
    {
      name: 'monkeyocr-app-store',
      storage: customStorage,
      // Only persist certain parts of the state with custom serialization
      partialize: (state) => {
        // Remove non-serializable fields before storing
        const tasks = state.tasks?.map((task: ProcessingTask): SerializableTask => {
          const { original_file, original_file_url, ...serializableTask } = task;
          return {
            ...serializableTask,
            has_original_file: !!original_file
          };
        }) || [];
        
        return {
          tasks,
          currentTaskId: state.currentTaskId,
          theme: state.theme,
          searchQuery: state.searchQuery,
          _version: STORE_VERSION
        };
      },
      // Don't persist results and upload state - these should be fresh on reload
      version: STORE_VERSION,
      // Handle version migration
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          console.log('Migrating store from version', version, 'to 2');
          return migrateV1toV2(persistedState);
        }
        return persistedState;
      },
      // Trigger rehydration callback
      onRehydrateStorage: () => (state) => {
        if (state) {
          console.log('Store rehydrated with', state.tasks?.length || 0, 'tasks');
          // Initialize empty results map if not present
          if (!state.results || !(state.results instanceof Map)) {
            state.results = new Map();
          }
        }
      },
    }
  )
);

// Utility hooks for specific parts of the store
export const useCurrentTask = () => useAppStore(state => state.currentTask);
export const useCurrentResult = () => useAppStore(state => state.currentResult);
export const useCompletedTasks = () => useAppStore(state => state.completedTasks);
export const useIsProcessing = () => useAppStore(state => state.isProcessing);

// Action hooks
export const useTaskActions = () => useAppStore(state => ({
  addTask: state.addTask,
  updateTask: state.updateTask,
  setCurrentTask: state.setCurrentTask,
  removeTask: state.removeTask,
  uploadFiles: state.uploadFiles,
  pollTaskStatus: state.pollTaskStatus
}));

export const useResultActions = () => useAppStore(state => ({
  addResult: state.addResult,
  loadResult: state.loadResult,
  clearResults: state.clearResults
}));

export const useUIActions = () => useAppStore(state => ({
  setSearchQuery: state.setSearchQuery,
  setUploading: state.setUploading,
  toggleTheme: state.toggleTheme
}));

export const useSyncActions = () => useAppStore(state => ({
  syncWithServer: state.syncWithServer,
  initializeSync: state.initializeSync
}));

export const useSyncStatus = () => useAppStore(state => state.syncStatus);