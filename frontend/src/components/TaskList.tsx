/**
 * TaskList Component
 * Displays processing tasks with status, progress, and management controls
 */

import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  AlertCircle, 
  FileText, 
  Image, 
  RotateCcw, 
  Trash2,
  Download,
  X
} from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { AnimatedProgress } from './ui/animated-progress';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { useAppStore } from '../store/appStore';
import { ProcessingTask } from '../types';
import { apiClient } from '../api/client';
import { useToast } from '../hooks/use-toast';
import { syncManager } from '../utils/syncManager';

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
    results,
    initializeSync,
    syncWithServer
  } = useAppStore();
  const { toast } = useToast();

  // 计时器状态管理
  const [timers, setTimers] = useState<{ [taskId: string]: number }>({});
  // 最终处理时间缓存（任务完成后保留）
  const [finalProcessingTimes, setFinalProcessingTimes] = useState<{ [taskId: string]: number }>({});
  // PDF页数缓存
  const [pdfPageCounts, setPdfPageCounts] = useState<{ [taskId: string]: number }>({});
  // 组件初始化状态
  const [isInitialized, setIsInitialized] = useState(false);
  // 删除确认弹窗状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  // 组件初始化 - 恢复状态和同步
  useEffect(() => {
    const initializeComponent = async () => {
      if (isInitialized) return;
      
      try {
        // 初始化同步管理器（这会自动触发同步）
        initializeSync();
        
        // 等待一小段时间让store的自动同步完成
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 恢复处理中任务的计时器状态
        const now = Date.now();
        const initialTimers: { [taskId: string]: number } = {};
        const initialFinalTimes: { [taskId: string]: number } = {};
        
        tasks.forEach(task => {
          if (task.status === 'processing') {
            // 基于服务器时间戳计算已经过的时间
            const startTime = new Date(task.created_at).getTime();
            const elapsed = Math.floor((now - startTime) / 1000);
            initialTimers[task.id] = Math.max(0, elapsed);
          } else if (task.status === 'completed' || task.status === 'failed') {
            // 对于已完成的任务，计算总处理时间
            if (task.completed_at) {
              const startTime = new Date(task.created_at).getTime();
              const endTime = new Date(task.completed_at).getTime();
              const totalTime = Math.floor((endTime - startTime) / 1000);
              initialFinalTimes[task.id] = Math.max(0, totalTime);
            }
          }
        });
        
        setTimers(initialTimers);
        setFinalProcessingTimes(initialFinalTimes);
        
        // 恢复PDF页数信息
        await restorePdfPageCounts();
        
        console.log('TaskList initialized with recovered state:', {
          timers: Object.keys(initialTimers).length,
          finalTimes: Object.keys(initialFinalTimes).length,
          tasks: tasks.length
        });
        
      } catch (error) {
        console.error('TaskList initialization failed:', error);
        toast({
          variant: "destructive",
          description: "任务状态恢复失败，可能需要手动刷新"
        });
      } finally {
        setIsInitialized(true);
      }
    };
    
    initializeComponent();
  }, [tasks.length, initializeSync, syncWithServer, isInitialized, toast]);

  // 恢复PDF页数信息
  const restorePdfPageCounts = async () => {
    const pdfTasks = tasks.filter(task => task.file_type === 'pdf');
    const pageCounts: { [taskId: string]: number } = {};
    
    // 首先从结果元数据获取页数（本地数据，无需网络请求）
    for (const task of pdfTasks) {
      const result = results.get(task.id);
      if (result?.metadata?.total_pages) {
        pageCounts[task.id] = result.metadata.total_pages;
      }
    }
    
    // 立即更新已有的页数信息
    if (Object.keys(pageCounts).length > 0) {
      setPdfPageCounts(prev => ({ ...prev, ...pageCounts }));
      console.log('Restored PDF page counts from results:', pageCounts);
    }
    
    // 对于没有页数信息的任务，限制并发请求数量
    const tasksNeedingPageCount = pdfTasks.filter(task => 
      !pageCounts[task.id] && 
      (task.status === 'completed' || task.status === 'processing')
    );
    
    if (tasksNeedingPageCount.length > 0) {
      console.log(`Need to fetch page counts for ${tasksNeedingPageCount.length} tasks`);
      
      // 限制并发数量，每次最多处理3个任务
      const batchSize = 3;
      for (let i = 0; i < tasksNeedingPageCount.length; i += batchSize) {
        const batch = tasksNeedingPageCount.slice(i, i + batchSize);
        
        // 并行处理当前批次
        await Promise.allSettled(
          batch.map(async (task) => {
            try {
              const previewData = await syncManager.getTaskPreview(task.id);
              if (previewData.data?.total_pages) {
                setPdfPageCounts(prev => ({
                  ...prev,
                  [task.id]: previewData.data.total_pages
                }));
              }
            } catch (error) {
              console.warn(`Failed to get preview for task ${task.id}:`, error);
              // 标记为失败
              setPdfPageCounts(prev => ({
                ...prev,
                [task.id]: -1
              }));
            }
          })
        );
        
        // 批次间间隔，避免过载
        if (i + batchSize < tasksNeedingPageCount.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    }
  };

  // 计时器effect - 为处理中的任务更新计时
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prevTimers => {
        const newTimers = { ...prevTimers };
        
        tasks.forEach(task => {
          if (task.status === 'processing') {
            const startTime = new Date(task.created_at).getTime();
            const now = Date.now();
            const elapsed = Math.floor((now - startTime) / 1000);
            newTimers[task.id] = elapsed;
          } else if ((task.status === 'completed' || task.status === 'failed') && newTimers[task.id]) {
            // 任务完成或失败时，保存最终处理时间并停止计时
            setFinalProcessingTimes(prev => ({
              ...prev,
              [task.id]: newTimers[task.id]
            }));
            delete newTimers[task.id];
          }
        });
        
        return newTimers;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [tasks]);

  // 监听任务变化，动态恢复新任务的状态
  useEffect(() => {
    if (!isInitialized) return;
    
    const now = Date.now();
    const newTimers: { [taskId: string]: number } = {};
    const newFinalTimes: { [taskId: string]: number } = {};
    
    tasks.forEach(task => {
      if (task.status === 'processing' && !timers[task.id]) {
        // 新的处理中任务，计算已经过的时间
        const startTime = new Date(task.created_at).getTime();
        const elapsed = Math.floor((now - startTime) / 1000);
        newTimers[task.id] = Math.max(0, elapsed);
      } else if ((task.status === 'completed' || task.status === 'failed') && 
                 !finalProcessingTimes[task.id] && task.completed_at) {
        // 新完成的任务，计算总处理时间
        const startTime = new Date(task.created_at).getTime();
        const endTime = new Date(task.completed_at).getTime();
        const totalTime = Math.floor((endTime - startTime) / 1000);
        newFinalTimes[task.id] = Math.max(0, totalTime);
      }
    });
    
    if (Object.keys(newTimers).length > 0) {
      setTimers(prev => ({ ...prev, ...newTimers }));
    }
    
    if (Object.keys(newFinalTimes).length > 0) {
      setFinalProcessingTimes(prev => ({ ...prev, ...newFinalTimes }));
    }
  }, [tasks, isInitialized, timers, finalProcessingTimes]);


  // 跟踪正在加载的任务，避免并发请求
  const [loadingPageCounts, setLoadingPageCounts] = useState<Set<string>>(new Set());

  // 动态加载单个PDF页数
  const loadPdfPageCount = async (taskId: string) => {
    if (pdfPageCounts[taskId]) return; // 已经有缓存
    if (loadingPageCounts.has(taskId)) return; // 正在加载中
    
    // 避免对无效任务ID发起请求
    if (!taskId || taskId.length < 10) {
      console.warn(`Invalid task ID for page count: ${taskId}`);
      return;
    }
    
    // 标记为加载中
    setLoadingPageCounts(prev => new Set(prev).add(taskId));
    
    try {
      const previewData = await syncManager.getTaskPreview(taskId);
      if (previewData.data?.total_pages) {
        setPdfPageCounts(prev => ({
          ...prev,
          [taskId]: previewData.data.total_pages
        }));
      } else {
        // 没有页数信息，标记为0
        setPdfPageCounts(prev => ({
          ...prev,
          [taskId]: 0
        }));
      }
    } catch (error) {
      // 检查是否是网络连接错误
      const isConnectionError = error instanceof Error && 
        (error.message.includes('ERR_CONNECTION_REFUSED') || 
         error.message.includes('Network error') ||
         error.message.includes('Cannot connect to server'));
      
      if (isConnectionError) {
        console.warn(`Backend server is not running. Skipping page count loading for task ${taskId}`);
        // 对于连接错误，标记为-2，表示服务器不可用
        setPdfPageCounts(prev => ({
          ...prev,
          [taskId]: -2
        }));
      } else {
        // 其他错误，只在开发环境显示详细错误
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Failed to load page count for task ${taskId}:`, error);
        }
        // 标记此任务已尝试获取页数，避免重复请求
        setPdfPageCounts(prev => ({
          ...prev,
          [taskId]: -1 // 使用-1表示获取失败
        }));
      }
    } finally {
      // 移除加载中标记
      setLoadingPageCounts(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  // 格式化时间显示
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs}s`;
  };

  // 获取任务处理时间（处理中显示实时时间，完成后显示最终时间）
  const getTaskProcessingTime = (task: ProcessingTask): number | null => {
    if (task.status === 'processing') {
      return timers[task.id] || 0;
    } else if (task.status === 'completed' || task.status === 'failed') {
      return finalProcessingTimes[task.id] || null;
    }
    return null;
  };

  // 获取处理进度信息 (针对不同文件类型和状态)
  const getProcessingInfo = (task: ProcessingTask): string | null => {
    if (task.file_type === 'pdf') {
      // 对于PDF文件，显示页码信息
      let totalPages = pdfPageCounts[task.id] || results.get(task.id)?.metadata?.total_pages;
      
      // 如果没有页数信息且未曾失败过，尝试动态加载
      // -1表示获取失败，-2表示服务器不可用
      if (!totalPages && pdfPageCounts[task.id] !== -1 && pdfPageCounts[task.id] !== -2 && 
          (task.status === 'completed' || task.status === 'processing')) {
        loadPdfPageCount(task.id);
      }
      
      // 如果获取失败（-1）或服务器不可用（-2），不显示页数信息
      if (pdfPageCounts[task.id] === -1 || pdfPageCounts[task.id] === -2) {
        totalPages = undefined;
      }
      
      if (totalPages && totalPages > 0) {
        if (task.status === 'processing') {
          // 处理中：显示当前页
          const currentPage = Math.ceil((task.progress / 100) * totalPages);
          return `第${Math.max(1, currentPage)} / ${totalPages}页`;
        } else if (task.status === 'completed') {
          // 完成后：显示总页数
          return `共${totalPages}页`;
        }
      }
      
      // 如果没有页数信息或其他状态，显示百分比或空
      if (task.status === 'processing') {
        return `${task.progress}%`;
      }
    } else if (task.file_type === 'image') {
      // 对于图片文件，处理中显示百分比
      if (task.status === 'processing') {
        return `${task.progress}%`;
      }
    }
    
    return null;
  };

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
  const handleDeleteClick = (taskId: string) => {
    setTaskToDelete(taskId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!taskToDelete) return;
    
    try {
      // Call backend API to delete the task
      await apiClient.deleteTask(taskToDelete);
      
      // Remove from frontend state first
      removeTask(taskToDelete);
      
      // Force a full sync with server to ensure consistency
      // This will use the fixed mergeTasks logic that respects server as authority
      await syncWithServer();
      
      toast({
        description: "任务已删除",
      });
    } catch (error) {
      console.error('Failed to delete task:', error);
      toast({
        variant: "destructive",
        description: "删除任务失败，请重新尝试",
      });
      
      // If deletion failed, sync to restore state
      try {
        await syncWithServer();
      } catch (syncError) {
        console.error('Failed to sync after delete error:', syncError);
      }
    } finally {
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
    }
  };

  // Handle clear all tasks
  const handleClearAllClick = () => {
    if (tasks.length === 0) return;
    setClearAllDialogOpen(true);
  };

  const handleClearAllConfirm = async () => {
    try {
      toast({
        description: "正在删除所有任务...",
      });

      // Delete all tasks in parallel
      const deletePromises = tasks.map(task => apiClient.deleteTask(task.id));
      const results = await Promise.allSettled(deletePromises);
      
      // Count successful deletions
      const successCount = results.filter(result => result.status === 'fulfilled').length;
      const failedCount = results.length - successCount;
      
      // Remove all tasks from frontend state
      tasks.forEach(task => removeTask(task.id));
      
      // Clear all local component state
      setTimers({});
      setFinalProcessingTimes({});
      setPdfPageCounts({});
      setLoadingPageCounts(new Set());
      
      // Force a full sync with server to ensure consistency
      await syncWithServer();
      
      if (failedCount === 0) {
        toast({
          description: `成功删除所有 ${successCount} 个任务`,
        });
      } else {
        toast({
          variant: "destructive",
          description: `删除完成：成功 ${successCount} 个，失败 ${failedCount} 个`,
        });
      }
    } catch (error) {
      console.error('Failed to clear all tasks:', error);
      toast({
        variant: "destructive",
        description: "批量删除失败，请重新尝试",
      });
      
      // If deletion failed, sync to restore state
      try {
        await syncWithServer();
      } catch (syncError) {
        console.error('Failed to sync after clear all error:', syncError);
      }
    } finally {
      setClearAllDialogOpen(false);
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
      >
        {/* 优化的卡片内容布局 */}
        <div className="space-y-2">
          {/* 第一行：文件名和状态 */}
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 mt-0.5">
              {getFileTypeIcon(task.file_type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-tight break-words line-clamp-2" title={task.filename}>
                {task.filename}
              </p>
            </div>
            <Badge variant={getStatusColor(task.status)} className="text-xs px-2 py-0.5 flex-shrink-0">
              {task.status === 'pending' ? '等待' :
               task.status === 'processing' ? '处理中' :
               task.status === 'completed' ? '完成' :
               task.status === 'failed' ? '失败' : task.status}
            </Badge>
          </div>
          {/* 第二行：元信息 */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="font-medium">{task.file_type.toUpperCase()}</span>
            <span>•</span>
            <span>{formatTimeAgo(task.created_at)}</span>
            
            {/* 处理时间或进度信息 */}
            {task.status === 'processing' ? (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span className="font-mono text-blue-600">{formatDuration(timers[task.id] || 0)}</span>
                </div>
                {getProcessingInfo(task) && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-green-600">{getProcessingInfo(task)}</span>
                  </>
                )}
              </>
            ) : (
              <>
                {getTaskProcessingTime(task) && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span className="font-mono text-blue-600">{formatDuration(getTaskProcessingTime(task)!)}</span>
                    </div>
                  </>
                )}
                {getProcessingInfo(task) && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-green-600">{getProcessingInfo(task)}</span>
                  </>
                )}
              </>
            )}
          </div>

          {/* 第三行：操作按钮 */}
          <div className="flex items-center justify-end gap-1">
            {task.status === 'completed' && hasResult && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(task);
                }}
                className="h-7 px-2 text-xs hover:bg-blue-50 hover:text-blue-600"
                title="下载结果"
              >
                <Download className="w-3 h-3 mr-1" />
                下载
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
                className="h-7 px-2 text-xs hover:bg-orange-50 hover:text-orange-600"
                title="重试"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                重试
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteClick(task.id);
              }}
              className="h-7 px-2 text-xs hover:bg-red-50 hover:text-red-600 text-muted-foreground"
              title="删除"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              删除
            </Button>
          </div>
        </div>

        {/* Progress bar for processing tasks */}
        {task.status === 'processing' && (
          <div className="mt-2">
            <AnimatedProgress 
              value={task.progress} 
              className="w-full h-1.5" 
              showAnimation={true}
            />
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
          {tasks.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAllClick}
              className="h-7 px-2 text-xs hover:bg-red-50 hover:text-red-600 text-muted-foreground"
              title="清空所有任务"
            >
              <X className="w-3 h-3 mr-1" />
              清空
            </Button>
          )}
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

      {/* Delete confirmation dialogs */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除任务</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个任务吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认清空所有任务</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除所有 {tasks.length} 个任务吗？此操作不可撤销，将会永久删除所有任务数据。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleClearAllConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除全部
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TaskList;