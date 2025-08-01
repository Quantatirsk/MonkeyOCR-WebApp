/**
 * Zustand state management store for MonkeyOCR WebApp
 * Implements all state and actions defined in types/index.ts
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  AppStore, 
  AppState, 
  ProcessingTask, 
  DocumentResult, 
  APIResponse 
} from '../types';
import { apiClient } from '../api/client';

// Initial state
const initialState: AppState = {
  tasks: [],
  currentTaskId: null,
  results: new Map(),
  isUploading: false,
  searchQuery: '',
  theme: 'light'
};

// Create the Zustand store
export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // State
      ...initialState,

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

      get processingTasks() {
        const { tasks } = get();
        return tasks.filter(task => task.status === 'processing');
      },

      get failedTasks() {
        const { tasks } = get();
        return tasks.filter(task => task.status === 'failed');
      },

      get pendingTasks() {
        const { tasks } = get();
        return tasks.filter(task => task.status === 'pending');
      },

      get batchProgress() {
        const { tasks } = get();
        const totalTasks = tasks.length;
        if (totalTasks === 0) return { completed: 0, total: 0, percentage: 0 };
        
        const completedTasks = tasks.filter(task => task.status === 'completed').length;
        return {
          completed: completedTasks,
          total: totalTasks,
          percentage: Math.round((completedTasks / totalTasks) * 100)
        };
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
            task.id === id ? { ...task, ...updates } : task
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

      // Batch task management
      clearAllTasks: () => {
        set({ 
          tasks: [], 
          currentTaskId: null,
          results: new Map()
        });
      },

      clearCompletedTasks: () => {
        const { tasks, results, currentTaskId } = get();
        const completedTaskIds = tasks
          .filter(task => task.status === 'completed')
          .map(task => task.id);
        
        // Remove completed tasks
        const remainingTasks = tasks.filter(task => task.status !== 'completed');
        
        // Clear current task if it was completed
        const newCurrentTaskId = completedTaskIds.includes(currentTaskId || '') 
          ? null 
          : currentTaskId;
        
        // Remove results for completed tasks
        const newResults = new Map(results);
        completedTaskIds.forEach(id => newResults.delete(id));
        
        set({
          tasks: remainingTasks,
          currentTaskId: newCurrentTaskId,
          results: newResults
        });
      },

      clearFailedTasks: () => {
        const { tasks, currentTaskId } = get();
        const failedTaskIds = tasks
          .filter(task => task.status === 'failed')
          .map(task => task.id);
        
        // Remove failed tasks
        const remainingTasks = tasks.filter(task => task.status !== 'failed');
        
        // Clear current task if it was failed
        const newCurrentTaskId = failedTaskIds.includes(currentTaskId || '') 
          ? null 
          : currentTaskId;
        
        set({
          tasks: remainingTasks,
          currentTaskId: newCurrentTaskId
        });
      },

      retryFailedTasks: async () => {
        const { failedTasks, uploadFiles } = get();
        
        if (failedTasks.length === 0) return;
        
        // Remove failed tasks first
        get().clearFailedTasks();
        
        // Create file objects from failed tasks (simplified)
        const filesToRetry = failedTasks.map(task => {
          const blob = new Blob([''], { 
            type: task.file_type === 'pdf' ? 'application/pdf' : 'image/jpeg' 
          });
          return new File([blob], task.filename, { type: blob.type });
        });
        
        // Re-upload files
        await uploadFiles(filesToRetry);
      },

      retryTask: async (taskId: string) => {
        const { tasks, removeTask, uploadFiles } = get();
        const task = tasks.find(t => t.id === taskId);
        
        if (!task) return;
        
        // Remove the failed task
        removeTask(taskId);
        
        // Create a new file object for retry (simplified)
        const blob = new Blob([''], { 
          type: task.file_type === 'pdf' ? 'application/pdf' : 'image/jpeg' 
        });
        const file = new File([blob], task.filename, { type: blob.type });
        
        // Re-upload the file
        await uploadFiles([file]);
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
                // Add the task returned from server
                const serverTask = response.data;
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

      pollTaskStatus: async (taskId, attempt = 0) => {
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
              return; // Stop polling
            }
            
            // If failed, stop polling
            if (response.data.status === 'failed') {
              return;
            }
            
            // Continue polling if still processing with adaptive interval
            if (response.data.status === 'processing') {
              // Adaptive polling: start fast, then slow down
              const baseInterval = 1000; // 1 second
              const maxInterval = 10000; // 10 seconds
              const interval = Math.min(baseInterval * Math.pow(1.5, Math.min(attempt, 10)), maxInterval);
              
              setTimeout(() => get().pollTaskStatus(taskId, attempt + 1), interval);
            }
          } else {
            // Handle API error response
            console.warn('API error response:', response.error);
            
            // Retry with exponential backoff up to 5 times
            if (attempt < 5) {
              const retryDelay = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s, 8s, 16s
              setTimeout(() => get().pollTaskStatus(taskId, attempt + 1), retryDelay);
            } else {
              // Max retries reached, mark as failed
              updateTask(taskId, {
                status: 'failed',
                error_message: response.error || 'Maximum polling retries reached'
              });
            }
          }
        } catch (error) {
          console.error('Failed to poll task status:', error);
          
          // Retry with exponential backoff up to 5 times
          if (attempt < 5) {
            const retryDelay = 1000 * Math.pow(2, attempt);
            setTimeout(() => get().pollTaskStatus(taskId, attempt + 1), retryDelay);
          } else {
            // Max retries reached, mark as failed
            updateTask(taskId, {
              status: 'failed',
              error_message: error instanceof Error ? error.message : 'Status check failed after multiple retries'
            });
          }
        }
      },

      // Batch polling for all processing tasks
      pollAllProcessingTasks: () => {
        const { processingTasks, pollTaskStatus } = get();
        processingTasks.forEach(task => {
          pollTaskStatus(task.id);
        });
      },

      // Start global polling manager
      startPollingManager: () => {
        const { isProcessing, pollAllProcessingTasks } = get();
        
        // Only start if there are processing tasks and not already polling
        if (isProcessing) {
          pollAllProcessingTasks();
          
          // Set up periodic check for new processing tasks
          const intervalId = setInterval(() => {
            const currentState = get();
            if (currentState.isProcessing) {
              currentState.pollAllProcessingTasks();
            } else {
              clearInterval(intervalId);
            }
          }, 30000); // Check every 30 seconds for stalled tasks
          
          // Store interval ID for cleanup if needed
          (get() as any)._pollingIntervalId = intervalId;
        }
      },

      // Stop polling manager
      stopPollingManager: () => {
        const intervalId = (get() as any)._pollingIntervalId;
        if (intervalId) {
          clearInterval(intervalId);
          delete (get() as any)._pollingIntervalId;
        }
      }
    }),
    {
      name: 'monkeyocr-app-store',
      // Only persist certain parts of the state
      partialize: (state) => ({
        tasks: state.tasks,
        currentTaskId: state.currentTaskId,
        theme: state.theme,
        searchQuery: state.searchQuery
      }),
      // Don't persist results and upload state - these should be fresh on reload
      version: 1,
    }
  )
);

// Utility hooks for specific parts of the store
export const useCurrentTask = () => useAppStore(state => state.currentTask);
export const useCurrentResult = () => useAppStore(state => state.currentResult);
export const useCompletedTasks = () => useAppStore(state => state.completedTasks);
export const useIsProcessing = () => useAppStore(state => state.isProcessing);
export const useProcessingTasks = () => useAppStore(state => state.processingTasks);
export const useFailedTasks = () => useAppStore(state => state.failedTasks);
export const usePendingTasks = () => useAppStore(state => state.pendingTasks);
export const useBatchProgress = () => useAppStore(state => state.batchProgress);

// Action hooks
export const useTaskActions = () => useAppStore(state => ({
  addTask: state.addTask,
  updateTask: state.updateTask,
  setCurrentTask: state.setCurrentTask,
  removeTask: state.removeTask,
  uploadFiles: state.uploadFiles,
  pollTaskStatus: state.pollTaskStatus,
  // Batch actions
  clearAllTasks: state.clearAllTasks,
  clearCompletedTasks: state.clearCompletedTasks,
  clearFailedTasks: state.clearFailedTasks,
  retryFailedTasks: state.retryFailedTasks,
  retryTask: state.retryTask,
  // Polling management
  pollAllProcessingTasks: state.pollAllProcessingTasks,
  startPollingManager: state.startPollingManager,
  stopPollingManager: state.stopPollingManager
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