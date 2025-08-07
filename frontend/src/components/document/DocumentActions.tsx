/**
 * DocumentActions Component
 * Handles document action buttons (font size, copy, download)
 */

import React from 'react';
import { Type, Copy, Download } from 'lucide-react';
import { Button } from '../ui/button';
import { FONT_LABELS } from './constants';

interface DocumentActionsProps {
  fontSizeLevel: number;
  onFontSizeChange: () => void;
  onCopy: () => void;
  onDownload: () => void;
  className?: string;
  buttonSize?: 'sm' | 'default';
}

export const DocumentActions: React.FC<DocumentActionsProps> = React.memo(({
  fontSizeLevel,
  onFontSizeChange,
  onCopy,
  onDownload,
  className = "",
  buttonSize = 'sm'
}) => {
  const buttonClass = buttonSize === 'sm' ? "h-7 w-7 p-0" : "h-8 w-8 p-0";
  const iconClass = buttonSize === 'sm' ? "w-3 h-3" : "w-3.5 h-3.5";

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      <Button
        variant="outline"
        size={buttonSize}
        onClick={onFontSizeChange}
        className={buttonClass}
        title={`字号: ${FONT_LABELS[fontSizeLevel]}`}
      >
        <Type className={iconClass} />
      </Button>

      <Button
        variant="outline"
        size={buttonSize}
        onClick={onCopy}
        className={buttonClass}
        title="复制"
      >
        <Copy className={iconClass} />
      </Button>

      <Button
        variant="outline"
        size={buttonSize}
        onClick={onDownload}
        className={buttonClass}
        title="下载"
      >
        <Download className={iconClass} />
      </Button>
    </div>
  );
});