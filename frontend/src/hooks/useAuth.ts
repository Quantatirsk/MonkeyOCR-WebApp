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
          id: response.user.id || 0,
          username: response.user.username,
          email: response.user.email,
          isVerified: response.user.is_verified || true,
          isActive: response.user.is_active || true,
        },
        response.token
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
          id: response.user.id || 0,
          username: response.user.username,
          email: response.user.email,
          isVerified: response.user.is_verified || true,
          isActive: response.user.is_active || true,
        },
        response.token
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
      const token = useAuthStore.getState().token;
      if (!token) {
        return false;
      }
      
      // Verify token is still valid
      const result = await authClient.validateToken();
      
      if (result.valid && result.user) {
        // Update user data
        setAuthData(
          {
            id: result.user.id,
            username: result.user.username,
            email: result.user.email,
            isVerified: true,
            isActive: true,
          },
          token
        );
        return true;
      }
      
      // Token invalid
      clearAuthData();
      return false;
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
 * Hook to renew token
 */
export function useTokenRenewal() {
  const { token, setToken } = useAuthStore();
  
  const renewToken = useCallback(async () => {
    if (!token) {
      throw new Error('No token available');
    }
    
    try {
      const response = await authClient.renewToken();
      setToken(response.token);
      return response;
    } catch (err) {
      // Clear auth on renewal failure
      useAuthStore.getState().logout();
      throw err;
    }
  }, [token, setToken]);
  
  return renewToken;
}