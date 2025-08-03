/**
 * Offline Indicator Component
 * Shows network connection status and provides offline functionality
 */

import React, { useState, useEffect } from 'react';
import { 
  WifiOff, 
  AlertTriangle, 
  RefreshCw,
  X
} from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useToast } from '../hooks/use-toast';
import { healthChecker } from '../utils/healthCheck';
import { useSyncActions } from '../store/appStore';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [serverHealth, setServerHealth] = useState<{
    healthy: boolean;
    latency?: number;
    error?: string;
  } | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);
  
  const { toast } = useToast();
  const { syncWithServer } = useSyncActions();

  // Check server health
  const checkServerHealth = async () => {
    try {
      const health = await healthChecker.checkHealth();
      setServerHealth(health);
      setLastCheckTime(new Date());
      
      // Show alert if server becomes unhealthy
      if (!health.healthy && isOnline) {
        setShowAlert(true);
      }
      
      return health.healthy;
    } catch (error) {
      console.error('Health check failed:', error);
      setServerHealth({
        healthy: false,
        error: error instanceof Error ? error.message : 'Health check failed'
      });
      setLastCheckTime(new Date());
      return false;
    }
  };

  // Handle network status changes
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowAlert(false);
      toast({
        description: "网络连接已恢复",
      });
      
      // Check server when coming back online
      setTimeout(checkServerHealth, 1000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowAlert(true);
      toast({
        variant: "destructive",
        description: "网络连接已断开",
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial health check
    checkServerHealth();

    // Periodic health checks (every 30 seconds when online)
    const interval = setInterval(() => {
      if (isOnline) {
        checkServerHealth();
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [isOnline, toast]);

  // Handle retry connection
  const handleRetry = async () => {
    try {
      const isHealthy = await checkServerHealth();
      
      if (isHealthy) {
        setShowAlert(false);
        // Try to sync with server
        try {
          await syncWithServer();
          toast({
            description: "连接已恢复，数据已同步",
          });
        } catch (syncError) {
          toast({
            variant: "destructive",
            description: "连接已恢复，但数据同步失败",
          });
        }
      } else {
        toast({
          variant: "destructive",
          description: "服务器仍然不可用",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        description: "重试失败，请检查网络连接",
      });
    }
  };

  // Get connection status info
  const getConnectionStatus = () => {
    if (!isOnline) {
      return {
        type: 'offline' as const,
        message: '网络连接已断开',
        description: '您当前处于离线状态，某些功能可能不可用',
        canRetry: false
      };
    }

    if (serverHealth === null) {
      return {
        type: 'checking' as const,
        message: '检查服务器连接中...',
        description: '正在验证与服务器的连接',
        canRetry: false
      };
    }

    if (!serverHealth.healthy) {
      return {
        type: 'server_error' as const,
        message: '服务器连接异常',
        description: serverHealth.error || '无法连接到后端服务器',
        canRetry: true
      };
    }

    return null; // All good, no indicator needed
  };

  const connectionStatus = getConnectionStatus();

  // Don't show anything if everything is working fine
  if (!connectionStatus && !showAlert) {
    return null;
  }

  // Show alert version for critical issues
  if (showAlert && connectionStatus) {
    return (
      <Alert variant="destructive" className="mx-4 mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <div className="flex-1">
            <div className="font-medium">{connectionStatus.message}</div>
            <div className="text-sm mt-1">{connectionStatus.description}</div>
            {lastCheckTime && (
              <div className="text-xs text-muted-foreground mt-1">
                最后检查: {lastCheckTime.toLocaleTimeString('zh-CN')}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 ml-4">
            {connectionStatus.canRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="h-8"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                重试
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAlert(false)}
              className="h-8 w-8 p-0"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Show compact status in header/footer
  if (connectionStatus) {
    return (
      <Badge 
        variant={connectionStatus.type === 'offline' ? 'destructive' : 'secondary'}
        className="flex items-center gap-1 text-xs cursor-pointer"
        onClick={() => setShowAlert(true)}
      >
        {connectionStatus.type === 'offline' ? (
          <WifiOff className="w-3 h-3" />
        ) : (
          <AlertTriangle className="w-3 h-3" />
        )}
        <span>
          {connectionStatus.type === 'offline' ? '离线' : 
           connectionStatus.type === 'checking' ? '检查中' : '连接异常'}
        </span>
      </Badge>
    );
  }

  return null;
};

export default OfflineIndicator;