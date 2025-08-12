/**
 * Translation Progress Component
 * Shows a mini progress bar for batch translation operations
 */

import React from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface TranslationProgressProps {
  isActive: boolean;
  current: number;
  total: number;
  className?: string;
}

export const TranslationProgress: React.FC<TranslationProgressProps> = ({
  isActive,
  current,
  total,
  className
}) => {
  if (!isActive) return null;

  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  
  return (
    <div className={cn(
      "inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border",
      className
    )}>
      {percentage < 100 ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      ) : (
        <Languages className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      
      <Progress 
        value={percentage} 
        className="h-1.5 w-20"
      />
      
      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
        {percentage}%
      </span>
    </div>
  );
};