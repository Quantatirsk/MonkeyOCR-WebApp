/**
 * DocumentActions Component
 * Handles document action buttons (font size, copy, download, translate all)
 */

import React from 'react';
import { Type, Copy, Download, Languages } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { FONT_LABELS } from './constants';

interface DocumentActionsProps {
  fontSizeLevel: number;
  onFontSizeChange: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onTranslateAll?: () => void;
  showTranslateAll?: boolean;
  isTranslatingAll?: boolean;
  className?: string;
  buttonSize?: 'sm' | 'default';
}

export const DocumentActions: React.FC<DocumentActionsProps> = React.memo(({
  fontSizeLevel,
  onFontSizeChange,
  onCopy,
  onDownload,
  onTranslateAll,
  showTranslateAll = false,
  isTranslatingAll = false,
  className = "",
  buttonSize = 'sm'
}) => {
  const buttonClass = buttonSize === 'sm' ? "h-7 w-7 p-0" : "h-8 w-8 p-0";
  const iconClass = buttonSize === 'sm' ? "w-3 h-3" : "w-3.5 h-3.5";

  return (
    <TooltipProvider delayDuration={300}>
      <div className={`flex items-center space-x-1 ${className}`}>
        {showTranslateAll && onTranslateAll && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size={buttonSize}
                onClick={onTranslateAll}
                className={`${buttonClass} ${isTranslatingAll ? 'animate-pulse' : ''}`}
                disabled={isTranslatingAll}
              >
                <Languages className={iconClass} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {isTranslatingAll ? "正在翻译中..." : "全文翻译"}
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size={buttonSize}
              onClick={onFontSizeChange}
              className={buttonClass}
            >
              <Type className={iconClass} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            调整字号 (当前: {FONT_LABELS[fontSizeLevel]})
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size={buttonSize}
              onClick={onCopy}
              className={buttonClass}
            >
              <Copy className={iconClass} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            复制内容到剪贴板
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size={buttonSize}
              onClick={onDownload}
              className={buttonClass}
            >
              <Download className={iconClass} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            下载OCR结果
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
});