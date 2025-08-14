/**
 * UploadZone Component
 * File drag-and-drop upload area with validation and progress tracking
 */

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, AlertCircle, CheckCircle, Play, Trash2, Link, FileText } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { useAppStore } from '../store/appStore';
import { UploadOptions } from '../types';
import { toast } from 'sonner';

// File type validation
const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp']
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILES = 10;

interface UploadZoneProps {
  className?: string;
  disabled?: boolean;
}

interface FileUploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  errorMessage?: string;
  preview?: string;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ 
  className = '', 
  disabled = false 
}) => {
  // 使用精准选择器，避免不必要的重渲染
  const isUploading = useAppStore(state => state.isUploading);
  const uploadFiles = useAppStore(state => state.uploadFiles);
  const uploadFromUrl = useAppStore(state => state.uploadFromUrl);
  const [uploadQueue, setUploadQueue] = useState<FileUploadItem[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [isUrlMode, setIsUrlMode] = useState(false);
  const [isProcessingUrl, setIsProcessingUrl] = useState(false);
  // Upload options (only public/private setting now)
  const uploadOptions: UploadOptions = {};

  // Handle file drop and selection
  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles.map(rejected => ({
        file: rejected.file.name,
        errors: rejected.errors.map((e: any) => e.message).join(', ')
      }));
      console.warn('Rejected files:', errors);
    }

    // Process accepted files
    const newFiles: FileUploadItem[] = acceptedFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      file: file,
      progress: 0,
      status: 'pending' as const,
      preview: file.type?.startsWith('image/') ? URL.createObjectURL(file) : undefined
    }));

    setUploadQueue(prev => [...prev, ...newFiles]);
  }, []);

  // Configure dropzone
  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject,
    fileRejections
  } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    maxFiles: MAX_FILES - uploadQueue.length,
    disabled: disabled || isUploading,
    multiple: true
  });

  // Remove file from queue
  const removeFile = (fileId: string) => {
    setUploadQueue(prev => {
      const file = prev.find(f => f.id === fileId);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== fileId);
    });
  };

  // Clear all files
  const clearAll = () => {
    uploadQueue.forEach(file => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
    setUploadQueue([]);
  };

  // Start upload process
  const handleUpload = async () => {
    if (uploadQueue.length === 0) return;

    try {
      const filesToUpload = uploadQueue
        .filter(f => f.status === 'pending')
        .map(f => f.file);

      await uploadFiles(filesToUpload, uploadOptions);
      
      // Mark files as completed
      setUploadQueue(prev => 
        prev.map(f => ({ ...f, status: 'completed' as const, progress: 100 }))
      );
      
      toast.success(`${filesToUpload.length} 个文件上传完成`);
      
      // Clear queue after successful upload
      clearAll();
    } catch (error) {
      // Mark files as error
      setUploadQueue(prev => 
        prev.map(f => ({ 
          ...f, 
          status: 'error' as const, 
          errorMessage: error instanceof Error ? error.message : 'Upload failed' 
        }))
      );
      
      toast.error("上传失败");
    }
  };

  // Parse ArXiv URL/ID to get PDF URL
  const parseArxivUrl = (input: string): string | null => {
    // Remove whitespace
    const cleaned = input.trim();
    
    // ArXiv patterns:
    // 1. Full URL: https://arxiv.org/abs/2508.06471
    // 2. PDF URL: https://arxiv.org/pdf/2508.06471.pdf
    // 3. Just ID: 2508.06471
    // 4. ID with version: 2508.06471v1
    
    // Match ArXiv ID pattern (YYMM.NNNNN or old format like cs/0506001)
    const arxivIdPattern = /(?:arxiv\.org\/(?:abs|pdf)\/)?([0-9]{4}\.[0-9]{4,5}(?:v[0-9]+)?|[a-z-]+\/[0-9]{7})/i;
    const match = cleaned.match(arxivIdPattern);
    
    if (match) {
      const arxivId = match[1];
      // Convert to PDF URL
      return `https://arxiv.org/pdf/${arxivId}.pdf`;
    }
    
    // Check if it's already a direct PDF URL
    if (cleaned.match(/^https?:\/\/.*\.pdf$/i)) {
      return cleaned;
    }
    
    // Check if it's any URL that might be a PDF
    if (cleaned.match(/^https?:\/\//i)) {
      // Could be a PDF URL without .pdf extension
      return cleaned;
    }
    
    return null;
  };

  // Handle URL submission
  const handleUrlSubmit = async () => {
    if (!urlInput.trim() || isProcessingUrl || isUploading) return;
    
    const pdfUrl = parseArxivUrl(urlInput);
    if (!pdfUrl) {
      toast.error("无效的URL格式。请输入ArXiv链接、论文ID或PDF直链");
      return;
    }
    
    setIsProcessingUrl(true);
    
    try {
      // Call the uploadFromUrl function
      if (uploadFromUrl) {
        await uploadFromUrl(pdfUrl, uploadOptions);
        toast.success("已提交PDF处理任务");
        setUrlInput('');
        setIsUrlMode(false);
      } else {
        toast.error("URL上传功能暂不可用");
      }
    } catch (error) {
      console.error('Failed to process URL:', error);
      
      // Show error message
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("处理URL失败：未知错误");
      }
    } finally {
      setIsProcessingUrl(false);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get file type icon
  const getFileIcon = (type: string | undefined) => {
    if (!type) return '📎';
    if (type === 'application/pdf') return '📄';
    if (type.startsWith('image/')) return '🖼️';
    return '📎';
  };

  return (
    <div className={`w-full space-y-2 ${className}`}>
      {/* Toggle between file upload and URL input */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-2">
          <Button
            variant={!isUrlMode ? "default" : "outline"}
            size="sm"
            onClick={() => setIsUrlMode(false)}
            disabled={isUploading || isProcessingUrl}
            className="text-xs h-7"
          >
            <Upload className="w-3 h-3 mr-1" />
            本地文件
          </Button>
          <Button
            variant={isUrlMode ? "default" : "outline"}
            size="sm"
            onClick={() => setIsUrlMode(true)}
            disabled={isUploading || isProcessingUrl}
            className="text-xs h-7"
          >
            <Link className="w-3 h-3 mr-1" />
            ArXiv/URL
          </Button>
        </div>
      </div>

      {/* URL Input Mode */}
      {isUrlMode ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="输入ArXiv链接 (如: 2508.06471) 或PDF直链"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleUrlSubmit();
                }
              }}
              disabled={isProcessingUrl || isUploading}
              className="flex-1 text-sm"
            />
            <Button
              onClick={handleUrlSubmit}
              disabled={!urlInput.trim() || isProcessingUrl || isUploading}
              size="sm"
              className="px-4"
            >
              {isProcessingUrl ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2" />
                  处理中
                </>
              ) : (
                <>
                  <FileText className="w-3 h-3 mr-1" />
                  提交
                </>
              )}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>支持的格式：</p>
            <p>ArXiv论文ID: 2508.06471</p>
            <p>ArXiv链接: arxiv.org/abs/2508.06471</p>
            <p>PDF直链</p>
          </div>
        </div>
      ) : (
        /* Main Upload Area */
        <div
          {...getRootProps()}
          className={`
            relative cursor-pointer rounded border-2 border-dashed p-3 text-center transition-colors
            ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
            ${isDragReject ? 'border-destructive bg-destructive/5' : ''}
            ${disabled || isUploading ? 'pointer-events-none opacity-50' : 'hover:border-primary/50'}
          `}
        >
          <input {...getInputProps()} />
          
          <div className="flex flex-col items-center space-y-2">
            <div className="rounded-full bg-primary/10 p-2">
              <Upload className="h-4 w-4 text-primary" />
            </div>
            
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {isDragActive ? '拖放文件到此处' : '支持 PDF, JPG, PNG等格式 • 支持批量'}
              </p>
            </div>
          
            {!isDragActive && (
              <Button variant="outline" size="sm" disabled={disabled || isUploading}>
                <span className="text-xs">选择文件</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* File Rejections */}
      {fileRejections.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            部分文件被拒绝：
            <ul className="mt-1 list-disc list-inside text-xs">
              {fileRejections.map(({ file, errors }) => (
                <li key={file.name}>
                  {file.name}: {errors.map(e => e.message).join(', ')}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* File Queue */}
      {uploadQueue.length > 0 && (
        <Card>
          <CardContent className="p-3 space-y-3">
            {/* Header with actions */}
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">待处理文件 ({uploadQueue.length})</h4>
              <div className="flex items-center space-x-1">
                <Button 
                  onClick={handleUpload}
                  disabled={isUploading || uploadQueue.every(f => f.status !== 'pending')}
                  size="sm"
                  variant="default"
                  className="h-7 px-2"
                >
                  <Play className="w-3 h-3" />
                </Button>
                <Button 
                  variant="outline" 
                  onClick={clearAll} 
                  size="sm" 
                  disabled={isUploading}
                  className="h-7 px-2"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
            
            {/* File list - compact */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {uploadQueue.map((file) => (
                <div key={file.id} className="flex items-center space-x-2 p-1.5 border rounded">
                  {file.preview ? (
                    <img 
                      src={file.preview} 
                      alt={file.file.name}
                      className="w-6 h-6 object-cover rounded"
                    />
                  ) : (
                    <div className="w-6 h-6 flex items-center justify-center text-sm">
                      {getFileIcon(file.file.type)}
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{file.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.file.size)}
                    </p>
                    
                    {file.status === 'uploading' && (
                      <Progress value={file.progress} className="w-full mt-0.5 h-1" />
                    )}
                    
                    {file.errorMessage && (
                      <p className="text-xs text-destructive mt-0.5">{file.errorMessage}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <Badge variant={
                      file.status === 'completed' ? 'default' :
                      file.status === 'error' ? 'destructive' :
                      file.status === 'uploading' ? 'secondary' : 'outline'
                    } className="text-xs px-1.5 py-0.5">
                      {file.status === 'completed' && <CheckCircle className="w-2.5 h-2.5 mr-0.5" />}
                      {file.status === 'error' && <AlertCircle className="w-2.5 h-2.5 mr-0.5" />}
                      {file.status === 'completed' ? '完成' :
                       file.status === 'error' ? '错误' :
                       file.status === 'uploading' ? '上传中' : '等待'}
                    </Badge>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                      disabled={isUploading && file.status === 'uploading'}
                      className="h-6 w-6 p-0"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UploadZone;