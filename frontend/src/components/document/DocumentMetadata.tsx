/**
 * DocumentMetadata Component
 * Displays document metadata and statistics
 */

import React from 'react';
import { Download, Copy } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { formatProcessingTime, formatFileSize } from './utils';

interface DocumentMetadataProps {
  metadata: {
    extraction_type: string;
    processing_time: number;
    total_pages: number;
    file_size: number;
  };
  content: string;
  imageCount: number;
  onDownload: () => void;
  onCopy: () => void;
  className?: string;
}

export const DocumentMetadata: React.FC<DocumentMetadataProps> = React.memo(({
  metadata,
  content,
  imageCount,
  onDownload,
  onCopy,
  className = ""
}) => {
  const characterCount = content.length;
  const wordCount = content.split(/\s+/).length;
  const lineCount = content.split('\n').length;

  return (
    <ScrollArea className={`h-full w-full ${className}`}>
      <div className="space-y-3 p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Processing Information */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">处理信息</h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">提取类型：</span>
                <Badge variant="outline" className="text-xs">
                  {metadata.extraction_type}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">处理时间：</span>
                <span>{formatProcessingTime(metadata.processing_time)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">总页数：</span>
                <span>{metadata.total_pages}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">文件大小：</span>
                <span>{formatFileSize(metadata.file_size)}</span>
              </div>
            </div>
          </div>

          {/* Content Statistics */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">内容统计</h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">字符数：</span>
                <span>{characterCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">单词数：</span>
                <span>{wordCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">行数：</span>
                <span>{lineCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">图片数：</span>
                <span>{imageCount}</span>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Download Options */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">下载选项</h4>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onDownload}>
              <Download className="w-3 h-3 mr-1" />
              <span className="text-xs">原始 ZIP</span>
            </Button>
            <Button variant="outline" size="sm" onClick={onCopy}>
              <Copy className="w-3 h-3 mr-1" />
              <span className="text-xs">复制 Markdown</span>
            </Button>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
});