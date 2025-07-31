/**
 * UploadZone Component
 * File drag-and-drop upload area with validation and progress tracking
 */

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { useAppStore } from '../store/appStore';
import { FileWithPreview, UploadOptions } from '../types';

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

interface FileUploadItem extends FileWithPreview {
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  errorMessage?: string;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ 
  className = '', 
  disabled = false 
}) => {
  const { isUploading, uploadFiles } = useAppStore();
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
      ...file,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      progress: 0,
      status: 'pending' as const,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
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
        .map(f => new File([f], f.name, { type: f.type }));

      await uploadFiles(filesToUpload, uploadOptions);
      
      // Mark files as completed
      setUploadQueue(prev => 
        prev.map(f => ({ ...f, status: 'completed' as const, progress: 100 }))
      );
      
      // Clear queue after successful upload
      setTimeout(clearAll, 2000);
    } catch (error) {
      // Mark files as error
      setUploadQueue(prev => 
        prev.map(f => ({ 
          ...f, 
          status: 'error' as const, 
          errorMessage: error instanceof Error ? error.message : 'Upload failed' 
        }))
      );
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
  const getFileIcon = (type: string) => {
    if (type === 'application/pdf') return '📄';
    if (type.startsWith('image/')) return '🖼️';
    return '📎';
  };

  return (
    <div className={`w-full space-y-4 ${className}`}>
      {/* Main Upload Area */}
      <Card className={`transition-all duration-200 ${
        isDragActive ? 'border-primary bg-primary/5' : ''
      } ${isDragReject ? 'border-destructive bg-destructive/5' : ''}`}>
        <CardContent className="p-8">
          <div
            {...getRootProps()}
            className={`
              relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
              ${isDragReject ? 'border-destructive bg-destructive/5' : ''}
              ${disabled || isUploading ? 'pointer-events-none opacity-50' : 'hover:border-primary/50'}
            `}
          >
            <input {...getInputProps()} />
            
            <div className="flex flex-col items-center space-y-4">
              <div className="rounded-full bg-primary/10 p-4">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">
                  {isDragActive ? 'Drop files here' : 'Upload files for OCR processing'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Drag and drop files here, or click to select files
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports PDF, JPG, PNG, WEBP • Max {MAX_FILES} files • Up to {formatFileSize(MAX_FILE_SIZE)} each
                </p>
              </div>
              
              {!isDragActive && (
                <Button variant="outline" disabled={disabled || isUploading}>
                  Select Files
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Rejections */}
      {fileRejections.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Some files were rejected:
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

      {/* Upload Options */}
      {uploadQueue.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h4 className="font-semibold">Processing Options</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Extraction Type</label>
                <select 
                  className="w-full p-2 border rounded-md"
                  value={uploadOptions.extract_type}
                  onChange={(e) => setUploadOptions(prev => ({ 
                    ...prev, 
                    extract_type: e.target.value as any 
                  }))}
                  disabled={isUploading}
                >
                  <option value="standard">Standard</option>
                  <option value="split">Split Pages</option>
                  <option value="text">Text Only</option>
                  <option value="formula">Formula Recognition</option>
                  <option value="table">Table Extraction</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={uploadOptions.split_pages}
                    onChange={(e) => setUploadOptions(prev => ({ 
                      ...prev, 
                      split_pages: e.target.checked 
                    }))}
                    disabled={isUploading}
                  />
                  <span className="text-sm font-medium">Split into pages</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* File Queue */}
      {uploadQueue.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold">Files to Upload ({uploadQueue.length})</h4>
              <div className="space-x-2">
                <Button 
                  onClick={handleUpload}
                  disabled={isUploading || uploadQueue.every(f => f.status !== 'pending')}
                  size="sm"
                >
                  {isUploading ? 'Uploading...' : 'Start Upload'}
                </Button>
                <Button variant="outline" onClick={clearAll} size="sm" disabled={isUploading}>
                  Clear All
                </Button>
              </div>
            </div>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {uploadQueue.map((file) => (
                <div key={file.id} className="flex items-center space-x-3 p-2 border rounded-lg">
                  {file.preview ? (
                    <img 
                      src={file.preview} 
                      alt={file.name}
                      className="w-10 h-10 object-cover rounded"
                    />
                  ) : (
                    <div className="w-10 h-10 flex items-center justify-center text-2xl">
                      {getFileIcon(file.type)}
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)} • {file.type}
                    </p>
                    
                    {file.status === 'uploading' && (
                      <Progress value={file.progress} className="w-full mt-1" />
                    )}
                    
                    {file.errorMessage && (
                      <p className="text-xs text-destructive mt-1">{file.errorMessage}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge variant={
                      file.status === 'completed' ? 'default' :
                      file.status === 'error' ? 'destructive' :
                      file.status === 'uploading' ? 'secondary' : 'outline'
                    }>
                      {file.status === 'completed' && <CheckCircle className="w-3 h-3 mr-1" />}
                      {file.status === 'error' && <AlertCircle className="w-3 h-3 mr-1" />}
                      {file.status}
                    </Badge>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                      disabled={isUploading && file.status === 'uploading'}
                    >
                      <X className="w-4 h-4" />
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