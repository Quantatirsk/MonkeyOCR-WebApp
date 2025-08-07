/**
 * 翻译解释功能模块导出
 */

// 主要组件
export { default as BlockActionManager } from './BlockActionManager';
export { default as ActionToolbar } from './ActionToolbar';
export { default as ContentEnhancementOverlay } from './ContentEnhancementOverlay';
export { CompactMarkdownViewer } from './CompactMarkdownViewer';

// Hooks
export { useBlockActions } from './hooks/useBlockActions';
export { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

// 提示词系统
export { buildTranslateMessages, buildExplainMessages } from './prompts';

// 语言检测系统
export { 
  detectLanguageAndTarget, 
  isTextSuitableForDetection, 
  getLanguageDisplayName,
  LANGUAGE_CODES,
  LANGUAGE_NAMES 
} from './languageDetection';
export type { SupportedLanguage, DetectionResult } from './languageDetection';

// 类型定义
export type {
  ActionMode,
  StreamType,
  BlockActionState,
  StreamingState,
  KeyboardShortcuts,
  BlockActionOptions,
  UseBlockActionsReturn,
  ActionToolbarProps,
  ExplanationPanelProps,
  ContentEnhancementOverlayProps,
  TranslationApiOptions,
  ExplanationApiOptions
} from './types';