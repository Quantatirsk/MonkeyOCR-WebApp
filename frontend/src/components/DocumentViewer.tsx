/**
 * DocumentViewer Component
 * Displays OCR results with markdown rendering, image gallery, and search functionality
 */

import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Search, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  Copy, 
  Eye, 
  EyeOff,
  FileText,
  Images,
  Maximize2,
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Separator } from './ui/separator';
import { Alert, AlertDescription } from './ui/alert';
import { useAppStore } from '../store/appStore';
import { DocumentResult, ImageResource } from '../types';

interface DocumentViewerProps {
  className?: string;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ className = '' }) => {
  const { currentResult, searchQuery, setSearchQuery } = useAppStore();
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [selectedImage, setSelectedImage] = useState<ImageResource | null>(null);
  const [markdownZoom, setMarkdownZoom] = useState(100);
  const [showImagePreview, setShowImagePreview] = useState(true);
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

  // Handle markdown zoom
  const handleZoomIn = () => setMarkdownZoom(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setMarkdownZoom(prev => Math.max(prev - 25, 50));
  const resetZoom = () => setMarkdownZoom(100);

  // Handle copy to clipboard
  const handleCopyMarkdown = async () => {
    if (currentResult?.markdown_content) {
      try {
        await navigator.clipboard.writeText(currentResult.markdown_content);
        // You could add a toast notification here
        console.log('Markdown copied to clipboard');
      } catch (error) {
        console.error('Failed to copy markdown:', error);
      }
    }
  };

  // Handle download
  const handleDownload = () => {
    if (currentResult?.download_url) {
      window.open(currentResult.download_url, '_blank');
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

  // Custom markdown components
  const markdownComponents = {
    img: ({ src, alt, ...props }: any) => {
      // Find the corresponding image resource
      const imageResource = currentResult?.images.find(img => 
        src?.includes(img.filename) || src?.includes(img.path)
      );
      
      return (
        <div className="my-4">
          <img
            {...props}
            src={src}
            alt={alt}
            className="max-w-full h-auto rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => imageResource && handleImageClick(imageResource)}
            loading="lazy"
          />
          {alt && (
            <p className="text-sm text-muted-foreground mt-1 italic">{alt}</p>
          )}
        </div>
      );
    },
    table: ({ children, ...props }: any) => (
      <div className="overflow-x-auto my-4">
        <table {...props} className="min-w-full border-collapse border border-border">
          {children}
        </table>
      </div>
    ),
    th: ({ children, ...props }: any) => (
      <th {...props} className="border border-border px-3 py-2 bg-muted font-semibold text-left">
        {children}
      </th>
    ),
    td: ({ children, ...props }: any) => (
      <td {...props} className="border border-border px-3 py-2">
        {children}
      </td>
    ),
    code: ({ inline, children, ...props }: any) => (
      inline ? (
        <code {...props} className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
          {children}
        </code>
      ) : (
        <pre className="bg-muted p-4 rounded-lg overflow-x-auto my-4">
          <code {...props} className="text-sm font-mono">
            {children}
          </code>
        </pre>
      )
    )
  };

  if (!currentResult) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center space-y-4">
            <FileText className="w-12 h-12 text-muted-foreground" />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">No document selected</h3>
              <p className="text-muted-foreground">
                Select a completed task from the task list to view the OCR results
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CardTitle className="text-lg">Document Viewer</CardTitle>
              <Badge variant="outline">
                {currentResult.metadata.extraction_type}
              </Badge>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handleCopyMarkdown}>
                <Copy className="w-4 h-4 mr-1" />
                Copy
              </Button>
              
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-1" />
                Download
              </Button>
            </div>
          </div>
          
          {/* Search bar */}
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search in document content..."
                value={localSearchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {activeTab === 'content' && (
              <div className="flex items-center space-x-1">
                <Button variant="outline" size="sm" onClick={handleZoomOut}>
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-sm font-mono w-12 text-center">{markdownZoom}%</span>
                <Button variant="outline" size="sm" onClick={handleZoomIn}>
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={resetZoom}>
                  Reset
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Main content */}
      <Card>
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
            <div className="border-b">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="content" className="flex items-center space-x-2">
                  <FileText className="w-4 h-4" />
                  <span>Content</span>
                </TabsTrigger>
                <TabsTrigger value="images" className="flex items-center space-x-2">
                  <Images className="w-4 h-4" />
                  <span>Images ({currentResult.images.length})</span>
                </TabsTrigger>
                <TabsTrigger value="metadata" className="flex items-center space-x-2">
                  <Eye className="w-4 h-4" />
                  <span>Details</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Content tab */}
            <TabsContent value="content" className="p-6">
              <ScrollArea className="h-[600px]">
                <div 
                  className="prose prose-slate max-w-none dark:prose-invert"
                  style={{ fontSize: `${markdownZoom}%` }}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {processedMarkdown}
                  </ReactMarkdown>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Images tab */}
            <TabsContent value="images" className="p-6">
              {currentResult.images.length === 0 ? (
                <div className="text-center py-8">
                  <Images className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No images found in this document</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {currentResult.images.map((image, index) => (
                    <div
                      key={index}
                      className="group relative aspect-square overflow-hidden rounded-lg border bg-muted cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => handleImageClick(image)}
                    >
                      <img
                        src={image.url}
                        alt={image.alt || image.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white p-2">
                        <p className="text-xs truncate">{image.filename}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Metadata tab */}
            <TabsContent value="metadata" className="p-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-semibold">Processing Information</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Extraction Type:</span>
                        <Badge variant="outline">{currentResult.metadata.extraction_type}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Processing Time:</span>
                        <span>{formatProcessingTime(currentResult.metadata.processing_time)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Pages:</span>
                        <span>{currentResult.metadata.total_pages}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">File Size:</span>
                        <span>{formatFileSize(currentResult.metadata.file_size)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-semibold">Content Statistics</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Characters:</span>
                        <span>{currentResult.markdown_content.length.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Words:</span>
                        <span>{currentResult.markdown_content.split(/\s+/).length.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Lines:</span>
                        <span>{currentResult.markdown_content.split('\n').length.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Images:</span>
                        <span>{currentResult.images.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <h4 className="font-semibold">Download Options</h4>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={handleDownload}>
                      <Download className="w-4 h-4 mr-1" />
                      Original ZIP
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleCopyMarkdown}>
                      <Copy className="w-4 h-4 mr-1" />
                      Copy Markdown
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

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
                src={selectedImage.url}
                alt={selectedImage.alt || selectedImage.filename}
                className="max-w-full max-h-[60vh] object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentViewer;