/**
 * TaskList Component
 * Displays processing tasks with status, progress, and management controls
 */

import React from 'react';
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  FileText, 
  Image, 
  RotateCcw, 
  Trash2,
  Download,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Alert, AlertDescription } from './ui/alert';
import { useAppStore } from '../store/appStore';
import { ProcessingTask } from '../types';

interface TaskListProps {
  className?: string;
  maxHeight?: string;
  showCompleted?: boolean;
}

export const TaskList: React.FC<TaskListProps> = ({ 
  className = '',
  maxHeight = '400px',
  showCompleted = true
}) => {
  const { 
    tasks, 
    currentTaskId, 
    setCurrentTask, 
    removeTask, 
    uploadFiles,
    pollTaskStatus,
    results
  } = useAppStore();

  // Filter tasks based on showCompleted prop
  const filteredTasks = showCompleted 
    ? tasks 
    : tasks.filter(task => task.status !== 'completed');

  // Group tasks by status
  const groupedTasks = {
    processing: tasks.filter(t => t.status === 'processing'),
    pending: tasks.filter(t => t.status === 'pending'),
    completed: tasks.filter(t => t.status === 'completed'),
    failed: tasks.filter(t => t.status === 'failed')
  };

  // Get status icon
  const getStatusIcon = (status: ProcessingTask['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  // Get status color
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
      <FileText className="w-4 h-4" /> : 
      <Image className="w-4 h-4" />;
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Simple time ago formatter
  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Handle task selection
  const handleTaskSelect = (task: ProcessingTask) => {
    setCurrentTask(task.id);
  };

  // Handle task retry
  const handleRetry = async (task: ProcessingTask) => {
    try {
      // Create a new file object from the task (this is a simplified version)
      // In a real implementation, you might need to store the original file
      const blob = new Blob([''], { type: task.file_type === 'pdf' ? 'application/pdf' : 'image/jpeg' });
      const file = new File([blob], task.filename, { type: blob.type });
      
      await uploadFiles([file]);
    } catch (error) {
      console.error('Retry failed:', error);
    }
  };

  // Handle task deletion
  const handleDelete = (taskId: string) => {
    if (confirm('Are you sure you want to delete this task?')) {
      removeTask(taskId);
    }
  };

  // Handle result viewing
  const handleViewResult = (task: ProcessingTask) => {
    handleTaskSelect(task);
  };

  // Handle result download
  const handleDownload = async (task: ProcessingTask) => {
    if (!task.result_url) return;
    
    try {
      // Open download URL in new tab
      window.open(task.result_url, '_blank');
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  // Render individual task item
  const renderTaskItem = (task: ProcessingTask) => {
    const isSelected = currentTaskId === task.id;
    const hasResult = results.has(task.id);
    
    return (
      <div
        key={task.id}
        className={`p-3 border rounded-lg cursor-pointer transition-all hover:bg-muted/50 ${
          isSelected ? 'border-primary bg-primary/5' : 'border-border'
        }`}
        onClick={() => handleTaskSelect(task)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1 min-w-0">
            {/* File type icon */}
            <div className="flex-shrink-0 mt-0.5">
              {getFileTypeIcon(task.file_type)}
            </div>
            
            {/* Task info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <p className="text-sm font-medium truncate">{task.filename}</p>
                <Badge variant={getStatusColor(task.status)} className="text-xs">
                  {task.status}
                </Badge>
              </div>
              
              <div className="flex items-center space-x-2 text-xs text-muted-foreground mb-2">
                <span>{task.file_type.toUpperCase()}</span>
                <span>•</span>
                <span>{formatTimeAgo(task.created_at)}</span>
                {task.completed_at && (
                  <>
                    <span>•</span>
                    <span>Completed {formatTimeAgo(task.completed_at)}</span>
                  </>
                )}
              </div>
              
              {/* Progress bar for processing tasks */}
              {task.status === 'processing' && (
                <Progress value={task.progress} className="w-full mb-2" />
              )}
              
              {/* Error message */}
              {task.error_message && (
                <Alert variant="destructive" className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {task.error_message}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
          
          {/* Status icon */}
          <div className="flex-shrink-0 ml-2">
            {getStatusIcon(task.status)}
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center justify-end space-x-1 mt-2">
          {task.status === 'completed' && hasResult && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewResult(task);
                }}
                title="View result"
              >
                <Eye className="w-3 h-3" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(task);
                }}
                title="Download result"
              >
                <Download className="w-3 h-3" />
              </Button>
            </>
          )}
          
          {task.status === 'failed' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleRetry(task);
              }}
              title="Retry"
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(task.id);
            }}
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    );
  };

  if (filteredTasks.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center space-y-2">
            <Clock className="w-8 h-8 text-muted-foreground" />
            <p className="text-muted-foreground">No tasks yet</p>
            <p className="text-xs text-muted-foreground">Upload files to start processing</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            Processing Tasks ({filteredTasks.length})
          </CardTitle>
          
          {/* Task summary badges */}
          <div className="flex items-center space-x-2">
            {groupedTasks.processing.length > 0 && (
              <Badge variant="default" className="text-xs">
                {groupedTasks.processing.length} processing
              </Badge>
            )}
            {groupedTasks.pending.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {groupedTasks.pending.length} pending
              </Badge>
            )}
            {groupedTasks.completed.length > 0 && (
              <Badge variant="default" className="text-xs">
                {groupedTasks.completed.length} completed
              </Badge>
            )}
            {groupedTasks.failed.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {groupedTasks.failed.length} failed
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea style={{ maxHeight }} className="px-4 pb-4">
          <div className="space-y-2">
            {/* Processing tasks first */}
            {groupedTasks.processing.map(renderTaskItem)}
            
            {/* Then pending tasks */}
            {groupedTasks.pending.length > 0 && groupedTasks.processing.length > 0 && (
              <Separator className="my-2" />
            )}
            {groupedTasks.pending.map(renderTaskItem)}
            
            {/* Then failed tasks */}
            {groupedTasks.failed.length > 0 && (groupedTasks.processing.length > 0 || groupedTasks.pending.length > 0) && (
              <Separator className="my-2" />
            )}
            {groupedTasks.failed.map(renderTaskItem)}
            
            {/* Finally completed tasks */}
            {showCompleted && groupedTasks.completed.length > 0 && (
              <>
                {(groupedTasks.processing.length > 0 || groupedTasks.pending.length > 0 || groupedTasks.failed.length > 0) && (
                  <Separator className="my-2" />
                )}
                {groupedTasks.completed.map(renderTaskItem)}
              </>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default TaskList;