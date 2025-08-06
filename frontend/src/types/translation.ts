/**
 * Translation type definitions for MonkeyOCR WebApp
 */

// Translation request interfaces
export interface TranslationBlock {
  id: string;
  content: string;
  type: 'text' | 'heading' | 'table' | 'list' | 'code';
  order?: number;
}

export interface TranslationOptions {
  source_language: string;
  target_language: string;
  preserve_formatting: boolean;
  translation_style: 'accurate' | 'natural' | 'formal';
}

export interface TranslationRequest {
  blocks: TranslationBlock[];
  source_language: string;
  target_language: string;
  preserve_formatting?: boolean;
  translation_style?: string;
}

// Translation result interfaces
export interface BlockTranslationResult {
  block_id: string;
  original_content: string;
  translated_content: string;
  status: 'completed' | 'error' | 'pending';
  error_message?: string;
}

export interface TranslationStatus {
  translation_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partially_completed';
  progress: number; // 0.0 to 1.0
  total_blocks: number;
  completed_blocks: number;
  failed_blocks: number;
  estimated_time_remaining?: number;
  created_at: string;
  updated_at: string;
}

export interface TranslationResult {
  translation_id: string;
  status: string;
  source_language: string;
  target_language: string;
  total_blocks: number;
  results: BlockTranslationResult[];
  created_at: string;
  completed_at?: string;
}

// Translation UI state interfaces
export interface TranslationState {
  // Active translations by task ID
  activeTranslations: Map<string, TranslationJob>;
  
  // Translation cache by content hash
  translationCache: Map<string, CachedTranslation>;
  
  // UI preferences
  selectedSourceLanguage: string;
  selectedTargetLanguage: string;
  translationStyle: 'accurate' | 'natural' | 'formal';
  autoTranslate: boolean;
  showOriginalText: boolean;
  
  // Hover state
  hoveredBlockId: string | null;
  hoverMenuVisible: boolean;
  hoverMenuPosition: { x: number; y: number };
}

export interface TranslationJob {
  id: string;
  taskId: string; // Associated document task
  translationId: string; // Backend translation ID
  status: TranslationStatus['status'];
  progress: number;
  results: Map<string, BlockTranslationResult>;
  createdAt: Date;
}

export interface CachedTranslation {
  originalContent: string;
  translatedContent: string;
  sourceLanguage: string;
  targetLanguage: string;
  translationStyle: string;
  cachedAt: Date;
  expiresAt: Date;
}

// Translation actions
export interface TranslationActions {
  // Block-level translation
  translateBlock: (
    taskId: string,
    blockId: string,
    content: string,
    options: TranslationOptions
  ) => Promise<string>;
  
  explainBlock: (
    taskId: string,
    blockId: string,
    content: string,
    language?: string
  ) => Promise<string>;
  
  // Document-level translation
  translateDocument: (
    taskId: string,
    blocks: TranslationBlock[],
    options: TranslationOptions
  ) => Promise<string>; // Returns translation job ID
  
  // Job management
  pollTranslationStatus: (translationId: string) => Promise<TranslationStatus>;
  getTranslationResult: (translationId: string) => Promise<TranslationResult>;
  cancelTranslation: (translationId: string) => Promise<void>;
  
  // UI state management
  setLanguages: (source: string, target: string) => void;
  setTranslationStyle: (style: 'accurate' | 'natural' | 'formal') => void;
  setHoverState: (
    blockId: string | null,
    visible: boolean,
    position?: { x: number; y: number }
  ) => void;
  toggleAutoTranslate: () => void;
  toggleShowOriginal: () => void;
  
  // Cache management
  clearTranslationCache: () => void;
  getFromCache: (contentHash: string) => CachedTranslation | null;
  addToCache: (contentHash: string, translation: CachedTranslation) => void;
}

// Language definitions
export interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag?: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'auto', name: 'Auto Detect', nativeName: 'Auto' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
];

// Translation export interfaces
export interface TranslationExportOptions {
  format: 'markdown' | 'html' | 'bilingual' | 'json';
  includeOriginal: boolean;
  includeImages: boolean;
  preserveFormatting: boolean;
}

export interface TranslationExportResult {
  content: string;
  filename: string;
  mimeType: string;
  size: number;
}

// Translation component prop interfaces
export interface HoverToolsMenuProps {
  blockId: string;
  content: string;
  visible: boolean;
  position: { x: number; y: number };
  onTranslate: (blockId: string, content: string) => void;
  onExplain: (blockId: string, content: string) => void;
  onClose: () => void;
}

export interface TranslationResultProps {
  blockId: string;
  result: BlockTranslationResult;
  sourceLanguage: string;
  targetLanguage: string;
  showOriginal?: boolean;
  onCopy?: (content: string) => void;
  onEdit?: (blockId: string, newContent: string) => void;
}

export interface TranslationToolbarProps {
  taskId: string;
  onTranslateAll: () => void;
  onExport: () => void;
  onClearTranslations: () => void;
  isTranslating: boolean;
  progress: number;
  sourceLanguage: string;
  targetLanguage: string;
  onLanguageChange: (source: string, target: string) => void;
}

export interface LanguageSelectorProps {
  value: string;
  onChange: (value: string) => void;
  languages: Language[];
  placeholder?: string;
  disabled?: boolean;
  showFlags?: boolean;
}

// Utility types for translation processing
export type TranslationContentType = 'text' | 'markdown' | 'html';
export type TranslationStatusType = TranslationStatus['status'];
export type TranslationStyleType = TranslationOptions['translation_style'];

// Error types specific to translation
export interface TranslationError {
  code: 'TRANSLATION_FAILED' | 'INVALID_LANGUAGE' | 'QUOTA_EXCEEDED' | 'NETWORK_ERROR';
  message: string;
  blockId?: string;
  translationId?: string;
  details?: any;
}