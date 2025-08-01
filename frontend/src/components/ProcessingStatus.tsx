/**
 * ProcessingStatus Component
 * Displays processing status with progress indicators, animations, and time estimates
 */

import React from 'react';
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  FileText,
  Image,
  Timer
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Card, CardContent } from './ui/card';
import { ProcessingTask } from '../types';

interface ProcessingStatusProps {
  task: ProcessingTask;
  className?: string;
  showTimeEstimate?: boolean;
  showProgressBar?: boolean;
  variant?: 'default' | 'compact' | 'detailed';
}

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({
  task,
  className = '',
  showTimeEstimate = true,
  showProgressBar = true,
  variant = 'default'
}) => {
  // Status icon mapping
  const getStatusIcon = (status: ProcessingTask['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  // Status color mapping
  const getStatusColor = (status: ProcessingTask['status']) => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'processing':
        return 'default';
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  // Get file type icon
  const getFileTypeIcon = (fileType: ProcessingTask['file_type']) => {
    return fileType === 'pdf' ? 
      <FileText className="w-3 h-3" /> : 
      <Image className="w-3 h-3" />;
  };

  // Estimate remaining time based on progress
  const getTimeEstimate = (): string => {
    if (task.status !== 'processing' || task.progress === 0) return '';
    
    const elapsed = Date.now() - new Date(task.created_at).getTime();
    const elapsedSeconds = Math.floor(elapsed / 1000);
    
    if (task.progress >= 100) return '';
    
    // Simple linear estimation
    const estimatedTotal = (elapsedSeconds / task.progress) * 100;
    const remaining = Math.max(0, estimatedTotal - elapsedSeconds);
    
    if (remaining < 60) return `约 ${Math.ceil(remaining)}s`;
    const minutes = Math.ceil(remaining / 60);
    return `约 ${minutes}m`;
  };

  // Format processing time
  const formatElapsedTime = (): string => {
    const elapsed = Date.now() - new Date(task.created_at).getTime();
    const seconds = Math.floor(elapsed / 1000);
    
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Status text mapping
  const getStatusText = (status: ProcessingTask['status']) => {
    switch (status) {
      case 'pending':
        return '等待处理';
      case 'processing':
        return '处理中';
      case 'completed':
        return '已完成';
      case 'failed':
        return '处理失败';
      default:
        return status;
    }
  };

  // Compact variant
  if (variant === 'compact') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        {getStatusIcon(task.status)}
        <Badge variant={getStatusColor(task.status)} className="text-xs">
          {getStatusText(task.status)}
        </Badge>
        {task.status === 'processing' && showTimeEstimate && (
          <span className="text-xs text-muted-foreground">
            {getTimeEstimate()}
          </span>
        )}
      </div>
    );
  }

  // Detailed variant
  if (variant === 'detailed') {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {getStatusIcon(task.status)}
                <span className="font-medium text-sm">{getStatusText(task.status)}</span>
              </div>
              <div className="flex items-center space-x-1">
                {getFileTypeIcon(task.file_type)}
                <span className="text-xs text-muted-foreground">
                  {task.file_type.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Progress section */}
            {task.status === 'processing' && showProgressBar && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">进度</span>
                  <span className="font-medium">{task.progress}%</span>
                </div>
                <Progress value={task.progress} className="h-2" />
              </div>
            )}

            {/* Time information */}
            {showTimeEstimate && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <Timer className="w-3 h-3" />
                  <span>已用时: {formatElapsedTime()}</span>
                </div>
                {task.status === 'processing' && getTimeEstimate() && (
                  <span>剩余: {getTimeEstimate()}</span>
                )}
              </div>
            )}

            {/* Error message */}
            {task.error_message && (
              <div className="p-2 bg-destructive/10 text-destructive text-xs rounded border border-destructive/20">
                {task.error_message}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default variant
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div className="flex items-center space-x-2">
        {getStatusIcon(task.status)}
        <span className="text-sm font-medium">{getStatusText(task.status)}</span>
        {task.status === 'processing' && (
          <span className="text-xs text-muted-foreground">
            {task.progress}%
          </span>
        )}
      </div>
      
      {showTimeEstimate && (
        <div className="text-xs text-muted-foreground">
          {task.status === 'processing' && getTimeEstimate() ? 
            getTimeEstimate() : 
            formatElapsedTime()
          }
        </div>
      )}
      
      {task.status === 'processing' && showProgressBar && (
        <div className="ml-4 flex-1 max-w-20">
          <Progress value={task.progress} className="h-1" />
        </div>
      )}
    </div>
  );
};

export default ProcessingStatus;