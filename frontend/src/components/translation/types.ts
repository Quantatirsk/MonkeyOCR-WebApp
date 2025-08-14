/**
 * 翻译解释功能类型定义
 */

import { BlockData } from '../../types';

// 操作模式枚举
export type ActionMode = 'idle' | 'translate' | 'explain';

// 活动操作类型（不包括idle）
export type ActiveActionType = 'translate' | 'explain';

// 流式响应类型
export type StreamType = 'translate' | 'explain';

// 区块操作状态
export interface BlockActionState {
  /** 当前操作模式 */
  actionMode: ActionMode;
  /** 正在处理中的区块索引集合 */
  processingBlocks: Set<number>;
  /** 正在进行的操作类型映射 (区块索引 -> 操作类型) */
  activeOperations: Map<number, ActiveActionType>;
  /** 翻译内容映射 (blockIndex -> translated content) */
  translations: Map<number, string>;
  /** 解释内容映射 (blockIndex -> explanation content) */
  explanations: Map<number, string>;
  /** 解释内容（保留用于兼容性） */
  explanationContent: string | null;
  /** 解释对象的区块索引（保留用于兼容性） */
  explanationBlockIndex: number | null;
}

// 流式响应状态
export interface StreamingState {
  /** 是否正在流式传输 */
  isStreaming: boolean;
  /** 当前流式内容 */
  streamContent: string;
  /** 流式传输类型 */
  streamType: StreamType | null;
  /** 当前流式传输的区块索引 */
  streamingBlockIndex: number | null;
  /** 错误信息 */
  error: string | null;
}

// 快捷键配置
export interface KeyboardShortcuts {
  translate: string;
  explain: string;
  cancel: string;
}

// 区块操作选项
export interface BlockActionOptions {
  /** 区块数据 */
  blockData: BlockData[];
  /** 是否启用 */
  enabled?: boolean;
  /** 目标语言 */
  targetLanguage?: string;
  /** 快捷键配置 */
  shortcuts?: Partial<KeyboardShortcuts>;
  /** 操作回调 */
  onActionStart?: (blockIndex: number, action: ActiveActionType) => void;
  onActionComplete?: (blockIndex: number, action: ActiveActionType, result: string) => void;
  onActionError?: (blockIndex: number, action: ActiveActionType, error: string) => void;
}

// Hook返回类型
export interface UseBlockActionsReturn {
  // 状态
  actionState: BlockActionState;
  streamingState: StreamingState;
  
  // 操作方法
  translateBlock: (blockIndex: number, force?: boolean) => Promise<void>;
  explainBlock: (blockIndex: number, force?: boolean) => Promise<void>;
  translateAllBlocks: (onProgress?: (completed: number, total: number) => void, batchSize?: number) => Promise<void>;
  cancelAction: () => void;
  clearTranslation: (blockIndex: number) => void;
  clearExplanation: (blockIndex?: number) => void;
  clearAllTranslations: () => void;
  clearAllExplanations: () => void;
  
  // 获取内容方法
  getTranslation: (blockIndex: number) => string | null;
  getExplanation: (blockIndex: number) => string | null;
}

// 工具栏组件属性
export interface ActionToolbarProps {
  selectedBlock: BlockData | null;
  actionState: BlockActionState;
  streamingState: StreamingState;
  shortcuts: KeyboardShortcuts;
  onTranslate: () => void;
  onExplain: () => void;
  onCancel: () => void;
}

// 解释面板组件属性
export interface ExplanationPanelProps {
  isOpen: boolean;
  selectedBlock: BlockData | null;
  explanationContent: string | null;
  isStreaming: boolean;
  streamContent: string;
  onClose: () => void;
}

// 内容增强覆盖层组件属性
export interface ContentEnhancementOverlayProps {
  blockIndex: number;
  originalContent: string;
  translationContent: string | null;
  isStreaming: boolean;
  streamContent: string;
  overlayType?: 'translate' | 'explain';  // 区分是翻译还是解释
  onRefresh?: () => void;  // 刷新回调
}

// API请求选项
export interface TranslationApiOptions {
  text: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  stream?: boolean;
}

export interface ExplanationApiOptions {
  text: string;
  language?: string;
  stream?: boolean;
}