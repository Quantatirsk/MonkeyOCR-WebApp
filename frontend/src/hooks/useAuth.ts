/**
 * Authentication hooks for React components
 */

import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { authClient } from '../api/authClient';
import type { LoginRequest, RegisterRequest } from '../api/authClient';

/**
 * Main auth hook that provides auth state and actions
 */
export function useAuth() {
  const navigate = useNavigate();
  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    login: setAuthData,
    logout: clearAuthData,
    setLoading,
    setError,
    clearError,
  } = useAuthStore();
  
  const { clearUserData } = useAppStore();

  // Login action
  const login = useCallback(async (data: LoginRequest) => {
    try {
      setLoading(true);
      clearError();
      
      const response = await authClient.login(data);
      
      // Store auth data
      setAuthData(
        {
          id: response.user.id,
          username: response.user.username,
          email: response.user.email,
          isVerified: response.user.is_verified,
          isActive: response.user.is_active,
        },
        {
          accessToken: response.tokens.access_token,
          refreshToken: response.tokens.refresh_token,
          tokenType: response.tokens.token_type,
        }
      );
      
      // Navigate to dashboard
      navigate('/dashboard');
      
      return response;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || '登录失败';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [setLoading, clearError, setAuthData, navigate, setError]);

  // Register action
  const register = useCallback(async (data: RegisterRequest) => {
    try {
      setLoading(true);
      clearError();
      
      const response = await authClient.register(data);
      
      // Store auth data
      setAuthData(
        {
          id: response.user.id,
          username: response.user.username,
          email: response.user.email,
          isVerified: response.user.is_verified,
          isActive: response.user.is_active,
        },
        {
          accessToken: response.tokens.access_token,
          refreshToken: response.tokens.refresh_token,
          tokenType: response.tokens.token_type,
        }
      );
      
      return response;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || '注册失败';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [setLoading, clearError, setAuthData, setError]);

  // Logout action
  const logout = useCallback(async () => {
    try {
      setLoading(true);
      
      // Call logout API
      await authClient.logout();
      
      // Clear auth data
      clearAuthData();
      
      // Clear user's tasks
      clearUserData();
      
      // Navigate to landing page
      navigate('/');
    } catch (err) {
      // Ignore logout errors
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
      // Always clear data even if API call fails
      clearAuthData();
      clearUserData();
    }
  }, [setLoading, clearAuthData, clearUserData, navigate]);

  // Check auth on mount
  const checkAuth = useCallback(async () => {
    try {
      const tokens = useAuthStore.getState().tokens;
      if (!tokens?.accessToken) {
        return false;
      }
      
      // Verify token is still valid
      const profile = await authClient.getCurrentUser();
      
      // Update user data
      setAuthData(
        {
          id: profile.id,
          username: profile.username,
          email: profile.email,
          isVerified: profile.is_verified,
          isActive: profile.is_active,
        },
        tokens
      );
      
      return true;
    } catch (err) {
      // Token invalid, clear auth
      clearAuthData();
      return false;
    }
  }, [setAuthData, clearAuthData]);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    checkAuth,
    clearError,
  };
}

/**
 * Hook to require authentication for a component
 * Redirects to login if not authenticated
 */
export function useRequireAuth(redirectTo = '/login') {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuthStore();
  const { checkAuth } = useAuth();

  useEffect(() => {
    const verifyAuth = async () => {
      const isValid = await checkAuth();
      if (!isValid && !isLoading) {
        navigate(redirectTo);
      }
    };
    
    verifyAuth();
  }, [checkAuth, isAuthenticated, isLoading, navigate, redirectTo]);

  return { isAuthenticated, isLoading };
}

/**
 * Hook to get current user data
 */
export function useUser() {
  return useAuthStore((state) => state.user);
}

/**
 * Hook to handle logout
 */
export function useLogout() {
  const { logout } = useAuth();
  return logout;
}

/**
 * Hook to refresh tokens
 */
export function useTokenRefresh() {
  const { tokens, setTokens } = useAuthStore();
  
  const refreshTokens = useCallback(async () => {
    if (!tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }
    
    try {
      const refreshed = await authClient.refreshTokens(tokens.refreshToken);
      
      setTokens({
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        tokenType: refreshed.token_type,
      });
      
      return refreshed;
    } catch (err) {
      // Clear auth on refresh failure
      useAuthStore.getState().logout();
      throw err;
    }
  }, [tokens, setTokens]);
  
  return refreshTokens;
}