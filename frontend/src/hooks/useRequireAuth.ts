/**
 * Hook to protect routes that require authentication
 */

import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface UseRequireAuthOptions {
  redirectTo?: string;
  fallback?: React.ReactNode;
}

/**
 * Hook that checks if user is authenticated and redirects if not
 * @param options - Configuration options
 * @returns Authentication status and loading state
 */
export function useRequireAuth(options: UseRequireAuthOptions = {}) {
  const { redirectTo = '/login' } = options;
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    // Check if we have valid auth
    if (!isAuthenticated && !isLoading) {
      // Save the attempted location for redirect after login
      const from = location.pathname + location.search;
      navigate(redirectTo, { 
        replace: true,
        state: { from }
      });
    }
  }, [isAuthenticated, isLoading, navigate, redirectTo, location]);

  // Also check auth validity on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return {
    isAuthenticated,
    isLoading,
  };
}