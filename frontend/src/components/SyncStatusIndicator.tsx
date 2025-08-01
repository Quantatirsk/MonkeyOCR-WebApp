/**
 * Sync Status Indicator Component
 * Shows data synchronization progress and status to users
 */

import React from 'react';
import { 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  RefreshCw,
  WifiOff,
  Wifi
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from './ui/tooltip';
import { useSyncStatus, useSyncActions } from '../store/appStore';
import { useToast } from '../hooks/use-toast';

interface SyncStatusIndicatorProps {
  className?: string;
  showText?: boolean;
  compact?: boolean;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ 
  className = '',
  showText = true,
  compact = false
}) => {
  const syncStatus = useSyncStatus();
  const { syncWithServer } = useSyncActions();
  const { toast } = useToast();

  // Manual sync handler
  const handleManualSync = async () => {
    try {
      await syncWithServer();
      toast({
        description: "数据同步完成",
      });
    } catch (error) {
      console.error('Manual sync failed:', error);
      toast({
        variant: "destructive",
        description: "同步失败，请检查网络连接",
      });
    }
  };

  // Get sync status info
  const getSyncInfo = () => {
    if (!syncStatus) {
      return {
        icon: <WifiOff className="w-3 h-3" />,
        text: '未连接',
        variant: 'secondary' as const,
        description: '数据同步服务未初始化'
      };
    }

    if (syncStatus.is_syncing) {
      return {
        icon: <Loader2 className="w-3 h-3 animate-spin" />,
        text: '同步中',
        variant: 'default' as const,
        description: '正在与服务器同步数据...'
      };
    }

    if (syncStatus.sync_error) {
      const retryInfo = syncStatus.retry_count > 0 
        ? ` (重试 ${syncStatus.retry_count}/${syncStatus.max_retries})`
        : '';
      
      return {
        icon: <AlertCircle className="w-3 h-3" />,
        text: '同步错误',
        variant: 'destructive' as const,
        description: `同步失败: ${syncStatus.sync_error}${retryInfo}`
      };
    }

    if (syncStatus.last_sync) {
      const lastSyncTime = new Date(syncStatus.last_sync);
      const now = new Date();
      const diffMs = now.getTime() - lastSyncTime.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      let timeText = '';
      if (diffMins < 1) {
        timeText = '刚刚同步';
      } else if (diffMins < 60) {
        timeText = `${diffMins}分钟前`;
      } else {
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) {
          timeText = `${diffHours}小时前`;
        } else {
          timeText = lastSyncTime.toLocaleDateString('zh-CN');
        }
      }

      return {
        icon: <CheckCircle className="w-3 h-3" />,
        text: '已同步',
        variant: 'default' as const,
        description: `最后同步: ${timeText}`
      };
    }

    return {
      icon: <WifiOff className="w-3 h-3" />,
      text: '未同步',
      variant: 'secondary' as const,
      description: '尚未进行数据同步'
    };
  };

  const syncInfo = getSyncInfo();

  if (compact) {
    // Compact mode - just the icon with tooltip
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 w-6 p-0 ${className}`}
              onClick={handleManualSync}
              disabled={syncStatus?.is_syncing}
            >
              {syncInfo.icon}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{syncInfo.description}</p>
            {!syncStatus?.is_syncing && (
              <p className="text-xs text-muted-foreground mt-1">点击手动同步</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full mode - badge with optional text
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge 
        variant={syncInfo.variant}
        className="flex items-center gap-1 text-xs px-2 py-1"
      >
        {syncInfo.icon}
        {showText && <span>{syncInfo.text}</span>}
      </Badge>

      {/* Manual sync button (only show when not syncing) */}
      {!syncStatus?.is_syncing && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-muted"
                onClick={handleManualSync}
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">手动同步数据</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Connection status indicator */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center">
              {syncStatus ? (
                <Wifi className="w-3 h-3 text-green-500" />
              ) : (
                <WifiOff className="w-3 h-3 text-muted-foreground" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">
              {syncStatus ? '服务器连接正常' : '服务器连接异常'}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default SyncStatusIndicator;