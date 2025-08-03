/**
 * UploadZone Component
 * File drag-and-drop upload area with validation and progress tracking
 */

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, AlertCircle, CheckCircle, Play, Trash2 } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { useAppStore } from '../store/appStore';
import { UploadOptions } from '../types';
import { useToast } from '../hooks/use-toast';

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
  const { isUploading, uploadFiles } = useAppStore();
  const { toast } = useToast();
  const [uploadQueue, setUploadQueue] = useState<FileUploadItem[]>([]);
  const [uploadOptions, setUploadOptions] = useState<UploadOptions>({
    extract_type: 'standard',
    split_pages: false
  });

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
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

      toast({
        description: `开始上传 ${filesToUpload.length} 个文件...`,
      });

      await uploadFiles(filesToUpload, uploadOptions);
      
      // Mark files as completed
      setUploadQueue(prev => 
        prev.map(f => ({ ...f, status: 'completed' as const, progress: 100 }))
      );
      
      toast({
        description: "上传完成",
      });
      
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
      
      toast({
        variant: "destructive",
        description: "上传失败",
      });
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
      {/* Main Upload Area */}
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
              {isDragActive ? '拖放文件到此处' : '支持 PDF, JPG, PNG • 最多 10 个'}
            </p>
          </div>
          
          {!isDragActive && (
            <Button variant="outline" size="sm" disabled={disabled || isUploading}>
              <span className="text-xs">选择文件</span>
            </Button>
          )}
        </div>
      </div>

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

      {/* Processing Options & File Queue - Merged */}
      {uploadQueue.length > 0 && (
        <Card>
          <CardContent className="p-3 space-y-3">
            {/* Header with actions */}
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">任务配置 ({uploadQueue.length})</h4>
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
            
            {/* Processing options - compact */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">提取类型</label>
                <select 
                  className="w-full h-7 px-2 text-xs border rounded"
                  value={uploadOptions.extract_type}
                  onChange={(e) => setUploadOptions(prev => ({ 
                    ...prev, 
                    extract_type: e.target.value as any 
                  }))}
                  disabled={isUploading}
                >
                  <option value="standard">标准</option>
                  <option value="split">分页</option>
                  <option value="text">纯文本</option>
                  <option value="formula">公式识别</option>
                  <option value="table">表格提取</option>
                </select>
              </div>
              
              <div className="flex items-end">
                <label className="flex items-center space-x-1.5">
                  <input
                    type="checkbox"
                    checked={uploadOptions.split_pages}
                    onChange={(e) => setUploadOptions(prev => ({ 
                      ...prev, 
                      split_pages: e.target.checked 
                    }))}
                    disabled={isUploading}
                    className="w-3 h-3"
                  />
                  <span className="text-xs font-medium">按页拆分</span>
                </label>
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