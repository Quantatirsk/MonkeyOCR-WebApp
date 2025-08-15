/**
 * Zustand state management store for MonkeyOCR WebApp
 * Implements all state and actions defined in types/index.ts
 */

import { createWithEqualityFn } from 'zustand/traditional';
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
import { useAuthStore } from './authStore';

// Store version for migration
const STORE_VERSION = 2;

// Custom storage with data migration
const customStorage = createJSONStorage<any>(() => localStorage);

// Migration function from v1 to v2
function migrateV1toV2(oldState: any) {
  return {
    ...oldState,
    // Don't migrate tasks - they'll be fetched fresh from server
    // This ensures we always have the latest data
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
  // taskListVisible 已迁移到 uiStore
  activeDocumentTab: 'compare',
  // Sync state (not persisted)
  syncStatus: null,
  isInitialized: false
};

// Create the Zustand store
export const useAppStore = createWithEqualityFn<AppStore>()(
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


      get isProcessing() {
        const { tasks } = get();
        return tasks.some(task => task.status === 'processing');
      },

      // Task management actions
      addTask: (taskData) => {
        // Get current user from auth store
        const authState = useAuthStore.getState();
        const userId = authState.user?.id;
        
        const task: ProcessingTask = {
          id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...taskData,
          user_id: userId, // Associate task with current user
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
        set({ 
          currentTaskId: taskId,
          // Automatically switch to compare tab when selecting a task
          activeDocumentTab: taskId ? 'compare' : get().activeDocumentTab
        });
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
      
      // Clear current user's data (called on logout)
      clearUserData: () => {
        // When user logs out, clear ALL tasks and results
        // This ensures no data leakage between sessions
        set({ 
          tasks: [],
          currentTaskId: null,
          results: new Map()
        });
        
        // Clear localStorage to ensure clean state
        // Remove the persisted store data
        localStorage.removeItem('monkeyocr-app-store');
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

      // taskListVisible 相关方法已迁移到 uiStore

      setActiveDocumentTab: (tab) => {
        set({ activeDocumentTab: tab });
      },

      // File operations
      uploadFiles: async (files, options = {}) => {
        const { setUploading, pollTaskStatus, loadResult } = get();
        
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
                
                // If task is already completed (cache hit), load result immediately
                if (serverTask.status === 'completed') {
                  console.log(`Task ${serverTask.id} completed from cache, loading result...`);
                  await loadResult(serverTask.id);
                } else {
                  // Start polling for status updates using server task ID
                  console.log(`Task ${serverTask.id} status: ${serverTask.status}, starting polling...`);
                  pollTaskStatus(serverTask.id);
                }
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

      uploadFromUrl: async (url, options = {}) => {
        const { setUploading, pollTaskStatus, loadResult } = get();
        
        setUploading(true);
        
        try {
          console.log(`Uploading PDF URL to backend: ${url}`);
          
          // Call the backend API to download and process the PDF
          const response: APIResponse<ProcessingTask> = await apiClient.uploadFromUrl(url, options);
          
          if (response.success && response.data) {
            // Add the task returned from server
            const serverTask: ProcessingTask = {
              ...response.data
            };
            
            set((state) => ({
              tasks: [...state.tasks, serverTask],
              currentTaskId: serverTask.id
            }));
            
            // If task is already completed (cache hit), load result immediately
            if (serverTask.status === 'completed') {
              console.log(`Task ${serverTask.id} completed from cache, loading result...`);
              await loadResult(serverTask.id);
            } else {
              // Start polling for status updates
              console.log(`Task ${serverTask.id} status: ${serverTask.status}, starting polling...`);
              pollTaskStatus(serverTask.id);
            }
          } else {
            throw new Error(response.error || 'Upload failed');
          }
        } catch (error) {
          console.error('URL upload error:', error);
          throw error;
        } finally {
          setUploading(false);
        }
      },

      pollTaskStatus: async (taskId) => {
        const { updateTask, loadResult } = get();
        const task = get().tasks.find(t => t.id === taskId);
        
        if (!task) {
          return;
        }
        
        // If task is already completed or failed, just load the result if needed
        if (task.status === 'completed') {
          // Ensure result is loaded for completed tasks
          if (!get().results.has(taskId)) {
            await loadResult(taskId);
          }
          return;
        }
        
        if (task.status === 'failed') {
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
            
            // Continue polling if still processing or pending
            if (response.data.status === 'processing' || response.data.status === 'pending') {
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

        // 只有已登录用户才自动同步
        // 未登录用户不应该看到任何任务
        const authState = useAuthStore.getState();
        if (authState.isAuthenticated && authState.token) {
          // 页面加载时自动同步（延迟执行避免冲突）
          setTimeout(() => {
            get().syncWithServer().catch(error => {
              console.error('Initial sync failed:', error);
            });
          }, 50);
        }
      },

      syncWithServer: async () => {
        // Check if user is authenticated before syncing
        const authState = useAuthStore.getState();
        if (!authState.isAuthenticated) {
          // Clear tasks for unauthenticated users
          set({ 
            tasks: [],
            currentTaskId: null,
            results: new Map()
          });
          return;
        }
        
        try {
          // Always do full sync - fetch all tasks from server and replace local data
          const serverTasks = await syncManager.syncAll();
          
          // Directly replace local tasks with server tasks (no merging)
          // Server tasks already have user_id field from backend
          set({ tasks: serverTasks });
          
          // 处理任务状态变化
          const { results } = get();
          serverTasks.forEach(async (task) => {
            if (task.status === 'processing' || task.status === 'pending') {
              // 重新启动处理中或等待中任务的轮询
              get().pollTaskStatus(task.id);
            } else if (task.status === 'completed') {
              // 为已完成的任务加载OCR结果（如果还没有加载）
              if (!results.has(task.id)) {
                try {
                  await get().loadResult(task.id);
                } catch (error) {
                  // 如果是404错误，说明任务可能已被删除，静默处理
                  if (error instanceof Error && error.message.includes('Resource not found')) {
                    console.warn(`Task ${task.id} result not found, likely deleted`);
                  } else {
                    console.error(`Failed to load result for task ${task.id}:`, error);
                  }
                }
              }
            }
          });
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
        // DON'T persist tasks - they should always come from server
        // This avoids sync issues when refreshing the page
        return {
          // tasks removed - always fetch fresh from server
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
          // Ensure tasks array is initialized (since it's not persisted)
          if (!state.tasks) {
            state.tasks = [];
          }
          // Ensure results map is initialized
          if (!state.results) {
            state.results = new Map();
          }
          // Tasks will be synced from server automatically
        }
      },
    }
  )
);

// Utility hooks for specific parts of the store
export const useCurrentTask = () => useAppStore(state => state.currentTask);
export const useCurrentResult = () => useAppStore(state => state.currentResult);
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
  toggleTheme: state.toggleTheme,
  // taskListVisible 相关方法已迁移到 uiStore
  setActiveDocumentTab: state.setActiveDocumentTab
}));

export const useSyncActions = () => useAppStore(state => ({
  syncWithServer: state.syncWithServer,
  initializeSync: state.initializeSync
}));

export const useSyncStatus = () => useAppStore(state => state.syncStatus);