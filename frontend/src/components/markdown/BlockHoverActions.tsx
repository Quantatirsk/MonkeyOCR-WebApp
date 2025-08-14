/**
 * BlockHoverActions Component
 * Shows action buttons when hovering over a block
 */

import React, { useCallback } from 'react';
import { Copy, Languages, MessageSquare, Bookmark } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BlockHoverActionsProps {
  blockIndex: number;
  blockContent: string;
  onCopy?: () => void;
  onTranslate?: () => void;
  onExplain?: () => void;
  onMark?: () => void;
  visible?: boolean;
  className?: string;
}

export const BlockHoverActions: React.FC<BlockHoverActionsProps> = React.memo(({
  blockIndex: _blockIndex,
  blockContent,
  onCopy,
  onTranslate,
  onExplain,
  onMark,
  visible = false,
  className = ""
}) => {
  // Handle copy action
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(blockContent);
      toast.success('已复制区块内容', { duration: 1000 });
      onCopy?.();
    } catch (error) {
      toast.error('复制失败');
    }
  }, [blockContent, onCopy]);

  // Handle translate action
  const handleTranslate = useCallback(() => {
    onTranslate?.();
  }, [onTranslate]);

  // Handle explain action
  const handleExplain = useCallback(() => {
    onExplain?.();
  }, [onExplain]);

  // Handle mark action
  const handleMark = useCallback(() => {
    onMark?.();
  }, [onMark]);

  if (!visible) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <div 
        className={cn(
          "block-hover-actions", // Add class for identification
          "absolute left-1/2 -translate-x-1/2 z-50",
          "top-full mt-0.5",
          "flex items-center gap-0",
          "bg-background backdrop-blur-sm",
          "border border-border rounded-md",
          "shadow-lg",
          "transition-all duration-150 ease-out",
          visible ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none",
          className
        )}
      >
        {/* Copy Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 px-2 rounded-l-lg rounded-r-none hover:bg-accent"
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="ml-1.5 text-xs hidden sm:inline">复制</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            复制区块内容
          </TooltipContent>
        </Tooltip>

        {/* Separator */}
        <div className="w-px h-5 bg-border" />

        {/* Translate Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTranslate}
              className="h-7 px-2 rounded-none hover:bg-accent"
              disabled={!onTranslate}
            >
              <Languages className="w-3.5 h-3.5" />
              <span className="ml-1.5 text-xs hidden sm:inline">翻译</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            翻译 (快捷键: N)
          </TooltipContent>
        </Tooltip>

        {/* Separator */}
        <div className="w-px h-5 bg-border" />

        {/* Explain Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExplain}
              className="h-7 px-2 rounded-none hover:bg-accent"
              disabled={!onExplain}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="ml-1.5 text-xs hidden sm:inline">解释</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            解释 (快捷键: M)
          </TooltipContent>
        </Tooltip>

        {/* Separator */}
        <div className="w-px h-5 bg-border" />

        {/* Mark Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMark}
              className="h-7 px-2 rounded-l-none rounded-r-lg hover:bg-accent"
              disabled={!onMark}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span className="ml-1.5 text-xs hidden sm:inline">标记</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            标记区块
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
});

BlockHoverActions.displayName = 'BlockHoverActions';