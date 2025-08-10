/**
 * FloatingActionBar Component
 * A tiny, elegant floating button group for the compare view
 * Provides quick access to fullscreen, translate, and explain functions
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Maximize2, Minimize2, Languages, MessageSquare } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FloatingActionBarProps {
  onTranslate?: () => void;
  onExplain?: () => void;
  visible?: boolean;
  className?: string;
}

export const FloatingActionBar: React.FC<FloatingActionBarProps> = React.memo(({
  onTranslate,
  onExplain,
  visible = true,
  className = ""
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Handle fullscreen toggle
  const handleFullscreen = useCallback(() => {
    const element = document.querySelector('.document-viewer-container');
    
    if (!element) {
      toast.error('无法进入全屏模式');
      return;
    }

    if (!document.fullscreenElement) {
      element.requestFullscreen().then(() => {
        setIsFullscreen(true);
        // Ensure theme classes are applied to fullscreen element
        element.classList.add('bg-background', 'text-foreground');
        toast.success('已进入全屏模式', { duration: 1000 });
      }).catch((err) => {
        toast.error(`全屏失败: ${err.message}`);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
        toast.success('已退出全屏模式', { duration: 1000 });
      });
    }
  }, []);

  // Handle translate action
  const handleTranslate = useCallback(() => {
    if (onTranslate) {
      onTranslate();
      toast.info('正在翻译内容...', { duration: 1000 });
    }
  }, [onTranslate]);

  // Handle explain action
  const handleExplain = useCallback(() => {
    if (onExplain) {
      onExplain();
      toast.info('正在生成解释...', { duration: 1000 });
    }
  }, [onExplain]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if input is focused
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      // F11 or F for fullscreen
      if (e.key === 'F11' || (e.key === 'f' && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault();
        handleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleFullscreen]);

  if (!visible) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <div 
        className={cn(
          "absolute bottom-6 left-1/2 -translate-x-1/2 z-50",
          "flex items-center gap-0.5 p-1",
          "bg-background/95 backdrop-blur-sm",
          "border border-border rounded-2xl",
          "shadow-lg",
          "transition-all duration-300 ease-in-out",
          "hover:shadow-xl",
          className
        )}
        style={{
          animation: visible ? 'fadeInUp 0.3s ease-out' : 'fadeOutDown 0.3s ease-out'
        }}
      >
        {/* Fullscreen Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFullscreen}
              className="h-6 w-6 p-0 rounded-lg hover:bg-accent"
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {isFullscreen ? '退出全屏 (F)' : '全屏 (F)'}
          </TooltipContent>
        </Tooltip>

        {/* Separator */}
        <div className="w-px h-4 bg-border mx-0.5" />

        {/* Translate Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTranslate}
              className="h-6 w-6 p-0 rounded-lg hover:bg-accent"
              disabled={!onTranslate}
            >
              <Languages className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            翻译 (N)
          </TooltipContent>
        </Tooltip>

        {/* Explain Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExplain}
              className="h-6 w-6 p-0 rounded-lg hover:bg-accent"
              disabled={!onExplain}
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            解释 (M)
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Add CSS animations */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translate(-50%, 20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }

        @keyframes fadeOutDown {
          from {
            opacity: 1;
            transform: translate(-50%, 0);
          }
          to {
            opacity: 0;
            transform: translate(-50%, 20px);
          }
        }
      `}</style>
    </TooltipProvider>
  );
});

FloatingActionBar.displayName = 'FloatingActionBar';