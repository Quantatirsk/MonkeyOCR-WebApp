
import { Badge } from '@/components/ui/badge';
import { useAppStore, useUIActions } from '@/store/appStore';
import { SyncStatusIndicator } from '../SyncStatusIndicator';

export function Header() {
  const { tasks, isProcessing } = useAppStore();
  const { toggleTaskListVisible } = useUIActions();

  return (
    <header className="h-12 border-b bg-background" style={{ height: '48px', minHeight: '48px', maxHeight: '48px' }}>
      <div className="h-full px-4 flex items-center justify-between" style={{ height: '48px' }}>
        <div className="flex items-center space-x-3">
          <h1 className="text-lg font-semibold" style={{ lineHeight: '1', fontSize: '18px' }}>MonkeyOCR</h1>
          <Badge variant="default" className="text-xs">
            v1.0
          </Badge>
          <Badge 
            variant="secondary" 
            className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors"
            onClick={toggleTaskListVisible}
            title="点击切换任务列表显示"
          >
            {tasks.length} 个任务
          </Badge>
        </div>

        <div className="flex items-center space-x-2">
          <SyncStatusIndicator compact={true} />
          {isProcessing && (
            <Badge variant="secondary" className="animate-pulse text-xs">
              处理中...
            </Badge>
          )}
        </div>
      </div>
    </header>
  );
}
