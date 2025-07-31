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
  UploadResponse
} from '../types';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';
const API_TIMEOUT = 30000; // 30 seconds

// Create axios instance with default configuration
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging and auth (if needed in future)
axiosInstance.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(`API Response: ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message);
    
    // Handle common HTTP errors
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
    if (options.extract_type) {
      formData.append('extract_type', options.extract_type);
    }
    if (options.split_pages !== undefined) {
      formData.append('split_pages', options.split_pages ? 'true' : 'false');
    }

    try {
      const response = await axiosInstance.post<UploadResponse>('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        // Upload progress tracking
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            console.log(`Upload progress: ${progress}%`);
          }
        },
      });
      
      return response.data;
    } catch (error: any) {
      console.error('File upload failed:', error);
      console.error('Response data:', error.response?.data);
      console.error('Response status:', error.response?.status);
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
      console.error('Multiple file upload failed:', error);
      throw error;
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
      console.error(`Failed to get task status for ${taskId}:`, error);
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
      console.error(`Failed to get task result for ${taskId}:`, error);
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
      console.error('Failed to get task list:', error);
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
      console.error(`Failed to download result for ${taskId}:`, error);
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
      console.error(`Failed to delete task ${taskId}:`, error);
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
      console.error('Health check failed:', error);
      throw new Error('Server health check failed');
    }
  }

  /**
   * Get static file URL for images
   */
  getStaticFileUrl(filePath: string): string {
    return `${API_BASE_URL}/static/${filePath}`;
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
        
        console.warn(`Request attempt ${attempt} failed, retrying in ${delay}ms...`);
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
  getTaskStatus,
  getTaskResult,
  getTaskList,
  downloadTaskResult,
  deleteTask,
  getHealthStatus,
  getStaticFileUrl,
  retryRequest
} = apiClient;

// Export the class for custom instances if needed
export { ApiClient };

// Default export
export default apiClient;