/**
 * ThemeToggle Component
 * Theme switcher with light, dark, and system options
 */

import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useTheme } from './ThemeProvider';

interface ThemeToggleProps {
  variant?: 'button' | 'icon' | 'dropdown';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = 'dropdown',
  size = 'md',
  className = '',
  showLabel = false
}) => {
  const { theme, setTheme, effectiveTheme } = useTheme();

  // Size classes
  const sizeClasses = {
    sm: 'h-7 w-7',
    md: 'h-8 w-8',
    lg: 'h-10 w-10'
  };

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  // Get current theme icon
  const getCurrentIcon = () => {
    const iconClass = iconSizeClasses[size];
    
    if (theme === 'system') {
      return <Monitor className={iconClass} />;
    }
    
    return effectiveTheme === 'dark' ? 
      <Moon className={iconClass} /> : 
      <Sun className={iconClass} />;
  };

  // Get theme label
  const getThemeLabel = (themeValue: string) => {
    switch (themeValue) {
      case 'light':
        return '浅色';
      case 'dark':
        return '深色';
      case 'system':
        return '跟随系统';
      default:
        return themeValue;
    }
  };

  // Simple button variant (cycles through themes)
  if (variant === 'button') {
    const handleClick = () => {
      const themes = ['light', 'dark', 'system'] as const;
      const currentIndex = themes.indexOf(theme);
      const nextIndex = (currentIndex + 1) % themes.length;
      setTheme(themes[nextIndex]);
    };

    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        className={`${sizeClasses[size]} p-0 ${className}`}
        title={`当前: ${getThemeLabel(theme)}`}
      >
        {getCurrentIcon()}
        {showLabel && (
          <span className="ml-2 text-xs">{getThemeLabel(theme)}</span>
        )}
      </Button>
    );
  }

  // Icon-only variant (cycles through themes)
  if (variant === 'icon') {
    const handleClick = () => {
      const themes = ['light', 'dark', 'system'] as const;
      const currentIndex = themes.indexOf(theme);
      const nextIndex = (currentIndex + 1) % themes.length;
      setTheme(themes[nextIndex]);
    };

    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        className={`${sizeClasses[size]} p-0 ${className}`}
        title={`切换主题 (当前: ${getThemeLabel(theme)})`}
      >
        {getCurrentIcon()}
      </Button>
    );
  }

  // Dropdown variant (shows all options)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`${sizeClasses[size]} p-0 ${className}`}
          title="切换主题"
        >
          {getCurrentIcon()}
          {showLabel && (
            <span className="ml-2 text-xs">{getThemeLabel(theme)}</span>
          )}
          <span className="sr-only">切换主题</span>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="min-w-32">
        <DropdownMenuItem 
          onClick={() => setTheme('light')}
          className="flex items-center space-x-2"
        >
          <Sun className="w-3 h-3" />
          <span className="text-xs">浅色</span>
          {theme === 'light' && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => setTheme('dark')}
          className="flex items-center space-x-2"
        >
          <Moon className="w-3 h-3" />
          <span className="text-xs">深色</span>
          {theme === 'dark' && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => setTheme('system')}
          className="flex items-center space-x-2"
        >
          <Monitor className="w-3 h-3" />
          <span className="text-xs">跟随系统</span>
          {theme === 'system' && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ThemeToggle;