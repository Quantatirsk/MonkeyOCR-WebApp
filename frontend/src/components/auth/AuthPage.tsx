import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Loader2, Sparkles, FileText, Zap, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authClient } from '@/api/authClient';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';

// Validation schemas
const loginSchema = z.object({
  emailOrUsername: z.string()
    .min(1, '请输入邮箱或用户名')
    .refine((val) => {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
      const isUsername = val.length >= 3;
      return isEmail || isUsername;
    }, '请输入有效的邮箱或用户名'),
  password: z.string()
    .min(8, '密码至少需要8个字符')
    .max(128, '密码不能超过128个字符')
});

const registerSchema = z.object({
  username: z.string()
    .min(3, '用户名至少需要3个字符')
    .max(50, '用户名不能超过50个字符')
    .regex(/^[a-zA-Z0-9_-]+$/, '用户名只能包含字母、数字、下划线和连字符'),
  email: z.string()
    .email('请输入有效的邮箱地址'),
  password: z.string()
    .min(8, '密码至少需要8个字符')
    .max(128, '密码不能超过128个字符'),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: '两次输入的密码不一致',
  path: ['confirmPassword']
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;
type AuthMode = 'login' | 'register';

interface AuthPageProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export function AuthPage({ onClose, onSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login: setAuthData } = useAuthStore();
  const { syncWithServer } = useAppStore();

  // Login form
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      emailOrUsername: '',
      password: ''
    }
  });

  // Register form  
  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: ''
    }
  });

  // Auto-fill demo credentials and submit
  const useDemoAccount = async () => {
    loginForm.setValue('emailOrUsername', 'demo');
    loginForm.setValue('password', 'demo123456');
    // Trigger form submission directly
    await handleLogin({
      emailOrUsername: 'demo',
      password: 'demo123456'
    });
  };

  // Handle login
  const handleLogin = async (data: LoginFormData) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await authClient.login({
        emailOrUsername: data.emailOrUsername,
        password: data.password
      });
      
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
      
      const appStore = useAppStore.getState();
      appStore.clearUserData();
      
      setTimeout(() => {
        syncWithServer().catch(err => {
          console.error('Failed to sync after login:', err);
        });
      }, 500);
      
      onSuccess?.();
      onClose();
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || '登录失败，请重试';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle register
  const handleRegister = async (data: RegisterFormData) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await authClient.register({
        username: data.username,
        email: data.email,
        password: data.password
      });
      
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
      
      const appStore = useAppStore.getState();
      appStore.clearUserData();
      
      setTimeout(() => {
        syncWithServer().catch(err => {
          console.error('Failed to sync after registration:', err);
        });
      }, 500);
      
      onSuccess?.();
      onClose();
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || '注册失败，请重试';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>

      {/* Brand Banner */}
      <div className="relative z-10 w-full bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-b">
        <div className="w-full">
          {/* 横幅图片容器 - 全宽显示 */}
          <div className="w-full">
            <img 
              src="/banner.png" 
              alt="MonkeyOCR Banner" 
              className="w-full h-auto object-cover max-h-32 md:max-h-40 lg:max-h-48"
              onError={(e) => {
                // 如果图片加载失败，显示文字标题
                e.currentTarget.style.display = 'none';
                const fallback = document.getElementById('banner-fallback');
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            {/* 图片加载失败时的后备显示 */}
            <div 
              id="banner-fallback" 
              className="hidden items-center justify-center py-8"
            >
              <div className="text-center">
                <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  MonkeyOCR
                </h1>
                <p className="mt-2 text-lg text-muted-foreground">
                  智能文档处理平台
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="relative flex flex-1 w-full max-w-6xl mx-auto items-start justify-center px-4 pt-4 md:pt-6 lg:pt-8">
        <div className="grid w-full gap-8 lg:grid-cols-2">
          {/* Left Side - Branding */}
          <div className="hidden flex-col justify-start space-y-6 lg:flex">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight">
                MonkeyOCR
              </h1>
              <p className="text-xl text-muted-foreground">
                智能文档处理，让工作更高效
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <FileText className="mt-1 h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-semibold">强大的 OCR 能力</h3>
                  <p className="text-sm text-muted-foreground">
                    支持多种文档格式，精准识别文字内容
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <Zap className="mt-1 h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-semibold">快速处理</h3>
                  <p className="text-sm text-muted-foreground">
                    高效的文档处理引擎，节省您的宝贵时间
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <Shield className="mt-1 h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-semibold">安全可靠</h3>
                  <p className="text-sm text-muted-foreground">
                    您的数据安全是我们的首要任务
                  </p>
                </div>
              </div>
            </div>

            {/* Demo Hint - More prominent */}
            <div className="rounded-lg border-2 border-primary/50 bg-gradient-to-r from-primary/10 to-primary/5 p-4 shadow-lg">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                <div>
                  <p className="font-bold text-base">🎉 免费试用</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    使用演示账号 <span className="font-mono font-bold text-primary">demo / demo123456</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    点击下方"一键试用演示账号"立即体验
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Auth Form */}
          <div className="flex items-start justify-center">
            <div className="w-full max-w-md space-y-4">
              {/* Demo Account Hint - Above form for mobile visibility */}
              <div className="lg:hidden mb-4 rounded-lg border-2 border-primary/50 bg-gradient-to-r from-primary/10 to-primary/5 p-3 shadow-lg">
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-5 w-5 text-primary animate-pulse flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-bold">🎉 免费试用</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      账号 <span className="font-mono font-bold text-primary">demo</span> / 
                      密码 <span className="font-mono font-bold text-primary">demo123456</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Card */}
              <div className="rounded-lg border bg-card p-6 shadow-lg">
                {/* Mode Tabs */}
                <div className="mb-4 flex rounded-lg bg-muted p-1">
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                      mode === 'login'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    登录
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                      mode === 'register'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    注册
                  </button>
                </div>

                {/* Error Alert */}
                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Forms */}
                <AnimatePresence mode="wait">
                  {mode === 'login' ? (
                    <motion.div
                      key="login"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="emailOrUsername">邮箱或用户名</Label>
                          <Input
                            id="emailOrUsername"
                            type="text"
                            placeholder="请输入邮箱或用户名"
                            disabled={isLoading}
                            {...loginForm.register('emailOrUsername')}
                            className={loginForm.formState.errors.emailOrUsername ? 'border-red-500' : ''}
                          />
                          {loginForm.formState.errors.emailOrUsername && (
                            <p className="text-sm text-red-500">
                              {loginForm.formState.errors.emailOrUsername.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="password">密码</Label>
                          <div className="relative">
                            <Input
                              id="password"
                              type={showPassword ? 'text' : 'password'}
                              placeholder="请输入密码"
                              disabled={isLoading}
                              {...loginForm.register('password')}
                              className={loginForm.formState.errors.password ? 'border-red-500' : ''}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          {loginForm.formState.errors.password && (
                            <p className="text-sm text-red-500">
                              {loginForm.formState.errors.password.message}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col space-y-3">
                          <Button type="submit" disabled={isLoading} className="w-full">
                            {isLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                登录中...
                              </>
                            ) : (
                              '登录'
                            )}
                          </Button>

                          {/* Demo Account Button - More prominent */}
                          <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 blur-xl" />
                            <Button
                              type="button"
                              variant="default"
                              onClick={useDemoAccount}
                              disabled={isLoading}
                              className="relative w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg"
                              size="lg"
                            >
                              <Sparkles className="mr-2 h-5 w-5 animate-pulse" />
                              <span className="font-bold">一键试用演示账号</span>
                            </Button>
                          </div>
                          
                          {/* Demo account info */}
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">
                              演示账号：<span className="font-mono font-semibold">demo</span> | 
                              密码：<span className="font-mono font-semibold">demo123456</span>
                            </p>
                          </div>
                        </div>
                      </form>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="register"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="username">用户名</Label>
                          <Input
                            id="username"
                            type="text"
                            placeholder="请输入用户名"
                            disabled={isLoading}
                            {...registerForm.register('username')}
                            className={registerForm.formState.errors.username ? 'border-red-500' : ''}
                          />
                          {registerForm.formState.errors.username && (
                            <p className="text-sm text-red-500">
                              {registerForm.formState.errors.username.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="email">邮箱</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="请输入邮箱"
                            disabled={isLoading}
                            {...registerForm.register('email')}
                            className={registerForm.formState.errors.email ? 'border-red-500' : ''}
                          />
                          {registerForm.formState.errors.email && (
                            <p className="text-sm text-red-500">
                              {registerForm.formState.errors.email.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="register-password">密码</Label>
                          <div className="relative">
                            <Input
                              id="register-password"
                              type={showPassword ? 'text' : 'password'}
                              placeholder="请输入密码"
                              disabled={isLoading}
                              {...registerForm.register('password')}
                              className={registerForm.formState.errors.password ? 'border-red-500' : ''}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          {registerForm.formState.errors.password && (
                            <p className="text-sm text-red-500">
                              {registerForm.formState.errors.password.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="confirmPassword">确认密码</Label>
                          <Input
                            id="confirmPassword"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="请再次输入密码"
                            disabled={isLoading}
                            {...registerForm.register('confirmPassword')}
                            className={registerForm.formState.errors.confirmPassword ? 'border-red-500' : ''}
                          />
                          {registerForm.formState.errors.confirmPassword && (
                            <p className="text-sm text-red-500">
                              {registerForm.formState.errors.confirmPassword.message}
                            </p>
                          )}
                        </div>

                        <Button type="submit" disabled={isLoading} className="w-full">
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              注册中...
                            </>
                          ) : (
                            '注册'
                          )}
                        </Button>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}