import { useState } from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { authClient } from '@/api/authClient';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';

type AuthMode = 'login' | 'register';

interface AuthContainerProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: AuthMode;
  onLoginSuccess?: (data: any) => void;
  onRegisterSuccess?: (data: any) => void;
}

export function AuthContainer({
  isOpen,
  onClose,
  initialMode = 'login',
  onLoginSuccess,
  onRegisterSuccess
}: AuthContainerProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [error, setError] = useState<string | null>(null);
  const { login: setAuthData } = useAuthStore();
  const { syncWithServer } = useAppStore();

  const handleLogin = async (data: any) => {
    try {
      setError(null);
      
      // Call real login API
      const response = await authClient.login({
        emailOrUsername: data.emailOrUsername,
        password: data.password
      });
      
      // Store auth data in state
      setAuthData(
        {
          id: response.user.id || 0,
          username: response.user.username,
          email: response.user.email,
          isVerified: response.user.is_verified || true,
          isActive: response.user.is_active || true
        },
        response.token
      );
      
      // Clear any existing tasks before syncing
      // This ensures we don't mix tasks from different users
      const appStore = useAppStore.getState();
      appStore.clearUserData();
      
      // Sync with server to get user's tasks
      // Use a longer delay to ensure auth state is fully propagated
      setTimeout(() => {
        syncWithServer().catch(err => {
          console.error('Failed to sync after login:', err);
        });
      }, 500);
      
      // Success
      onLoginSuccess?.(response);
      onClose();
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || '登录失败，请重试';
      setError(errorMessage);
      throw err;
    }
  };

  const handleRegister = async (data: any) => {
    try {
      setError(null);
      
      // Call real register API
      const response = await authClient.register({
        username: data.username,
        email: data.email,
        password: data.password
      });
      
      // Store auth data in state
      setAuthData(
        {
          id: response.user.id || 0,
          username: response.user.username,
          email: response.user.email,
          isVerified: response.user.is_verified || true,
          isActive: response.user.is_active || true
        },
        response.token
      );
      
      // Clear any existing tasks before syncing
      // This ensures we don't mix tasks from different users
      const appStore = useAppStore.getState();
      appStore.clearUserData();
      
      // Sync with server to get user's tasks (if any)
      // Use a longer delay to ensure auth state is fully propagated
      setTimeout(() => {
        syncWithServer().catch(err => {
          console.error('Failed to sync after registration:', err);
        });
      }, 500);
      
      // Success
      onRegisterSuccess?.(response);
      onClose();
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || '注册失败，请重试';
      setError(errorMessage);
      throw err;
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>
            {mode === 'login' ? '登录' : '注册'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="relative">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">关闭</span>
          </button>

          {/* Auth Forms */}
          <div className="p-6">
            <Tabs value={mode} onValueChange={(v) => setMode(v as AuthMode)}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">登录</TabsTrigger>
                <TabsTrigger value="register">注册</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login" className="mt-0">
                <LoginForm
                  onSubmit={handleLogin}
                  onRegisterClick={() => setMode('register')}
                  error={error}
                />
              </TabsContent>
              
              <TabsContent value="register" className="mt-0">
                <RegisterForm
                  onSubmit={handleRegister}
                  onLoginClick={() => setMode('login')}
                  error={error}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Standalone page version
interface AuthPageProps {
  initialMode?: AuthMode;
  onLoginSuccess?: (data: any) => void;
  onRegisterSuccess?: (data: any) => void;
}

export function AuthPage({
  initialMode = 'login',
  onLoginSuccess,
  onRegisterSuccess
}: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [error, setError] = useState<string | null>(null);
  const { login: setAuthData } = useAuthStore();

  const handleLogin = async (data: any) => {
    try {
      setError(null);
      
      // Call real login API
      const response = await authClient.login({
        emailOrUsername: data.emailOrUsername,
        password: data.password
      });
      
      // Store auth data in state
      setAuthData(
        {
          id: response.user.id || 0,
          username: response.user.username,
          email: response.user.email,
          isVerified: response.user.is_verified || true,
          isActive: response.user.is_active || true
        },
        response.token
      );
      
      // Success
      onLoginSuccess?.(response);
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || '登录失败，请重试';
      setError(errorMessage);
      throw err;
    }
  };

  const handleRegister = async (data: any) => {
    try {
      setError(null);
      
      // Call real register API
      const response = await authClient.register({
        username: data.username,
        email: data.email,
        password: data.password
      });
      
      // Store auth data in state
      setAuthData(
        {
          id: response.user.id || 0,
          username: response.user.username,
          email: response.user.email,
          isVerified: response.user.is_verified || true,
          isActive: response.user.is_active || true
        },
        response.token
      );
      
      // Success  
      onRegisterSuccess?.(response);
      setMode('login');
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || '注册失败，请重试';
      setError(errorMessage);
      throw err;
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">MonkeyOCR</h1>
          <p className="text-gray-600">智能文档识别与处理平台</p>
        </div>
        
        <Tabs value={mode} onValueChange={(v) => setMode(v as AuthMode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">登录</TabsTrigger>
            <TabsTrigger value="register">注册</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login">
            <LoginForm
              onSubmit={handleLogin}
              onRegisterClick={() => setMode('register')}
              error={error}
            />
          </TabsContent>
          
          <TabsContent value="register">
            <RegisterForm
              onSubmit={handleRegister}
              onLoginClick={() => setMode('login')}
              error={error}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}