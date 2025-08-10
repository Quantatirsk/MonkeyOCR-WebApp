
import { useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { Header } from './Header';
import { MainContent } from './MainContent';
import { OfflineIndicator } from '../OfflineIndicator';
import { useAppStore } from '@/store/appStore';

export function AppLayout() {
  const theme = useAppStore(state => state.theme);
  
  // Apply theme to document element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);
  
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
