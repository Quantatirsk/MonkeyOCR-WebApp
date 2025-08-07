/**
 * ActionToolbar Component
 * 显示选中区块的操作提示和快捷键信息
 */

import React from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { Languages, MessageSquare, X, Loader2 } from 'lucide-react';
import type { ActionToolbarProps } from './types';

const ActionToolbar: React.FC<ActionToolbarProps> = React.memo(({
  selectedBlock,
  actionState,
  streamingState,
  shortcuts,
  onTranslate,
  onExplain,
  onCancel
}) => {
  // 如果没有选中区块，不显示工具栏
  if (!selectedBlock) return null;

  // 获取区块类型的显示文本和样式
  const getBlockTypeInfo = (type: string) => {
    switch (type) {
      case 'title':
        return { label: '标题', variant: 'default' as const };
      case 'text':
        return { label: '文本', variant: 'secondary' as const };
      case 'table':
        return { label: '表格', variant: 'outline' as const };
      case 'image':
        return { label: '图片', variant: 'destructive' as const };
      default:
        return { label: '未知', variant: 'secondary' as const };
    }
  };

  const blockTypeInfo = getBlockTypeInfo(selectedBlock.type);
  const isProcessing = actionState.isProcessing || streamingState.isStreaming;

  // 获取操作状态的显示信息
  const getActionStatusInfo = () => {
    if (streamingState.isStreaming) {
      return {
        text: streamingState.streamType === 'translate' ? '正在翻译...' : '正在解释...',
        icon: <Loader2 className="w-3 h-3 animate-spin" />
      };
    }
    
    if (actionState.isProcessing) {
      return {
        text: actionState.actionMode === 'translate' ? '准备翻译...' : '准备解释...',
        icon: <Loader2 className="w-3 h-3 animate-spin" />
      };
    }
    
    return null;
  };

  const statusInfo = getActionStatusInfo();

  // 检查是否已有翻译
  const hasTranslation = actionState.translations.has(selectedBlock.index);
  
  // 检查是否已有解释（当前选中区块的解释）
  const hasExplanation = actionState.explanationBlockIndex === selectedBlock.index && 
                          actionState.explanationContent !== null;

  return (
    <Card className="bg-muted/10 border-muted/20">
      <CardContent className="py-2 px-3">
        <div className="flex items-center justify-between gap-2">
          {/* 左侧：区块信息和状态 */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* 区块类型标识 */}
            <Badge variant={blockTypeInfo.variant} className="text-xs flex-shrink-0">
              {blockTypeInfo.label}
            </Badge>
            
            {/* 区块索引 */}
            <span className="text-xs text-muted-foreground flex-shrink-0">
              #{selectedBlock.index}
            </span>
            
            {/* 区块内容预览 */}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-foreground truncate" title={selectedBlock.content}>
                {selectedBlock.content}
              </p>
            </div>

            {/* 状态指示 */}
            {hasTranslation && (
              <Badge variant="secondary" className="text-xs flex-shrink-0 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                已翻译
              </Badge>
            )}
            
            {hasExplanation && (
              <Badge variant="secondary" className="text-xs flex-shrink-0 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                已解释
              </Badge>
            )}
          </div>

          {/* 右侧：操作按钮和快捷键提示 */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* 处理状态显示 */}
            {statusInfo && (
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-muted/50">
                {statusInfo.icon}
                <span className="text-xs text-muted-foreground">
                  {statusInfo.text}
                </span>
              </div>
            )}

            {/* 流式内容长度指示 */}
            {streamingState.isStreaming && streamingState.streamContent && (
              <div className="text-xs text-muted-foreground px-1">
                {streamingState.streamContent.length} 字符
              </div>
            )}

            {/* 操作按钮 */}
            {!isProcessing && (
              <>
                {/* 翻译按钮 */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onTranslate}
                  disabled={hasTranslation}
                  className="h-6 px-2 text-xs"
                  title={`翻译 (${shortcuts.translate.toUpperCase()})`}
                >
                  <Languages className="w-3 h-3 mr-1" />
                  {shortcuts.translate.toUpperCase()}
                </Button>

                {/* 解释按钮 */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onExplain}
                  className="h-6 px-2 text-xs"
                  title={`解释 (${shortcuts.explain.toUpperCase()})`}
                >
                  <MessageSquare className="w-3 h-3 mr-1" />
                  {shortcuts.explain.toUpperCase()}
                </Button>
              </>
            )}

            {/* 取消按钮 - 只在处理中显示 */}
            {isProcessing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="h-6 px-2 text-xs"
                title={`取消 (${shortcuts.cancel})`}
              >
                <X className="w-3 h-3 mr-1" />
                取消
              </Button>
            )}
          </div>
        </div>

        {/* 流式内容预览 */}
        {streamingState.isStreaming && streamingState.streamContent && (
          <div className="mt-2 pt-2 border-t border-muted/20">
            <div className="text-xs text-muted-foreground mb-1">
              {streamingState.streamType === 'translate' ? '翻译预览:' : '解释预览:'}
            </div>
            <div className="bg-muted/30 rounded p-2 text-xs max-h-20 overflow-y-auto">
              {streamingState.streamContent || <Skeleton className="h-4 w-full" />}
            </div>
          </div>
        )}

        {/* 错误信息显示 */}
        {streamingState.error && (
          <div className="mt-2 pt-2 border-t border-muted/20">
            <div className="text-xs text-destructive bg-destructive/10 rounded p-2">
              错误: {streamingState.error}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export default ActionToolbar;