/**
 * TabNavigation Component
 * Handles document viewer tab navigation
 */

import React from 'react';
import { ArrowLeftRight, Image, Eye, Languages } from 'lucide-react';
import { TAB_TYPES, type TabType } from './constants';

interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  hasResult: boolean;
  isCompleted: boolean;
  imageCount?: number;
}

const TAB_ICONS = {
  [TAB_TYPES.COMPARE]: ArrowLeftRight,
  [TAB_TYPES.TRANSLATION]: Languages,
  [TAB_TYPES.IMAGES]: Image,
  [TAB_TYPES.METADATA]: Eye
};

const TAB_LABELS = {
  [TAB_TYPES.COMPARE]: '对照',
  [TAB_TYPES.TRANSLATION]: '翻译',
  [TAB_TYPES.IMAGES]: '图片',
  [TAB_TYPES.METADATA]: '详情'
};

export const TabNavigation: React.FC<TabNavigationProps> = React.memo(({
  activeTab,
  onTabChange,
  hasResult,
  isCompleted,
  imageCount = 0
}) => {
  const tabs = Object.values(TAB_TYPES);

  const isTabDisabled = (_tab: TabType) => {
    return !hasResult;
  };

  return (
    <div className="border-b flex-shrink-0">
      <div className="grid w-full grid-cols-4 h-10">
        {tabs.map((tab) => {
          const Icon = TAB_ICONS[tab];
          const label = TAB_LABELS[tab];
          const disabled = isTabDisabled(tab);
          const isActive = activeTab === tab;

          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              disabled={disabled}
              className={`flex items-center justify-center space-x-1 text-xs transition-colors ${
                disabled
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              } ${
                isActive
                  ? 'bg-background text-foreground border-b-2 border-primary'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span>
                {label}
                {tab === TAB_TYPES.IMAGES && ` (${imageCount})`}
              </span>
              {isCompleted && hasResult && (
                <span className="text-xs text-green-500 ml-1">✓</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});