import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

// Validation schema
const loginSchema = z.object({
  emailOrUsername: z.string()
    .min(1, '请输入邮箱或用户名')
    .refine((val) => {
      // Check if it's an email or username (min 3 chars)
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
      const isUsername = val.length >= 3;
      return isEmail || isUsername;
    }, '请输入有效的邮箱或用户名'),
  password: z.string()
    .min(8, '密码至少需要8个字符')
    .max(128, '密码不能超过128个字符')
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onSubmit: (data: LoginFormData) => Promise<void>;
  onRegisterClick?: () => void;
  error?: string | null;
}

export function LoginForm({ 
  onSubmit, 
  onRegisterClick,
  error 
}: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError: setFormError
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema)
  });

  const handleFormSubmit = async (data: LoginFormData) => {
    try {
      setIsLoading(true);
      await onSubmit(data);
    } catch (err: any) {
      // Handle specific error cases
      if (err.message?.includes('credentials')) {
        setFormError('emailOrUsername', { message: '用户名或密码错误' });
        setFormError('password', { message: '用户名或密码错误' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">登录</CardTitle>
        <CardDescription className="text-center">
          输入您的账号信息以登录 MonkeyOCR
        </CardDescription>
      </CardHeader>
      
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <CardContent className="space-y-4">
          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Email or Username Field */}
          <div className="space-y-2">
            <Label htmlFor="emailOrUsername">邮箱或用户名</Label>
            <Input
              id="emailOrUsername"
              type="text"
              placeholder="请输入邮箱或用户名"
              autoComplete="username"
              disabled={isLoading}
              {...register('emailOrUsername')}
              className={errors.emailOrUsername ? 'border-red-500' : ''}
            />
            {errors.emailOrUsername && (
              <p className="text-sm text-red-500">{errors.emailOrUsername.message}</p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="请输入密码"
                autoComplete="current-password"
                disabled={isLoading}
                {...register('password')}
                className={errors.password ? 'border-red-500 pr-10' : 'pr-10'}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>

        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                登录中...
              </>
            ) : (
              '登录'
            )}
          </Button>

          {/* Register Link */}
          <div className="text-center text-sm">
            还没有账号？{' '}
            <button
              type="button"
              className="text-primary hover:underline font-medium"
              onClick={onRegisterClick}
              disabled={isLoading}
            >
              立即注册
            </button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}