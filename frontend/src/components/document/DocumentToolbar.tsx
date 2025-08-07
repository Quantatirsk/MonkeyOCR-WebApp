/**
 * DocumentToolbar Component
 * Unified toolbar for document viewer
 */

import React from 'react';
import { Badge } from '../ui/badge';
import { DocumentSearch } from './DocumentSearch';
import { DocumentActions } from './DocumentActions';
import { BlockActionButtons } from './BlockActionButtons';
import type { BlockData } from '../../types';

interface DocumentToolbarProps {
  // Document info
  title?: string;
  fileType?: string;
  extractionType?: string;
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
  
  // Search
  searchQuery?: string;
  onSearch: (query: string) => void;
  searchPlaceholder?: string;
  
  className?: string;
}

export const DocumentToolbar: React.FC<DocumentToolbarProps> = React.memo(({
  title,
  fileType,
  extractionType,
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
  searchQuery = '',
  onSearch,
  searchPlaceholder = '搜索...',
  className = ''
}) => {
  return (
    <div className={`bg-muted/5 px-3 py-2 border-b flex-shrink-0 ${className}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {/* Left section */}
        <div className="flex items-center space-x-2 flex-shrink-0">
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
          {extractionType && (
            <Badge variant="secondary" className="text-xs">
              {extractionType}
            </Badge>
          )}
          {filename && (
            <Badge variant="outline" className="text-xs truncate max-w-32">
              {filename}
            </Badge>
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