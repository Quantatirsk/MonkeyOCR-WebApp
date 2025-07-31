/**
 * TypeScript type definitions for MonkeyOCR WebApp
 * Based on plan.json specifications
 */

// Core processing task interface
export interface ProcessingTask {
  id: string;
  filename: string;
  file_type: 'pdf' | 'image';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  result_url: string | null;
}

// Image resource interface
export interface ImageResource {
  filename: string;
  path: string;
  url: string;
  alt: string | null;
}

// Document metadata interface
export interface DocumentMetadata {
  total_pages: number;
  processing_time: number;
  file_size: number;
  extraction_type: 'standard' | 'split' | 'text' | 'formula' | 'table';
}

// Document result interface
export interface DocumentResult {
  task_id: string;
  markdown_content: string;
  images: ImageResource[];
  download_url: string;
  metadata: DocumentMetadata;
}

// Generic API response interface
export interface APIResponse<T = any> {
  success: boolean;
  data: T | null;
  message: string;
  error: string | null;
}

// Upload options interface
export interface UploadOptions {
  extract_type?: 'standard' | 'split' | 'text' | 'formula' | 'table';
  split_pages?: boolean;
}

// Zustand store state interface
export interface AppState {
  tasks: ProcessingTask[];
  currentTaskId: string | null;
  results: Map<string, DocumentResult>;
  isUploading: boolean;
  searchQuery: string;
  theme: 'light' | 'dark';
}

// Zustand store actions interface
export interface AppActions {
  // Task management
  addTask: (task: Omit<ProcessingTask, 'id'>) => void;
  updateTask: (id: string, updates: Partial<ProcessingTask>) => void;
  setCurrentTask: (taskId: string | null) => void;
  removeTask: (id: string) => void;
  
  // Result management
  addResult: (result: DocumentResult) => void;
  loadResult: (taskId: string) => Promise<void>;
  clearResults: () => void;
  
  // UI state
  setSearchQuery: (query: string) => void;
  setUploading: (isUploading: boolean) => void;
  toggleTheme: () => void;
  
  // File operations
  uploadFiles: (files: File[], options?: UploadOptions) => Promise<void>;
  pollTaskStatus: (taskId: string) => void;
}

// Combined store interface
export interface AppStore extends AppState, AppActions {
  // Computed properties
  currentTask: ProcessingTask | null;
  currentResult: DocumentResult | null;
  completedTasks: ProcessingTask[];
  isProcessing: boolean;
}

// Component prop interfaces
export interface UploadZoneProps {
  onFileUpload: (files: File[]) => void;
  isUploading: boolean;
  acceptedTypes: string[];
}

export interface TaskListProps {
  tasks: ProcessingTask[];
  onTaskSelect: (task: ProcessingTask) => void;
  currentTaskId: string | null;
}

export interface DocumentViewerProps {
  document: DocumentResult | null;
  searchQuery: string;
}

export interface ProcessingStatusProps {
  task: ProcessingTask;
  showDetails?: boolean;
}

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export interface ImageGalleryProps {
  images: ImageResource[];
  onImageClick?: (image: ImageResource) => void;
}

// File upload related types
export interface FileWithPreview extends File {
  preview?: string;
}

// Error types
export interface AppError {
  code: string;
  message: string;
  details?: any;
}

// Theme types
export type Theme = 'light' | 'dark' | 'system';

// Processing status types
export type ProcessingStatus = ProcessingTask['status'];
export type ExtractionType = DocumentMetadata['extraction_type'];
export type FileType = ProcessingTask['file_type'];

// API endpoint types
export interface TaskStatusResponse extends APIResponse<ProcessingTask> {}
export interface TaskResultResponse extends APIResponse<DocumentResult> {}
export interface TaskListResponse extends APIResponse<ProcessingTask[]> {}
export interface UploadResponse extends APIResponse<ProcessingTask> {}