
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store/appStore';

export function Header() {
  const { tasks, isProcessing } = useAppStore();

  return (
    <header className="h-12 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="h-full px-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h1 className="text-lg font-semibold">MonkeyOCR</h1>
          <Badge variant="default" className="text-xs">
            v1.0
          </Badge>
        </div>

        <div className="flex items-center space-x-2">
          {isProcessing && (
            <Badge variant="secondary" className="animate-pulse text-xs">
              处理中...
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs">
            {tasks.length} 个任务
          </Badge>
        </div>
      </div>
    </header>
  );
}
