/**
 * BatchControls Component
 * Provides batch operations for task management
 */

import React from 'react';
import { 
  Trash2, 
  RotateCcw, 
  Download, 
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { useAppStore, useBatchProgress, useTaskActions } from '../store/appStore';
import { useToast } from '../hooks/use-toast';

interface BatchControlsProps {
  variant?: 'full' | 'compact' | 'minimal';
  showProgress?: boolean;
  className?: string;
}

export const BatchControls: React.FC<BatchControlsProps> = ({
  variant = 'full',
  showProgress = true,
  className = ''
}) => {
  const { 
    tasks, 
    processingTasks, 
    failedTasks, 
    completedTasks, 
    pendingTasks 
  } = useAppStore();
  
  const batchProgress = useBatchProgress();
  const { 
    clearAllTasks, 
    clearCompletedTasks, 
    clearFailedTasks, 
    retryFailedTasks 
  } = useTaskActions();
  
  const { toast } = useToast();

  // Handle batch operations
  const handleClearAll = () => {
    if (confirm('确定要清空所有任务吗？这将删除所有任务和结果。')) {
      clearAllTasks();
      toast({
        description: "已清空所有任务",
      });
    }
  };

  const handleClearCompleted = () => {
    if (completedTasks.length === 0) return;
    
    clearCompletedTasks();
    toast({
      description: `已清理 ${completedTasks.length} 个完成的任务`,
    });
  };

  const handleClearFailed = () => {
    if (failedTasks.length === 0) return;
    
    clearFailedTasks();
    toast({
      description: `已清理 ${failedTasks.length} 个失败的任务`,
    });
  };

  const handleRetryFailed = async () => {
    if (failedTasks.length === 0) return;
    
    try {
      toast({
        description: `开始重试 ${failedTasks.length} 个失败的任务...`,
      });
      
      await retryFailedTasks();
      
      toast({
        description: "已重新提交失败的任务",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        description: "重试失败",
      });
    }
  };

  const handleDownloadAll = async () => {
    // TODO: Implement batch download functionality
    toast({
      description: "批量下载功能正在开发中...",
    });
  };

  // Minimal variant - just progress info
  if (variant === 'minimal') {
    if (tasks.length === 0) return null;
    
    return (
      <div className={`flex items-center space-x-2 text-xs text-muted-foreground ${className}`}>
        <span>{batchProgress.completed}/{batchProgress.total} 完成</span>
        {showProgress && batchProgress.total > 0 && (
          <div className="w-16">
            <Progress value={batchProgress.percentage} className="h-1" />
          </div>
        )}
      </div>
    );
  }

  // Compact variant - dropdown with actions
  if (variant === 'compact') {
    if (tasks.length === 0) return null;
    
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        {/* Progress indicator */}
        <div className="flex items-center space-x-1">
          <Badge variant="outline" className="text-xs">
            {batchProgress.completed}/{batchProgress.total}
          </Badge>
          {showProgress && (
            <div className="w-12">
              <Progress value={batchProgress.percentage} className="h-1" />
            </div>
          )}
        </div>

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 px-2">
              批量操作
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {failedTasks.length > 0 && (
              <DropdownMenuItem onClick={handleRetryFailed}>
                <RotateCcw className="w-3 h-3 mr-2" />
                重试失败任务 ({failedTasks.length})
              </DropdownMenuItem>
            )}
            
            {completedTasks.length > 0 && (
              <>
                <DropdownMenuItem onClick={handleDownloadAll}>
                  <Download className="w-3 h-3 mr-2" />
                  下载所有结果 ({completedTasks.length})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleClearCompleted}>
                  <CheckCircle className="w-3 h-3 mr-2" />
                  清理已完成 ({completedTasks.length})
                </DropdownMenuItem>
              </>
            )}
            
            {failedTasks.length > 0 && (
              <DropdownMenuItem onClick={handleClearFailed}>
                <XCircle className="w-3 h-3 mr-2" />
                清理失败任务 ({failedTasks.length})
              </DropdownMenuItem>
            )}
            
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleClearAll} className="text-destructive">
              <Trash2 className="w-3 h-3 mr-2" />
              清空所有任务
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // Full variant - complete control panel
  if (tasks.length === 0) return null;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>批量管理</span>
          <Badge variant="outline" className="text-xs">
            {tasks.length} 任务
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Overview */}
        {showProgress && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">总体进度</span>
              <span className="font-medium">{batchProgress.percentage}%</span>
            </div>
            <Progress value={batchProgress.percentage} className="h-2" />
            <div className="text-xs text-muted-foreground">
              {batchProgress.completed} / {batchProgress.total} 已完成
            </div>
          </div>
        )}

        {/* Task Status Summary */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {processingTasks.length > 0 && (
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3 text-blue-600" />
              <span>{processingTasks.length} 处理中</span>
            </div>
          )}
          
          {pendingTasks.length > 0 && (
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span>{pendingTasks.length} 等待中</span>
            </div>
          )}
          
          {completedTasks.length > 0 && (
            <div className="flex items-center space-x-1">
              <CheckCircle className="w-3 h-3 text-green-600" />
              <span>{completedTasks.length} 已完成</span>
            </div>
          )}
          
          {failedTasks.length > 0 && (
            <div className="flex items-center space-x-1">
              <AlertTriangle className="w-3 h-3 text-red-600" />
              <span>{failedTasks.length} 失败</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {failedTasks.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetryFailed}
              className="h-7 px-2 text-xs"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              重试失败
            </Button>
          )}
          
          {completedTasks.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadAll}
                className="h-7 px-2 text-xs"
              >
                <Download className="w-3 h-3 mr-1" />
                下载全部
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearCompleted}
                className="h-7 px-2 text-xs"
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                清理完成
              </Button>
            </>
          )}
          
          {failedTasks.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFailed}
              className="h-7 px-2 text-xs"
            >
              <XCircle className="w-3 h-3 mr-1" />
              清理失败
            </Button>
          )}
          
          <Button
            variant="destructive"
            size="sm"
            onClick={handleClearAll}
            className="h-7 px-2 text-xs"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            清空全部
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default BatchControls;