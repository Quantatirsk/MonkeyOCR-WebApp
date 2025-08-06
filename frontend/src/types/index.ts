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
  taskListVisible: boolean;
  activeDocumentTab: 'preview' | 'compare' | 'content' | 'images' | 'metadata';
  
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
  
  // Result management
  addResult: (result: DocumentResult) => void;
  loadResult: (taskId: string) => Promise<void>;
  clearResults: () => void;
  
  // UI state
  setSearchQuery: (query: string) => void;
  setUploading: (isUploading: boolean) => void;
  toggleTheme: () => void;
  toggleTaskListVisible: () => void;
  setActiveDocumentTab: (tab: 'preview' | 'compare' | 'content' | 'images' | 'metadata') => void;
  
  // File operations
  uploadFiles: (files: File[], options?: UploadOptions) => Promise<void>;
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

// Block data interfaces for PDF-Markdown sync functionality
export interface BlockSpan {
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  score: number;
  content: string;
  type: string;
}

export interface BlockLine {
  bbox: [number, number, number, number];
  spans: BlockSpan[];
  index: number;
}

export interface ProcessingBlock {
  type: 'text' | 'title' | 'image';
  bbox: [number, number, number, number];
  lines: BlockLine[];
  index: number;
  content?: string; // Extracted content for matching
  page_num?: number; // Page number for coordinate conversion
  page_size?: [number, number]; // Page dimensions [width, height]
}

export interface PageInfo {
  preproc_blocks: ProcessingBlock[];
  page_num: number;
  page_size?: [number, number];
}

export interface MiddleData {
  pdf_info: PageInfo[];
}

// Extended DocumentResult to include block data
export interface DocumentResult {
  task_id: string;
  markdown_content: string;
  images: ImageResource[];
  download_url: string;
  metadata: DocumentMetadata;
  middle_data?: MiddleData; // Block synchronization data
}

// Block synchronization state
export interface BlockSyncState {
  selectedBlockId: string | null;
  highlightedBlocks: Set<string>;
  scrollSyncEnabled: boolean;
  blockMappings: Map<string, string>; // JSON block index -> Markdown section mapping
}

// API endpoint types
export interface TaskStatusResponse extends APIResponse<ProcessingTask> {}
export interface TaskResultResponse extends APIResponse<DocumentResult> {}
export interface TaskListResponse extends APIResponse<ProcessingTask[]> {}
export interface UploadResponse extends APIResponse<ProcessingTask> {}