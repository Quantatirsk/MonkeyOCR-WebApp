/**
 * EmptyState Component
 * Displays empty states with customizable icons, messages, and actions
 */

import React from 'react';
import { 
  FileText, 
  Upload, 
  Search, 
  AlertCircle,
  Clock,
  CheckCircle,
  Image,
  Folder
} from 'lucide-react';
import { Button } from './button';
import { Card, CardContent } from './card';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  variant?: 'default' | 'card' | 'minimal';
  icon?: 'upload' | 'search' | 'document' | 'error' | 'clock' | 'success' | 'image' | 'folder' | React.ReactNode;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'secondary';
  };
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  variant = 'default',
  icon = 'document',
  title,
  description,
  action,
  className,
  size = 'md'
}) => {
  // Icon mapping
  const iconMap = {
    upload: Upload,
    search: Search,
    document: FileText,
    error: AlertCircle,
    clock: Clock,
    success: CheckCircle,
    image: Image,
    folder: Folder
  };

  // Size classes
  const sizeClasses = {
    sm: {
      container: 'py-4 px-2',
      icon: 'w-6 h-6',
      title: 'text-sm',
      description: 'text-xs',
      spacing: 'space-y-2'
    },
    md: {
      container: 'py-8 px-4',
      icon: 'w-8 h-8',
      title: 'text-base',
      description: 'text-sm',
      spacing: 'space-y-3'
    },
    lg: {
      container: 'py-12 px-6',
      icon: 'w-12 h-12',
      title: 'text-lg',
      description: 'text-base',
      spacing: 'space-y-4'
    }
  };

  const sizeClass = sizeClasses[size];

  // Get icon component
  const getIcon = () => {
    if (React.isValidElement(icon)) {
      return icon;
    }
    
    const IconComponent = iconMap[icon as keyof typeof iconMap];
    return IconComponent ? (
      <IconComponent className={cn(sizeClass.icon, 'text-muted-foreground')} />
    ) : null;
  };

  // Content component
  const content = (
    <div className={cn(
      'flex flex-col items-center text-center',
      sizeClass.container,
      sizeClass.spacing,
      className
    )}>
      {/* Icon */}
      {getIcon()}
      
      {/* Text content */}
      <div className={cn('space-y-1', size === 'sm' ? 'space-y-0.5' : 'space-y-1')}>
        {title && (
          <h3 className={cn('font-semibold text-foreground', sizeClass.title)}>
            {title}
          </h3>
        )}
        {description && (
          <p className={cn('text-muted-foreground leading-relaxed', sizeClass.description)}>
            {description}
          </p>
        )}
      </div>
      
      {/* Action button */}
      {action && (
        <Button
          variant={action.variant || 'outline'}
          onClick={action.onClick}
          size={size === 'sm' ? 'sm' : 'default'}
        >
          {action.label}
        </Button>
      )}
    </div>
  );

  // Render based on variant
  if (variant === 'card') {
    return (
      <Card className={className}>
        <CardContent className="p-0">
          {content}
        </CardContent>
      </Card>
    );
  }

  if (variant === 'minimal') {
    return (
      <div className={cn('text-center', className)}>
        <div className={cn('text-muted-foreground', sizeClass.description)}>
          {description || title}
        </div>
      </div>
    );
  }

  return content;
};

// Predefined empty states
export const EmptyStates = {
  NoTasks: (props?: Partial<EmptyStateProps>) => (
    <EmptyState
      icon="clock"
      title="暂无任务"
      description="上传文件开始处理"
      {...props}
    />
  ),
  
  NoResults: (props?: Partial<EmptyStateProps>) => (
    <EmptyState
      icon="search"
      title="未找到结果"
      description="尝试调整搜索条件"
      {...props}
    />
  ),
  
  NoDocuments: (props?: Partial<EmptyStateProps>) => (
    <EmptyState
      icon="document"
      title="未选择文档"
      description="从任务列表中选择已完成的任务查看 OCR 结果"
      {...props}
    />
  ),
  
  NoImages: (props?: Partial<EmptyStateProps>) => (
    <EmptyState
      icon="image"
      title="此文档中未找到图片"
      description="处理后的文档没有包含图片资源"
      {...props}
    />
  ),
  
  UploadPrompt: (onUpload: () => void, props?: Partial<EmptyStateProps>) => (
    <EmptyState
      icon="upload"
      title="开始使用 MonkeyOCR"
      description="拖拽或选择 PDF、图片文件进行 OCR 文字识别"
      action={{
        label: "选择文件",
        onClick: onUpload
      }}
      {...props}
    />
  ),
  
  Error: (message?: string, onRetry?: () => void, props?: Partial<EmptyStateProps>) => (
    <EmptyState
      icon="error"
      title="出现错误"
      description={message || "请稍后重试"}
      action={onRetry ? {
        label: "重试",
        onClick: onRetry,
        variant: "outline"
      } : undefined}
      {...props}
    />
  )
};

export default EmptyState;