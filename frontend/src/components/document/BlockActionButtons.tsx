/**
 * BlockActionButtons Component
 * Handles block translation and explanation actions
 */

import React from 'react';
import { Languages, MessageSquare } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { toast } from 'sonner';
import type { BlockData } from '../../types';

interface BlockActionButtonsProps {
  blockIndex: number | null;
  blockData: BlockData[];
  onTranslate: (blockIndex: number) => void;
  onExplain: (blockIndex: number) => void;
  className?: string;
}

const getBlockTypeLabel = (type?: string): string => {
  const labels: Record<string, string> = {
    'text': '文本',
    'title': '标题',
    'table': '表格',
    'image': '图片',
    'interline_equation': '公式'
  };
  return labels[type || ''] || '未知';
};

export const BlockActionButtons: React.FC<BlockActionButtonsProps> = React.memo(({
  blockIndex,
  blockData,
  onTranslate,
  onExplain,
  className = ""
}) => {
  if (blockIndex === null) return null;

  const selectedBlock = blockData.find(block => block.index === blockIndex);
  const blockType = selectedBlock?.type || 'text';
  const blockTypeLabel = getBlockTypeLabel(blockType);

  const handleTranslate = () => {
    onTranslate(blockIndex);
    toast.info('正在翻译选中区块...', { duration: 1000 });
  };

  const handleExplain = () => {
    onExplain(blockIndex);
    toast.info('正在生成解释...', { duration: 1000 });
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className={`flex items-center space-x-1 flex-shrink-0 ${className}`}>
        <Badge variant="secondary" className="text-xs h-5">
          {blockTypeLabel}
        </Badge>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTranslate}
              className="h-7 w-7 p-0"
            >
              <Languages className="w-3 h-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            翻译 (快捷键: N)
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExplain}
              className="h-7 w-7 p-0"
            >
              <MessageSquare className="w-3 h-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            解释 (快捷键: M)
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
});