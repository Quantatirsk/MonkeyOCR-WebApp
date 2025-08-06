/**
 * Hover Tools Menu Component
 * Displays translate and explain options when hovering over markdown blocks
 */
import React, { useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Languages, HelpCircle, X } from 'lucide-react';
import { HoverToolsMenuProps } from '../../types/translation';

export const HoverToolsMenu: React.FC<HoverToolsMenuProps> = ({
  blockId,
  content,
  visible,
  position,
  onTranslate,
  onExplain,
  onClose
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [visible, onClose]);

  // Close menu on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [visible, onClose]);

  if (!visible) return null;

  // Calculate menu position to avoid viewport overflow
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 200), // Prevent horizontal overflow
    top: Math.min(position.y, window.innerHeight - 80),  // Prevent vertical overflow
    zIndex: 1000,
    opacity: visible ? 1 : 0,
    transition: 'opacity 0.2s ease-in-out'
  };

  const handleTranslate = () => {
    onTranslate(blockId, content);
    onClose();
  };

  const handleExplain = () => {
    onExplain(blockId, content);
    onClose();
  };

  return (
    <Card
      ref={menuRef}
      style={menuStyle}
      className="p-2 shadow-lg border bg-white/95 backdrop-blur-sm dark:bg-gray-800/95 min-w-[160px]"
    >
      <div className="flex flex-col gap-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Tools
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={onClose}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        {/* Translate Button */}
        <Button
          variant="ghost"
          size="sm"
          className="justify-start h-8 px-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20"
          onClick={handleTranslate}
        >
          <Languages className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
          <span>Translate</span>
        </Button>

        {/* Explain Button */}
        <Button
          variant="ghost"
          size="sm"
          className="justify-start h-8 px-2 text-sm hover:bg-green-50 dark:hover:bg-green-900/20"
          onClick={handleExplain}
        >
          <HelpCircle className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" />
          <span>Explain</span>
        </Button>
      </div>

      {/* Content Preview */}
      {content.length > 50 && (
        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            "{content.substring(0, 50)}..."
          </p>
        </div>
      )}
    </Card>
  );
};