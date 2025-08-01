
import { Toaster } from '@/components/ui/toaster';
import { Header } from './Header';
import { MainContent } from './MainContent';

export function AppLayout() {
  return (
    <div className="h-screen bg-background flex flex-col">
      <Header />
      <MainContent />
      <Toaster />
    </div>
  );
}
