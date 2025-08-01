/**
 * StatusBadge Component
 * Enhanced badge component for displaying various statuses with consistent styling
 */

import React from 'react';
import { Badge, BadgeProps } from './badge';
import { CheckCircle, AlertCircle, Clock, Loader2, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'warning' | 'info';
  showIcon?: boolean;
  animate?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  showIcon = true,
  animate = true,
  size = 'md',
  className,
  children,
  ...props
}) => {
  // Status configuration mapping
  const statusConfig = {
    pending: {
      variant: 'secondary' as const,
      icon: Clock,
      color: 'text-muted-foreground',
      label: '等待中'
    },
    processing: {
      variant: 'default' as const,
      icon: Loader2,
      color: 'text-primary',
      label: '处理中',
      shouldSpin: true
    },
    completed: {
      variant: 'default' as const,
      icon: CheckCircle,
      color: 'text-green-600',
      label: '已完成'
    },
    failed: {
      variant: 'destructive' as const,
      icon: XCircle,
      color: 'text-destructive',
      label: '失败'
    },
    warning: {
      variant: 'secondary' as const,
      icon: AlertCircle,
      color: 'text-orange-600',
      label: '警告'
    },
    info: {
      variant: 'outline' as const,
      icon: AlertCircle,
      color: 'text-blue-600',
      label: '信息'
    }
  };

  // Size classes
  const sizeClasses = {
    sm: {
      badge: 'text-xs px-1.5 py-0.5',
      icon: 'w-2.5 h-2.5'
    },
    md: {
      badge: 'text-xs px-2 py-0.5',
      icon: 'w-3 h-3'
    },
    lg: {
      badge: 'text-sm px-3 py-1',
      icon: 'w-4 h-4'
    }
  };

  const config = statusConfig[status];
  const sizeClass = sizeClasses[size];
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn(
        'flex items-center space-x-1',
        sizeClass.badge,
        animate && status === 'processing' && 'animate-pulse',
        className
      )}
      {...props}
    >
      {showIcon && (
        <Icon 
          className={cn(
            sizeClass.icon,
            config.color,
            config.shouldSpin && animate && 'animate-spin'
          )} 
        />
      )}
      <span>{children || config.label}</span>
    </Badge>
  );
};

export default StatusBadge;