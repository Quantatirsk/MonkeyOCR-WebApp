/**
 * FileIcon Component
 * Displays appropriate icons based on file type
 */

import React from 'react';
import { 
  FileText, 
  Image, 
  File,
  FileType,
  FileImage,
  Paperclip
} from 'lucide-react';

interface FileIconProps {
  fileType?: string;
  fileName?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const FileIcon: React.FC<FileIconProps> = ({ 
  fileType, 
  fileName, 
  size = 'md',
  className = '' 
}) => {
  // Size mapping
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6'
  };

  // Determine file type from extension if not provided
  const getFileType = (): string => {
    if (fileType) return fileType.toLowerCase();
    if (!fileName) return 'unknown';
    
    const extension = fileName.split('.').pop()?.toLowerCase();
    return extension || 'unknown';
  };

  // Get appropriate icon based on file type
  const getIcon = () => {
    const type = getFileType();
    const iconClass = `${sizeClasses[size]} ${className}`;
    
    // PDF files
    if (type === 'pdf' || type === 'application/pdf') {
      return <FileText className={`${iconClass} text-red-600`} />;
    }
    
    // Image files
    if (
      type.startsWith('image/') || 
      ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(type)
    ) {
      return <Image className={`${iconClass} text-blue-600`} />;
    }
    
    // Text files
    if (
      type.startsWith('text/') || 
      ['txt', 'md', 'csv', 'json', 'xml', 'yaml', 'yml'].includes(type)
    ) {
      return <FileType className={`${iconClass} text-gray-600`} />;
    }
    
    // Archive files
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(type)) {
      return <Paperclip className={`${iconClass} text-orange-600`} />;
    }
    
    // Default file icon
    return <File className={`${iconClass} text-muted-foreground`} />;
  };

  return getIcon();
};

export default FileIcon;