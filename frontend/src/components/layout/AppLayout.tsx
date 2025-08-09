
import { Toaster } from '@/components/ui/sonner';
import { Header } from './Header';
import { MainContent } from './MainContent';
import { OfflineIndicator } from '../OfflineIndicator';

export function AppLayout() {
  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <div style={{ flexShrink: 0, height: '48px' }}>
        <Header />
      </div>
      <OfflineIndicator />
      <div className="flex-1 min-h-0 overflow-hidden">
        <MainContent />
      </div>
      <Toaster />
    </div>
  );
}
