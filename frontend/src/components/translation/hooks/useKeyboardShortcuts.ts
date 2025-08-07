/**
 * useKeyboardShortcuts Hook
 * 处理翻译解释功能的快捷键监听
 */

import { useEffect, useCallback } from 'react';
import { BlockData } from '../../../types';
import type { KeyboardShortcuts, ActionMode } from '../types';

interface UseKeyboardShortcutsOptions {
  /** 当前选中的区块 */
  selectedBlock: BlockData | null;
  /** 是否启用快捷键 */
  enabled?: boolean;
  /** 是否正在处理操作 */
  isProcessing?: boolean;
  /** 快捷键配置 */
  shortcuts?: Partial<KeyboardShortcuts>;
  /** 翻译回调 */
  onTranslate?: () => void;
  /** 解释回调 */
  onExplain?: () => void;
  /** 取消回调 */
  onCancel?: () => void;
  /** 快捷键触发回调 */
  onShortcutTrigger?: (key: string, action: ActionMode | 'cancel') => void;
}

const DEFAULT_SHORTCUTS: KeyboardShortcuts = {
  translate: 'n',
  explain: 'm',
  cancel: 'Escape'
};

export const useKeyboardShortcuts = ({
  selectedBlock,
  enabled = true,
  isProcessing = false,
  shortcuts = DEFAULT_SHORTCUTS,
  onTranslate,
  onExplain,
  onCancel,
  onShortcutTrigger
}: UseKeyboardShortcutsOptions) => {
  
  // 合并快捷键配置
  const finalShortcuts = { ...DEFAULT_SHORTCUTS, ...shortcuts };

  // 处理键盘事件
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // 如果功能未启用，直接返回
    if (!enabled) return;

    // 检查是否在输入框中
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    // 处理取消操作 - 即使没有选中区块也可以取消
    if (event.key === finalShortcuts.cancel) {
      event.preventDefault();
      onShortcutTrigger?.(event.key, 'cancel');
      onCancel?.();
      return;
    }

    // 其他操作需要选中区块
    if (!selectedBlock) return;

    // 处理翻译快捷键
    if (event.key.toLowerCase() === finalShortcuts.translate.toLowerCase()) {
      event.preventDefault();
      
      if (isProcessing) {
        console.log('Already processing, ignoring translate shortcut');
        return;
      }

      onShortcutTrigger?.(event.key, 'translate');
      onTranslate?.();
      return;
    }

    // 处理解释快捷键
    if (event.key.toLowerCase() === finalShortcuts.explain.toLowerCase()) {
      event.preventDefault();
      
      if (isProcessing) {
        console.log('Already processing, ignoring explain shortcut');
        return;
      }

      onShortcutTrigger?.(event.key, 'explain');
      onExplain?.();
      return;
    }
  }, [
    enabled,
    selectedBlock,
    isProcessing,
    finalShortcuts,
    onTranslate,
    onExplain,
    onCancel,
    onShortcutTrigger
  ]);

  // 注册键盘事件监听
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  // 返回快捷键配置供组件使用
  return {
    shortcuts: finalShortcuts,
    isEnabled: enabled
  };
};