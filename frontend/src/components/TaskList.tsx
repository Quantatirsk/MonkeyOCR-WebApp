/**
 * TaskList Component
 * Displays processing tasks with status, progress, and management controls
 */

import React from 'react';
import { 
  Clock, 
  AlertCircle, 
  FileText, 
  Image, 
  RotateCcw, 
  Trash2,
  Download
} from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { useAppStore } from '../store/appStore';
import { ProcessingTask } from '../types';
import { apiClient } from '../api/client';
import { useToast } from '../hooks/use-toast';

interface TaskListProps {
  className?: string;
  showCompleted?: boolean;
}

export const TaskList: React.FC<TaskListProps> = ({ 
  className = '',
  showCompleted = true
}) => {
  const { 
    tasks, 
    currentTaskId, 
    setCurrentTask, 
    removeTask, 
    uploadFiles,
    results
  } = useAppStore();
  const { toast } = useToast();

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

  // Simple time ago formatter
  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  // Handle task selection
  const handleTaskSelect = (task: ProcessingTask) => {
    setCurrentTask(task.id);
  };

  // Handle task retry
  const handleRetry = async (task: ProcessingTask) => {
    try {
      toast({
        description: "重试中...",
      });
      
      // Create a new file object from the task (this is a simplified version)
      // In a real implementation, you might need to store the original file
      const blob = new Blob([''], { type: task.file_type === 'pdf' ? 'application/pdf' : 'image/jpeg' });
      const file = new File([blob], task.filename, { type: blob.type });
      
      await uploadFiles([file]);
    } catch (error) {
      console.error('Retry failed:', error);
      toast({
        variant: "destructive",
        description: "重试失败",
      });
    }
  };

  // Handle task deletion
  const handleDelete = (taskId: string) => {
    if (confirm('确定要删除这个任务吗？')) {
      removeTask(taskId);
      toast({
        description: "任务已删除",
      });
    }
  };


  // Handle result download
  const handleDownload = async (task: ProcessingTask) => {
    try {
      toast({
        description: "开始下载...",
      });
      
      // Download the result file as blob
      const blob = await apiClient.downloadTaskResult(task.id);
      
      // Create download URL and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${task.filename}_ocr_result.zip`;
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

  // Render individual task item
  const renderTaskItem = (task: ProcessingTask) => {
    const isSelected = currentTaskId === task.id;
    const hasResult = results.has(task.id);
    
    return (
      <div
        key={task.id}
        className={`p-3 border rounded-lg cursor-pointer transition-all hover:bg-muted/50 hover:shadow-sm ${
          isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border'
        }`}
        onClick={() => handleTaskSelect(task)}
        style={{ maxWidth: '100%', width: '100%' }}
      >
        {/* Main content area */}
        <div className="flex items-start gap-3">
          {/* File type icon */}
          <div className="flex-shrink-0 mt-0.5">
            {getFileTypeIcon(task.file_type)}
          </div>
          
          {/* Task info - 占据剩余空间 */}
          <div className="flex-1 min-w-0">
            {/* First row: filename and status */}
            <div className="flex items-start gap-2 mb-2">
              <p className="text-sm font-medium break-words flex-1 leading-tight" title={task.filename}>
                {task.filename}
              </p>
              <Badge variant={getStatusColor(task.status)} className="text-xs px-2 py-0.5 flex-shrink-0">
                {task.status === 'pending' ? '等待' :
                 task.status === 'processing' ? '处理中' :
                 task.status === 'completed' ? '完成' :
                 task.status === 'failed' ? '失败' : task.status}
              </Badge>
            </div>
            
            {/* Second row: file type, time and action buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="flex-shrink-0 font-medium">{task.file_type.toUpperCase()}</span>
                <span className="flex-shrink-0">•</span>
                <span className="break-words">{formatTimeAgo(task.created_at)}</span>
              </div>
              
              {/* Action buttons - 同行右侧 */}
              <div className="flex items-center gap-1 ml-2">
                {task.status === 'completed' && hasResult && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(task);
                    }}
                    className="h-6 w-6 p-0 hover:bg-blue-50 hover:text-blue-600 rounded-md"
                    title="下载结果"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                )}
                
                {task.status === 'failed' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRetry(task);
                    }}
                    className="h-6 w-6 p-0 hover:bg-orange-50 hover:text-orange-600 rounded-md"
                    title="重试"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(task.id);
                  }}
                  className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-600 rounded-md text-muted-foreground hover:text-red-600"
                  title="删除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar for processing tasks */}
        {task.status === 'processing' && (
          <div className="mt-2">
            <Progress value={task.progress} className="w-full h-1.5" />
          </div>
        )}
        
        {/* Error message */}
        {task.error_message && (
          <Alert variant="destructive" className="mt-2 p-2">
            <AlertCircle className="h-3 w-3 flex-shrink-0" />
            <AlertDescription className="text-xs">
              {task.error_message}
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  if (filteredTasks.length === 0) {
    return (
      <div className={`flex flex-col h-full ${className}`}>
        <div className="flex-1 flex flex-col items-center justify-center space-y-2 p-4">
          <Clock className="w-6 h-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground text-center">暂无任务</p>
          <p className="text-xs text-muted-foreground/60 text-center">上传文件开始处理</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="border-b bg-muted/5 p-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">
            任务列表 ({filteredTasks.length})
          </h3>
        </div>
        
        {/* Task summary badges */}
        <div className="flex flex-wrap gap-1">
          {groupedTasks.processing.length > 0 && (
            <Badge variant="secondary" className="animate-pulse text-xs px-1 py-0">
              {groupedTasks.processing.length} 处理中
            </Badge>
          )}
          {groupedTasks.pending.length > 0 && (
            <Badge variant="secondary" className="text-xs px-1 py-0">
              {groupedTasks.pending.length} 等待
            </Badge>
          )}
          {groupedTasks.completed.length > 0 && (
            <Badge variant="default" className="text-xs px-1 py-0">
              {groupedTasks.completed.length} 已完成
            </Badge>
          )}
          {groupedTasks.failed.length > 0 && (
            <Badge variant="destructive" className="text-xs px-1 py-0">
              {groupedTasks.failed.length} 失败
            </Badge>
          )}
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full px-2 py-2">
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
      </div>
    </div>
  );
};

export default TaskList;