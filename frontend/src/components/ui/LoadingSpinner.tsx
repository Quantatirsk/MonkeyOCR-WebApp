/**
 * LoadingSpinner Component
 * Reusable loading spinner with various sizes and styles
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'primary' | 'muted';
  className?: string;
  label?: string;
  overlay?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'default',
  className,
  label,
  overlay = false
}) => {
  // Size classes
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8'
  };

  // Variant classes
  const variantClasses = {
    default: 'text-foreground',
    primary: 'text-primary',
    muted: 'text-muted-foreground'
  };

  const spinner = (
    <div className={cn(
      'flex items-center space-x-2',
      overlay && 'absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50',
      className
    )}>
      <Loader2 
        className={cn(
          'animate-spin',
          sizeClasses[size],
          variantClasses[variant]
        )} 
      />
      {label && (
        <span className={cn(
          'text-sm',
          variantClasses[variant]
        )}>
          {label}
        </span>
      )}
    </div>
  );

  return spinner;
};

// Predefined loading states
export const LoadingState = {
  Small: (props?: Partial<LoadingSpinnerProps>) => (
    <LoadingSpinner size="sm" variant="muted" {...props} />
  ),
  
  Default: (props?: Partial<LoadingSpinnerProps>) => (
    <LoadingSpinner {...props} />
  ),
  
  Large: (props?: Partial<LoadingSpinnerProps>) => (
    <LoadingSpinner size="lg" {...props} />
  ),
  
  Overlay: (props?: Partial<LoadingSpinnerProps>) => (
    <LoadingSpinner overlay {...props} />
  ),
  
  WithLabel: (label: string, props?: Partial<LoadingSpinnerProps>) => (
    <LoadingSpinner label={label} {...props} />
  )
};

export default LoadingSpinner;