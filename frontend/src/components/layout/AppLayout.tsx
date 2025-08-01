
import { Toaster } from '@/components/ui/toaster';
import { Header } from './Header';
import { MainContent } from './MainContent';
import { OfflineIndicator } from '../OfflineIndicator';

export function AppLayout() {
  return (
    <div className="h-screen bg-background flex flex-col">
      <Header />
      <OfflineIndicator />
      <MainContent />
      <Toaster />
    </div>
  );
}
