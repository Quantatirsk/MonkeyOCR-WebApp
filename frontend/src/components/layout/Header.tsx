
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LogIn, UserPlus } from 'lucide-react';
import { useAppStore, useUIActions } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { SyncStatusIndicator } from '../SyncStatusIndicator';
import { UserMenu } from './UserMenu';
import { AuthContainer } from '../auth/AuthContainer';
import { authClient } from '@/api/authClient';

export function Header() {
  const { tasks, isProcessing, userTasks, clearUserData } = useAppStore();
  const { toggleTaskListVisible } = useUIActions();
  
  // Use real auth state from store
  const { user, isAuthenticated, logout: clearAuthData } = useAuthStore();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  // Real task stats based on user's tasks
  const currentTasks = isAuthenticated ? userTasks : tasks;
  const taskStats = {
    total: currentTasks.length,
    completed: currentTasks.filter(t => t.status === 'completed').length,
    processing: currentTasks.filter(t => t.status === 'processing').length
  };
  
  const handleLogin = () => {
    setAuthMode('login');
    setAuthModalOpen(true);
  };
  
  const handleRegister = () => {
    setAuthMode('register');
    setAuthModalOpen(true);
  };
  
  const handleLoginSuccess = (data: any) => {
    console.log('Login success:', data);
    // Auth state is already updated in AuthContainer
  };
  
  const handleRegisterSuccess = (data: any) => {
    console.log('Register success:', data);
    // Auth state is already updated in AuthContainer
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
  
  const handleProfileClick = () => {
    console.log('Navigate to profile');
    // TODO: Navigate to profile page
  };
  
  const handleSettingsClick = () => {
    console.log('Navigate to settings');
    // TODO: Navigate to settings page
  };
  
  const handleTasksClick = () => {
    console.log('Navigate to tasks');
    // TODO: Navigate to tasks page
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
            <Badge 
              variant="secondary" 
              className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors"
              onClick={toggleTaskListVisible}
              title="点击切换任务列表显示"
            >
              {tasks.length} 个任务
            </Badge>
          </div>

          <div className="flex items-center space-x-2">
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
                onProfileClick={handleProfileClick}
                onSettingsClick={handleSettingsClick}
                onTasksClick={handleTasksClick}
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
      
      {/* Auth Modal */}
      <AuthContainer
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authMode}
        onLoginSuccess={handleLoginSuccess}
        onRegisterSuccess={handleRegisterSuccess}
      />
    </>
  );
}
