/**
 * DocumentToolbar Component
 * Unified toolbar for document viewer
 */

import React from 'react';
import { Badge } from '../ui/badge';
import { DocumentSearch } from './DocumentSearch';
import { DocumentActions } from './DocumentActions';
import { BlockActionButtons } from './BlockActionButtons';
import { TranslationProgress } from './TranslationProgress';
import type { BlockData } from '../../types';

interface DocumentToolbarProps {
  // Document info
  title?: string;
  fileType?: string;
  filename?: string;
  
  // Block actions
  showBlockActions?: boolean;
  selectedBlockIndex?: number | null;
  blockData?: BlockData[];
  onTranslateBlock?: (index: number) => void;
  onExplainBlock?: (index: number) => void;
  
  // Document actions
  fontSizeLevel: number;
  onFontSizeChange: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onTranslateAll?: () => void;
  showTranslateAll?: boolean;
  isTranslatingAll?: boolean;
  translationProgress?: { current: number; total: number };
  
  // Search
  searchQuery?: string;
  onSearch: (query: string) => void;
  searchPlaceholder?: string;
  
  className?: string;
}

export const DocumentToolbar: React.FC<DocumentToolbarProps> = React.memo(({
  title,
  fileType,
  filename,
  showBlockActions = false,
  selectedBlockIndex = null,
  blockData = [],
  onTranslateBlock,
  onExplainBlock,
  fontSizeLevel,
  onFontSizeChange,
  onCopy,
  onDownload,
  onTranslateAll,
  showTranslateAll = false,
  isTranslatingAll = false,
  translationProgress,
  searchQuery = '',
  onSearch,
  searchPlaceholder = '搜索...',
  className = ''
}) => {
  return (
    <div className={`bg-muted/5 px-3 py-2 border-b flex-shrink-0 ${className}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {/* Left section */}
        <div className="flex items-center space-x-2 flex-shrink-0 flex-1">
          {/* Block actions (if enabled) */}
          {showBlockActions && selectedBlockIndex !== null && onTranslateBlock && onExplainBlock && (
            <BlockActionButtons
              blockIndex={selectedBlockIndex}
              blockData={blockData}
              onTranslate={onTranslateBlock}
              onExplain={onExplainBlock}
            />
          )}
          
          {/* Document info badges */}
          {title && (
            <h3 className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              {title}
            </h3>
          )}
          {fileType && (
            <Badge variant="outline" className="text-xs">
              {fileType.toUpperCase()}
            </Badge>
          )}
          {filename && (
            <Badge variant="outline" className="text-xs truncate max-w-32">
              {filename}
            </Badge>
          )}
        </div>

        {/* Middle section - Translation Progress (always present for layout stability) */}
        <div className="flex-1 flex justify-center">
          {isTranslatingAll && translationProgress && (
            <TranslationProgress
              isActive={isTranslatingAll}
              current={translationProgress.current}
              total={translationProgress.total}
            />
          )}
        </div>

        {/* Right section */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 min-w-0">
          {/* Document actions */}
          <DocumentActions
            fontSizeLevel={fontSizeLevel}
            onFontSizeChange={onFontSizeChange}
            onCopy={onCopy}
            onDownload={onDownload}
            onTranslateAll={onTranslateAll}
            showTranslateAll={showTranslateAll}
            isTranslatingAll={isTranslatingAll}
          />

          {/* Search */}
          <DocumentSearch
            placeholder={searchPlaceholder}
            initialValue={searchQuery}
            onSearch={onSearch}
            className="flex-1 min-w-0 sm:max-w-44"
          />
        </div>
      </div>
    </div>
  );
});