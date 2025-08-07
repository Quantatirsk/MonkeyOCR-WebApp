
// import { Toaster } from '@/components/ui/toaster';  // 使用 sonner 替代
import { Toaster } from 'sonner';
import { Header } from './Header';
import { MainContent } from './MainContent';
import { OfflineIndicator } from '../OfflineIndicator';

export function AppLayout() {
  return (
    <div className="h-screen bg-background flex flex-col">
      <div style={{ flexShrink: 0, height: '48px' }}>
        <Header />
      </div>
      <OfflineIndicator />
      <div className="flex-1 min-h-0">
        <MainContent />
      </div>
      <Toaster 
        duration={1000}  // 全局设置显示时间为 1 秒
        position="bottom-right"
        richColors
        closeButton
      />
    </div>
  );
}
