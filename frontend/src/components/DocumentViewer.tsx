/**
 * DocumentViewer Component
 * Displays OCR results with markdown rendering, image gallery, and search functionality
 */

import React, { useState, useMemo } from 'react';
import { ModernMarkdownViewer } from './markdown/ModernMarkdownViewer';
import './markdown/markdown-styles.css';
import { 
  Search, 
  Download, 
  Copy, 
  Eye, 
  FileText,
  Image,
  Maximize2,
  X,
  Type
} from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Separator } from './ui/separator';
import { useAppStore } from '../store/appStore';
import { ImageResource } from '../types';
import { apiClient } from '../api/client';
import { useToast } from '../hooks/use-toast';

// Get API base URL for constructing full image URLs
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';

interface DocumentViewerProps {
  className?: string;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ className = '' }) => {
  const { searchQuery, setSearchQuery, currentTaskId, results } = useAppStore();
  const { toast } = useToast();
  
  // Calculate current result directly
  const currentResult = currentTaskId ? results.get(currentTaskId) || null : null;
  
  // Debug logging
  React.useEffect(() => {
    console.log('📱 DocumentViewer render - currentTaskId:', currentTaskId);
    console.log('📱 DocumentViewer render - currentResult:', currentResult);
    console.log('📱 DocumentViewer render - results Map:', results);
    if (currentResult?.images) {
      console.log('🖼️ Images found:', currentResult.images.length);
      currentResult.images.forEach((img, i) => {
        console.log(`🖼️ Image ${i}:`, img.url);
      });
    }
  }, [currentTaskId, currentResult, results]);
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [selectedImage, setSelectedImage] = useState<ImageResource | null>(null);
  // 字号设置: 0=小(85%), 1=中(100%), 2=大(120%)
  const [fontSizeLevel, setFontSizeLevel] = useState(0);
  const fontSizes = [85, 100, 120];
  const fontLabels = ['小', '中', '大'];
  const markdownZoom = fontSizes[fontSizeLevel];
  const [activeTab, setActiveTab] = useState<'content' | 'images' | 'metadata'>('content');

  // Process markdown content with search highlighting
  const processedMarkdown = useMemo(() => {
    if (!currentResult?.markdown_content || !localSearchQuery.trim()) {
      return currentResult?.markdown_content || '';
    }

    const query = localSearchQuery.trim();
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    
    return currentResult.markdown_content.replace(regex, '**$1**');
  }, [currentResult?.markdown_content, localSearchQuery]);

  // Handle search input
  const handleSearchChange = (value: string) => {
    setLocalSearchQuery(value);
    setSearchQuery(value);
  };

  // Handle font size change
  const handleFontSizeChange = () => {
    setFontSizeLevel(prev => (prev + 1) % 3);
  };

  // Handle copy to clipboard
  const handleCopyMarkdown = async () => {
    if (currentResult?.markdown_content) {
      try {
        await navigator.clipboard.writeText(currentResult.markdown_content);
        toast({
          description: "已复制到剪贴板",
        });
      } catch (error) {
        console.error('Failed to copy markdown:', error);
        toast({
          variant: "destructive",
          description: "复制失败",
        });
      }
    }
  };

  // Handle download
  const handleDownload = async () => {
    if (!currentTaskId) return;
    
    try {
      toast({
        description: "开始下载...",
      });
      
      // Download the result file as blob
      const blob = await apiClient.downloadTaskResult(currentTaskId);
      
      // Create download URL and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentResult?.metadata?.filename || 'document'}_ocr_result.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        variant: "destructive",
        description: "下载失败",
      });
    }
  };

  // Handle image click
  const handleImageClick = (image: ImageResource) => {
    setSelectedImage(image);
  };

  // Format processing time
  const formatProcessingTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };


  if (!currentResult) {
    return (
      <div className={`${className} h-full flex items-center justify-center bg-background`}>
        <div className="flex flex-col items-center space-y-4 p-8">
          <FileText className="w-12 h-12 text-muted-foreground" />
          <div className="space-y-2 text-center">
            <h3 className="text-lg font-semibold">未选择文档</h3>
            <p className="text-muted-foreground">
              介任务列表中选择已完成的任务查看 OCR 结果
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Header with controls - 紧凑设计 */}
      <div className="border-b bg-muted/5">
        <div className="p-3">
          <div className="flex items-center gap-3">
            {/* Left: Title and badge */}
            <div className="flex items-center space-x-2 flex-shrink-0">
              <h2 className="text-sm font-semibold">文档查看器</h2>
              <Badge variant="outline" className="text-xs">
                {currentResult.metadata.extraction_type}
              </Badge>
            </div>
            
            {/* Center: Search bar - fills remaining space */}
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="在文档内容中搜索..."
                value={localSearchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8 h-8 text-xs w-full"
              />
            </div>
            
            {/* Right: Action buttons */}
            <div className="flex items-center space-x-1 flex-shrink-0">
              {activeTab === 'content' && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleFontSizeChange}
                  className="h-8 w-8 p-0"
                  title={`字号: ${fontLabels[fontSizeLevel]}`}
                >
                  <Type className="w-3.5 h-3.5" />
                </Button>
              )}
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCopyMarkdown}
                className="h-8 w-8 p-0"
                title="复制"
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDownload}
                className="h-8 w-8 p-0"
                title="下载"
              >
                <Download className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content - 占满剩余空间 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="h-full flex flex-col">
          <div className="border-b flex-shrink-0">
            <TabsList className="grid w-full grid-cols-3 h-10">
              <TabsTrigger value="content" className="flex items-center space-x-1 text-xs">
                <FileText className="w-3 h-3" />
                <span>内容</span>
              </TabsTrigger>
              <TabsTrigger value="images" className="flex items-center space-x-1 text-xs">
                <Image className="w-3 h-3" />
                <span>图片 ({currentResult.images.length})</span>
              </TabsTrigger>
              <TabsTrigger value="metadata" className="flex items-center space-x-1 text-xs">
                <Eye className="w-3 h-3" />
                <span>详情</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Content tab */}
          <TabsContent value="content" className="flex-1 p-0 m-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col data-[state=active]:h-full">
            <div className="flex-1 p-3 overflow-hidden h-full">
              <ScrollArea className="h-full w-full">
                <ModernMarkdownViewer 
                  content={processedMarkdown}
                  className="w-full"
                  fontSize={markdownZoom}
                />
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Images tab */}
          <TabsContent value="images" className="flex-1 p-0 m-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col data-[state=active]:h-full">
            <div className="flex-1 p-3 overflow-hidden h-full">
              <ScrollArea className="h-full w-full">
                {currentResult.images.length === 0 ? (
                  <div className="text-center py-8">
                    <Image className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">此文档中未找到图片</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {currentResult.images.map((image, index) => (
                      <div
                        key={index}
                        className="group relative aspect-square overflow-hidden rounded border bg-muted cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => handleImageClick(image)}
                      >
                        <img
                          src={image.url.startsWith('http') ? image.url : `${API_BASE_URL}${image.url}`}
                          alt={image.alt || image.filename}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            console.error('Image failed to load:', image.url);
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <Maximize2 className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-1">
                          <p className="text-xs truncate">{image.filename}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Metadata tab */}
          <TabsContent value="metadata" className="flex-1 p-0 m-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col data-[state=active]:h-full">
            <div className="flex-1 p-3 overflow-hidden h-full">
              <ScrollArea className="h-full w-full">
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">处理信息</h4>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">提取类型：</span>
                          <Badge variant="outline" className="text-xs">{currentResult.metadata.extraction_type}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">处理时间：</span>
                          <span>{formatProcessingTime(currentResult.metadata.processing_time)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">总页数：</span>
                          <span>{currentResult.metadata.total_pages}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">文件大小：</span>
                          <span>{formatFileSize(currentResult.metadata.file_size)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">内容统计</h4>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">字符数：</span>
                          <span>{currentResult.markdown_content.length.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">单词数：</span>
                          <span>{currentResult.markdown_content.split(/\s+/).length.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">行数：</span>
                          <span>{currentResult.markdown_content.split('\n').length.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">图片数：</span>
                          <span>{currentResult.images.length}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">下载选项</h4>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={handleDownload}>
                        <Download className="w-3 h-3 mr-1" />
                        <span className="text-xs">原始 ZIP</span>
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleCopyMarkdown}>
                        <Copy className="w-3 h-3 mr-1" />
                        <span className="text-xs">复制 Markdown</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
          </Tabs>
        </div>

      {/* Image preview dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedImage?.filename}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedImage(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          {selectedImage && (
            <div className="flex items-center justify-center">
              <img
                src={selectedImage.url.startsWith('http') ? selectedImage.url : `${API_BASE_URL}${selectedImage.url}`}
                alt={selectedImage.alt || selectedImage.filename}
                className="max-w-full max-h-[60vh] object-contain rounded-lg"
                onError={() => {
                  console.error('Modal image failed to load:', selectedImage.url);
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentViewer;