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
  UploadOptions,
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
        const { addTask, updateTask, setUploading, pollTaskStatus } = get();
        
        setUploading(true);
        
        try {
          for (const file of files) {
            // Create initial task
            const taskData = {
              filename: file.name,
              file_type: file.type.startsWith('image/') ? 'image' as const : 'pdf' as const,
              status: 'pending' as const,
              progress: 0,
              created_at: new Date().toISOString(),
              completed_at: null,
              error_message: null,
              result_url: null
            };
            
            addTask(taskData);
            const task = get().tasks[get().tasks.length - 1]; // Get the just-added task
            
            try {
              // Upload file via API
              const response: APIResponse<ProcessingTask> = await apiClient.uploadFile(file, options);
              
              if (response.success && response.data) {
                // Update task with server response
                updateTask(task.id, {
                  ...response.data,
                  id: task.id // Keep our local ID
                });
                
                // Start polling for status updates
                pollTaskStatus(task.id);
              } else {
                updateTask(task.id, {
                  status: 'failed',
                  error_message: response.error || 'Upload failed'
                });
              }
            } catch (error) {
              updateTask(task.id, {
                status: 'failed',
                error_message: error instanceof Error ? error.message : 'Upload failed'
              });
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