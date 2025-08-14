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
  original_file?: File; // Store original file for preview
  original_file_url?: string; // Store original file URL for preview
  from_cache?: boolean; // Whether the result was loaded from cache
  user_id?: number; // User ID for task ownership (unified field)
  isPublic?: boolean; // Whether task is publicly visible
  sharedWith?: number[]; // User IDs task is shared with
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
  is_public?: boolean;  // 是否公开文件（默认为私有）
}

// Sync status interface
export interface SyncStatus {
  last_sync: string | null;
  is_syncing: boolean;
  sync_error: string | null;
  server_data_hash: string | null;
}

// Zustand store state interface
export interface AppState {
  tasks: ProcessingTask[];
  currentTaskId: string | null;
  results: Map<string, DocumentResult>;
  isUploading: boolean;
  searchQuery: string;
  theme: 'light' | 'dark';
  // taskListVisible 已迁移到 uiStore
  activeDocumentTab: 'compare' | 'translation' | 'images' | 'metadata';
  
  // Sync state (not persisted)
  syncStatus: SyncStatus | null;
  isInitialized: boolean;
}

// Zustand store actions interface
export interface AppActions {
  // Task management
  addTask: (task: Omit<ProcessingTask, 'id'>) => void;
  updateTask: (id: string, updates: Partial<ProcessingTask>) => void;
  setCurrentTask: (taskId: string | null) => void;
  removeTask: (id: string) => void;
  clearTasks: () => void;
  clearUserData: () => void; // Clear current user's data on logout
  
  // Result management
  addResult: (result: DocumentResult) => void;
  loadResult: (taskId: string) => Promise<void>;
  clearResults: () => void;
  
  // UI state
  setSearchQuery: (query: string) => void;
  setUploading: (isUploading: boolean) => void;
  toggleTheme: () => void;
  // toggleTaskListVisible 已迁移到 uiStore
  setActiveDocumentTab: (tab: 'compare' | 'translation' | 'images' | 'metadata') => void;
  
  // File operations
  uploadFiles: (files: File[], options?: UploadOptions) => Promise<void>;
  uploadFromUrl: (url: string, options?: UploadOptions) => Promise<void>;
  pollTaskStatus: (taskId: string) => void;
  
  // Sync operations
  syncWithServer: () => Promise<void>;
  initializeSync: () => void;
}

// Combined store interface
export interface AppStore extends AppState, AppActions {
  // Computed properties
  currentTask: ProcessingTask | null;
  currentResult: DocumentResult | null;
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
export type FileType = ProcessingTask['file_type'];

// Block data interfaces for PDF-Markdown sync feature
export interface BlockData {
  index: number;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  type: 'text' | 'title' | 'image' | 'table' | 'interline_equation';
  content: string;
  page_num: number;
  page_size: [number, number]; // [width, height]
  
  // Enhanced fields for images and tables
  image_path?: string;
  caption?: string;
  html_content?: string; // For tables - HTML table structure
}

export interface BlockProcessingData {
  preproc_blocks: BlockData[];
  total_pages: number;
  document_metadata?: {
    title?: string;
    creation_date?: string;
    processing_timestamp?: string;
  };
}

export interface EnhancedDocumentResult extends DocumentResult {
  block_data?: BlockProcessingData;
}

// Block interaction interfaces
export interface BlockSelection {
  blockIndex: number | null;
  pageNumber: number | null;
  isActive: boolean;
}

export interface BlockSyncState {
  selectedBlock: BlockSelection;
  highlightedBlocks: number[];
  syncEnabled: boolean;
  scrollSyncEnabled: boolean;
}

// API endpoint types
export interface TaskStatusResponse extends APIResponse<ProcessingTask> {}
export interface TaskResultResponse extends APIResponse<DocumentResult> {}
export interface TaskListResponse extends APIResponse<ProcessingTask[]> {}
export interface UploadResponse extends APIResponse<ProcessingTask> {}
export interface BlockDataResponse extends APIResponse<BlockProcessingData> {}