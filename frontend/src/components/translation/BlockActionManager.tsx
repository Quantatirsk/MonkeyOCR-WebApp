/**
 * BlockActionManager Component
 * 管理区块翻译和解释功能的主组件
 * 整合快捷键监听、状态管理和UI组件
 */

import React, { useEffect, useCallback } from 'react';
import { BlockSelection } from '../../types';
import { useBlockActions } from './hooks/useBlockActions';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import ActionToolbar from './ActionToolbar';
import type { BlockActionOptions } from './types';

interface BlockActionManagerProps extends Omit<BlockActionOptions, 'onActionStart' | 'onActionComplete' | 'onActionError'> {
  /** 当前选中的区块 */
  selectedBlock: BlockSelection;
  /** 是否显示工具栏 */
  showToolbar?: boolean;
  /** 工具栏位置 */
  toolbarPosition?: 'top' | 'bottom';
  /** 操作开始回调 */
  onActionStart?: (blockIndex: number, action: 'translate' | 'explain') => void;
  /** 操作完成回调 */
  onActionComplete?: (blockIndex: number, action: 'translate' | 'explain', result: string) => void;
  /** 操作错误回调 */
  onActionError?: (blockIndex: number, action: 'translate' | 'explain', error: string) => void;
}

const BlockActionManager: React.FC<BlockActionManagerProps> = ({
  blockData,
  selectedBlock,
  enabled = true,
  targetLanguage = 'zh',
  shortcuts,
  showToolbar = true,
  toolbarPosition = 'top',
  onActionStart,
  onActionComplete,
  onActionError
}) => {
  // 获取当前选中的区块数据
  const currentBlock = selectedBlock.isActive && selectedBlock.blockIndex !== null
    ? blockData.find(block => block.index === selectedBlock.blockIndex) || null
    : null;

  // 使用区块操作hook
  const blockActions = useBlockActions({
    blockData,
    enabled,
    targetLanguage,
    shortcuts,
    onActionStart,
    onActionComplete,
    onActionError
  });

  // 同步选中状态
  useEffect(() => {
    if (selectedBlock.isActive && selectedBlock.blockIndex !== null) {
      // 更新内部选中状态
      blockActions.actionState.selectedBlockIndex = selectedBlock.blockIndex;
    }
  }, [selectedBlock.blockIndex, selectedBlock.isActive]);

  // 处理翻译操作
  const handleTranslate = useCallback(() => {
    if (currentBlock) {
      blockActions.translateBlock(currentBlock.index);
    }
  }, [currentBlock, blockActions]);

  // 处理解释操作
  const handleExplain = useCallback(() => {
    if (currentBlock) {
      blockActions.explainBlock(currentBlock.index);
    }
  }, [currentBlock, blockActions]);

  // 处理取消操作
  const handleCancel = useCallback(() => {
    blockActions.cancelAction();
  }, [blockActions]);

  // 使用快捷键监听
  const { shortcuts: finalShortcuts } = useKeyboardShortcuts({
    selectedBlock: currentBlock,
    enabled,
    isProcessing: blockActions.actionState.processingBlocks.size > 0 || blockActions.streamingState.isStreaming,
    shortcuts,
    onTranslate: handleTranslate,
    onExplain: handleExplain,
    onCancel: handleCancel,
    onShortcutTrigger: (key, action) => {
      console.log(`Shortcut triggered: ${key} -> ${action}`);
    }
  });


  return (
    <>
      {/* 操作工具栏 */}
      {showToolbar && currentBlock && (
        <div className={toolbarPosition === 'top' ? 'mb-2' : 'mt-2'}>
          <ActionToolbar
            selectedBlock={currentBlock}
            actionState={blockActions.actionState}
            streamingState={blockActions.streamingState}
            shortcuts={finalShortcuts}
            onTranslate={handleTranslate}
            onExplain={handleExplain}
            onCancel={handleCancel}
          />
        </div>
      )}

    </>
  );
};

export default BlockActionManager;