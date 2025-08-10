import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

// Password strength calculation
function calculatePasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  
  // Length check
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 20;
  
  // Character type checks
  if (/[a-z]/.test(password)) score += 15;
  if (/[A-Z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^A-Za-z0-9]/.test(password)) score += 15;
  
  // Determine label and color
  if (score < 30) return { score, label: '弱', color: 'bg-red-500' };
  if (score < 50) return { score, label: '一般', color: 'bg-orange-500' };
  if (score < 70) return { score, label: '中等', color: 'bg-yellow-500' };
  if (score < 90) return { score, label: '强', color: 'bg-green-500' };
  return { score: 100, label: '很强', color: 'bg-green-600' };
}

// Validation schema
const registerSchema = z.object({
  username: z.string()
    .min(3, '用户名至少需要3个字符')
    .max(50, '用户名不能超过50个字符')
    .regex(/^[a-zA-Z0-9_-]+$/, '用户名只能包含字母、数字、下划线和连字符'),
  email: z.string()
    .email('请输入有效的邮箱地址'),
  password: z.string()
    .min(8, '密码至少需要8个字符')
    .max(128, '密码不能超过128个字符')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, '密码必须包含大小写字母和数字'),
  confirmPassword: z.string(),
  acceptTerms: z.boolean().refine(val => val === true, {
    message: '请阅读并同意服务条款'
  })
}).refine((data) => data.password === data.confirmPassword, {
  message: "两次输入的密码不一致",
  path: ["confirmPassword"]
});

type RegisterFormData = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  onSubmit: (data: Omit<RegisterFormData, 'confirmPassword' | 'acceptTerms'>) => Promise<void>;
  onLoginClick?: () => void;
  error?: string | null;
}

export function RegisterForm({ 
  onSubmit, 
  onLoginClick,
  error 
}: RegisterFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState('');

  const passwordStrength = calculatePasswordStrength(password);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError: setFormError,
    watch
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema)
  });

  // Watch password field for strength indicator
  const watchedPassword = watch('password', '');
  if (watchedPassword !== password) {
    setPassword(watchedPassword);
  }

  const handleFormSubmit = async (data: RegisterFormData) => {
    try {
      setIsLoading(true);
      const { confirmPassword, acceptTerms, ...submitData } = data;
      await onSubmit(submitData);
    } catch (err: any) {
      // Handle specific error cases
      if (err.message?.includes('username')) {
        setFormError('username', { message: '该用户名已被使用' });
      } else if (err.message?.includes('email')) {
        setFormError('email', { message: '该邮箱已被注册' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">注册</CardTitle>
        <CardDescription className="text-center">
          创建您的 MonkeyOCR 账号
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

          {/* Username Field */}
          <div className="space-y-2">
            <Label htmlFor="username">用户名</Label>
            <Input
              id="username"
              type="text"
              placeholder="请输入用户名"
              autoComplete="username"
              disabled={isLoading}
              {...register('username')}
              className={errors.username ? 'border-red-500' : ''}
            />
            {errors.username && (
              <p className="text-sm text-red-500">{errors.username.message}</p>
            )}
            <p className="text-xs text-gray-500">3-50个字符，只能包含字母、数字、下划线和连字符</p>
          </div>

          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              placeholder="请输入邮箱地址"
              autoComplete="email"
              disabled={isLoading}
              {...register('email')}
              className={errors.email ? 'border-red-500' : ''}
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
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
                autoComplete="new-password"
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
            
            {/* Password Strength Indicator */}
            {password && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span>密码强度</span>
                  <span className="font-medium">{passwordStrength.label}</span>
                </div>
                <Progress value={passwordStrength.score} className="h-2" />
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <div className="flex items-center space-x-1">
                    {password.length >= 8 ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <X className="h-3 w-3 text-gray-300" />
                    )}
                    <span>8个字符</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {/[A-Z]/.test(password) && /[a-z]/.test(password) ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <X className="h-3 w-3 text-gray-300" />
                    )}
                    <span>大小写</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {/[0-9]/.test(password) ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <X className="h-3 w-3 text-gray-300" />
                    )}
                    <span>数字</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">确认密码</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="请再次输入密码"
                autoComplete="new-password"
                disabled={isLoading}
                {...register('confirmPassword')}
                className={errors.confirmPassword ? 'border-red-500 pr-10' : 'pr-10'}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isLoading}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
            )}
          </div>

          {/* Terms Checkbox */}
          <div className="flex items-start space-x-2">
            <Checkbox
              id="acceptTerms"
              disabled={isLoading}
              {...register('acceptTerms')}
              className="mt-1"
            />
            <div className="space-y-1">
              <Label
                htmlFor="acceptTerms"
                className="text-sm font-normal cursor-pointer"
              >
                我已阅读并同意{' '}
                <a href="#" className="text-primary hover:underline">
                  服务条款
                </a>
                {' '}和{' '}
                <a href="#" className="text-primary hover:underline">
                  隐私政策
                </a>
              </Label>
              {errors.acceptTerms && (
                <p className="text-sm text-red-500">{errors.acceptTerms.message}</p>
              )}
            </div>
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
                注册中...
              </>
            ) : (
              '注册'
            )}
          </Button>

          {/* Login Link */}
          <div className="text-center text-sm">
            已有账号？{' '}
            <button
              type="button"
              className="text-primary hover:underline font-medium"
              onClick={onLoginClick}
              disabled={isLoading}
            >
              立即登录
            </button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}