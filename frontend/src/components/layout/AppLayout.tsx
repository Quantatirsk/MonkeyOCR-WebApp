
import { useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { Header } from './Header';
import { MainContent } from './MainContent';
import { OfflineIndicator } from '../OfflineIndicator';
import { AuthPage } from '../auth/AuthPage';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';

export function AppLayout() {
  const theme = useAppStore(state => state.theme);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const [showAuthPage, setShowAuthPage] = useState(false);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  
  // Check authentication status on mount
  useEffect(() => {
    if (!hasCheckedAuth) {
      // Give a small delay to allow auth state to be restored from localStorage
      const timer = setTimeout(() => {
        if (!isAuthenticated) {
          setShowAuthPage(true);
        }
        setHasCheckedAuth(true);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, hasCheckedAuth]);
  
  // Apply theme to document element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);
  
  // Show auth page if not authenticated on first load
  if (showAuthPage) {
    return (
      <>
        <AuthPage 
          onClose={() => {
            // Only allow closing if user is authenticated
            if (isAuthenticated) {
              setShowAuthPage(false);
            }
          }}
          onSuccess={() => setShowAuthPage(false)}
        />
        <Toaster />
      </>
    );
  }
  
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
