
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LogIn, UserPlus, Moon, Sun, PanelLeftClose, PanelLeft } from 'lucide-react';
import { useAppStore, useUIActions } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { SyncStatusIndicator } from '../SyncStatusIndicator';
import { UserMenu } from './UserMenu';
import { AuthPage } from '../auth/AuthPage';
import { authClient } from '@/api/authClient';

export function Header() {
  const tasks = useAppStore(state => state.tasks);
  const isProcessing = useAppStore(state => state.isProcessing);
  const clearUserData = useAppStore(state => state.clearUserData);
  const theme = useAppStore(state => state.theme);
  const { toggleTheme } = useUIActions();
  
  // 使用独立的 UI Store 管理 UI 状态
  const taskListVisible = useUIStore(state => state.taskListVisible);
  const toggleTaskListVisible = useUIStore(state => state.toggleTaskListVisible);
  
  // Use real auth state from store
  const { user, isAuthenticated, logout: clearAuthData } = useAuthStore();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  
  // Task stats - use tasks directly since server already filters by user when authenticated
  const taskStats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    processing: tasks.filter(t => t.status === 'processing').length
  };
  
  const handleLogin = () => {
    setAuthModalOpen(true);
  };
  
  const handleRegister = () => {
    setAuthModalOpen(true);
  };
  
  
  const handleLogout = async () => {
    try {
      // Call logout API
      await authClient.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Clear auth data and user tasks
      clearAuthData();
      clearUserData();
      
      // Clear ALL localStorage data to ensure complete logout
      localStorage.removeItem('auth-storage');  // Auth store
      localStorage.removeItem('monkeyocr-app-store');  // App store
      localStorage.removeItem('monkeyocr-sync-state');  // Sync state
      
      // Force page reload to ensure clean state
      // This will trigger a fresh sync from server
      window.location.reload();
    }
  };
  
  const handleSettingsClick = () => {
    // TODO: Navigate to settings page
  };

  // 任务列表切换 - 现在使用 transform 动画，不会触发重布局
  const handleToggleTaskList = () => {
    toggleTaskListVisible();
  };

  return (
    <>
      <header className="h-12 border-b bg-background" style={{ height: '48px', minHeight: '48px', maxHeight: '48px' }}>
        <div className="h-full px-4 flex items-center justify-between" style={{ height: '48px' }}>
          <div className="flex items-center space-x-3">
            <h1 className="text-lg font-semibold" style={{ lineHeight: '1', fontSize: '18px' }}>MonkeyOCR</h1>
            <Badge variant="default" className="text-xs">
              v1.0
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleTaskList}
              className="h-8 w-8 p-0"
              title={taskListVisible ? '收起任务列表' : '展开任务列表'}
            >
              {taskListVisible ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="h-8 w-8 p-0"
              title={theme === 'dark' ? '切换到亮色模式' : '切换到深色模式'}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            
            <SyncStatusIndicator compact={true} />
            {isProcessing && (
              <Badge variant="secondary" className="animate-pulse text-xs">
                处理中...
              </Badge>
            )}
            
            {/* Authentication UI */}
            {isAuthenticated && user ? (
              <UserMenu
                user={user}
                taskStats={taskStats}
                onSettingsClick={handleSettingsClick}
                onLogout={handleLogout}
              />
            ) : (
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogin}
                  className="h-8"
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  登录
                </Button>
                <Button
                  size="sm"
                  onClick={handleRegister}
                  className="h-8"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  注册
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>
      
      {/* Auth Page */}
      {authModalOpen && (
        <AuthPage
          onClose={() => setAuthModalOpen(false)}
          onSuccess={() => {
            // Auth state is already updated in AuthPage
          }}
        />
      )}
    </>
  );
}
