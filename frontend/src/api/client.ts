/**
 * API client for MonkeyOCR WebApp
 * Handles all communication with the FastAPI backend
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { 
  APIResponse, 
  UploadOptions,
  TaskStatusResponse,
  TaskResultResponse,
  TaskListResponse,
  UploadResponse,
  BlockDataResponse
} from '../types';

import { APP_CONFIG, getStaticFileUrl } from '../config';
import { useAuthStore } from '../store/authStore';

// API Configuration
const API_BASE_URL = APP_CONFIG.api.baseURL;
const API_TIMEOUT = APP_CONFIG.api.timeout;

// Create axios instance with default configuration
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth
axiosInstance.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error) => {
    // Handle 401 Unauthorized - logout user (no refresh token in simplified auth)
    if (error.response?.status === 401) {
      const state = useAuthStore.getState();
      
      // Only logout if we were authenticated
      if (state.isAuthenticated) {
        state.logout();
        // Don't redirect here to avoid circular dependency
        // The app should handle this via auth state
      }
    }
    
    // Handle other common HTTP errors
    if (error.response?.status === 404) {
      throw new Error('Resource not found');
    } else if (error.response?.status === 500) {
      throw new Error('Server error occurred');
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout');
    }
    
    return Promise.reject(error);
  }
);

// API Client class
class ApiClient {
  /**
   * Upload a file for OCR processing
   */
  async uploadFile(file: File, options: UploadOptions = {}): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    // Add options as form data
    // 默认设置为私有文件（登录用户的文件默认私有）
    formData.append('is_public', options.is_public ? 'true' : 'false');

    try {
      const response = await axiosInstance.post<UploadResponse>('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        // Upload progress tracking (silent)
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            // Progress tracking available but not logged
            // const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          }
        },
      });
      
      return response.data;
    } catch (error: any) {
      throw new Error(error instanceof Error ? error.message : 'File upload failed');
    }
  }

  /**
   * Upload multiple files for OCR processing
   */
  async uploadFiles(files: File[], options: UploadOptions = {}): Promise<UploadResponse[]> {
    const uploadPromises = files.map(file => this.uploadFile(file, options));
    
    try {
      return await Promise.all(uploadPromises);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Upload a PDF from URL for OCR processing
   */
  async uploadFromUrl(pdfUrl: string, options: UploadOptions = {}): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('pdf_url', pdfUrl);
    formData.append('is_public', options.is_public ? 'true' : 'false');

    try {
      const response = await axiosInstance.post<UploadResponse>('/api/upload-url', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      return response.data;
    } catch (error: any) {
      // Extract error message from response
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      throw new Error(error instanceof Error ? error.message : 'URL upload failed');
    }
  }

  /**
   * Get the status of a processing task
   */
  async getTaskStatus(taskId: string): Promise<TaskStatusResponse> {
    try {
      const response = await axiosInstance.get<TaskStatusResponse>(`/api/tasks/${taskId}/status`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get task status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the result of a completed processing task
   */
  async getTaskResult(taskId: string): Promise<TaskResultResponse> {
    try {
      const response = await axiosInstance.get<TaskResultResponse>(`/api/tasks/${taskId}/result`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get task result: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get list of all tasks
   */
  async getTaskList(): Promise<TaskListResponse> {
    try {
      const response = await axiosInstance.get<TaskListResponse>('/api/tasks');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get task list: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download the original result file for a task
   */
  async downloadTaskResult(taskId: string): Promise<Blob> {
    try {
      const response = await axiosInstance.get(`/api/download/${taskId}`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to download result: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a task and its associated data
   */
  async deleteTask(taskId: string): Promise<APIResponse<void>> {
    try {
      const response = await axiosInstance.delete<APIResponse<void>>(`/api/tasks/${taskId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to delete task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get server health status
   */
  async getHealthStatus(): Promise<{ status: string }> {
    try {
      const response = await axiosInstance.get('/health');
      return response.data;
    } catch (error) {
      throw new Error('Server health check failed');
    }
  }

  /**
   * Get block data for a completed task (PDF-Markdown sync feature)
   */
  async getTaskBlockData(taskId: string): Promise<BlockDataResponse> {
    try {
      const response = await axiosInstance.get<BlockDataResponse>(`/api/tasks/${taskId}/blocks`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get block data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get static file URL for images
   */
  getStaticFileUrl(filePath: string): string {
    return getStaticFileUrl(filePath);
  }

  /**
   * Retry mechanism for failed requests
   */
  async retryRequest<T>(
    requestFn: () => Promise<T>, 
    maxRetries: number = 3, 
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        // Retry silently
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
    
    throw lastError!;
  }
}

// Create and export singleton instance
export const apiClient = new ApiClient();

// Export individual methods for convenience
export const {
  uploadFile,
  uploadFiles,
  uploadFromUrl,
  getTaskStatus,
  getTaskResult,
  getTaskList,
  downloadTaskResult,
  deleteTask,
  getHealthStatus,
  getTaskBlockData,
  retryRequest
} = apiClient;

// Export the class for custom instances if needed
export { ApiClient };

// Default export
export default apiClient;