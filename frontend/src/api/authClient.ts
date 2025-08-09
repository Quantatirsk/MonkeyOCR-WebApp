/**
 * Authentication API client
 * Handles all authentication-related API calls
 */

import axios, { AxiosInstance } from 'axios';
import { APP_CONFIG } from '../config';
import { useAuthStore } from '../store/authStore';

// Types for auth API
interface LoginRequest {
  emailOrUsername: string;
  password: string;
  rememberMe?: boolean;
}

interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

interface AuthResponse {
  user: {
    id: number;
    username: string;
    email: string;
    is_verified: boolean;
    is_active: boolean;
  };
  tokens: {
    access_token: string;
    refresh_token: string;
    token_type: string;
  };
}

interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}

interface ResetPasswordRequest {
  email: string;
}

interface ResetPasswordConfirmRequest {
  reset_token: string;
  new_password: string;
}

interface UpdateProfileRequest {
  username?: string;
  preferences?: Record<string, any>;
}

interface UserProfile {
  id: number;
  username: string;
  email: string;
  is_verified: boolean;
  is_active: boolean;
}

// Create separate axios instance for auth to avoid circular dependencies
const authAxios: AxiosInstance = axios.create({
  baseURL: APP_CONFIG.api.baseURL,
  timeout: APP_CONFIG.api.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to add auth token
authAxios.interceptors.request.use(
  (config) => {
    const tokens = useAuthStore.getState().tokens;
    if (tokens?.accessToken) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for token refresh
authAxios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Skip refresh for certain endpoints
    const skipRefreshEndpoints = ['/api/auth/logout', '/api/auth/refresh', '/api/auth/login', '/api/auth/register'];
    const isSkipEndpoint = skipRefreshEndpoints.some(endpoint => originalRequest.url?.includes(endpoint));
    
    // If 401 and not already retried, and not a skip endpoint, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry && !isSkipEndpoint) {
      originalRequest._retry = true;
      
      try {
        const state = useAuthStore.getState();
        const tokens = state.tokens;
        
        // Only try to refresh if we have tokens and are authenticated
        if (tokens?.refreshToken && state.isAuthenticated) {
          const refreshed = await authClient.refreshTokens(tokens.refreshToken);
          
          // Update tokens in store
          useAuthStore.getState().setTokens({
            accessToken: refreshed.access_token,
            refreshToken: refreshed.refresh_token,
            tokenType: refreshed.token_type,
          });
          
          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${refreshed.access_token}`;
          return authAxios(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, logout user
        useAuthStore.getState().logout();
        // Only redirect to login if we were previously authenticated
        if (useAuthStore.getState().isAuthenticated) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

class AuthClient {
  /**
   * Register a new user
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await authAxios.post<AuthResponse>('/api/auth/register', {
      username: data.username,
      email: data.email,
      password: data.password,
    });
    return response.data;
  }

  /**
   * Login with email/username and password
   */
  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await authAxios.post<AuthResponse>('/api/auth/login', {
      email_or_username: data.emailOrUsername,
      password: data.password,
    });
    return response.data;
  }

  /**
   * Logout current session
   */
  async logout(): Promise<void> {
    try {
      // Clear auth state first to prevent refresh attempts
      const tokens = useAuthStore.getState().tokens;
      
      // Only call logout API if we have a valid token
      if (tokens?.accessToken) {
        await authAxios.post('/api/auth/logout');
      }
    } catch (error) {
      // Ignore logout errors - we're logging out anyway
      console.error('Logout error (ignored):', error);
    } finally {
      // Always clear auth state, regardless of API call success
      useAuthStore.getState().logout();
    }
  }

  /**
   * Logout from all sessions
   */
  async logoutAll(): Promise<void> {
    await authAxios.post('/api/auth/logout-all');
  }

  /**
   * Refresh access and refresh tokens
   */
  async refreshTokens(refreshToken: string): Promise<RefreshTokenResponse> {
    const response = await authAxios.post<RefreshTokenResponse>('/api/auth/refresh', {
      refresh_token: refreshToken,
    });
    return response.data;
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<UserProfile> {
    const response = await authAxios.get<UserProfile>('/api/auth/me');
    return response.data;
  }

  /**
   * Update current user profile
   */
  async updateProfile(data: UpdateProfileRequest): Promise<UserProfile> {
    const response = await authAxios.put<UserProfile>('/api/auth/me', data);
    return response.data;
  }

  /**
   * Change password for current user
   */
  async changePassword(data: ChangePasswordRequest): Promise<void> {
    await authAxios.post('/api/auth/change-password', data);
  }

  /**
   * Request password reset email
   */
  async requestPasswordReset(email: string): Promise<void> {
    await authAxios.post('/api/auth/reset-password', { email });
  }

  /**
   * Reset password with reset token
   */
  async resetPassword(data: ResetPasswordConfirmRequest): Promise<void> {
    await authAxios.post('/api/auth/reset-password-confirm', data);
  }

  /**
   * Verify email with verification code
   */
  async verifyEmail(verificationCode: string): Promise<void> {
    await authAxios.post('/api/auth/verify-email', {
      verification_code: verificationCode,
    });
  }

  /**
   * Check authentication status
   */
  async checkAuthStatus(): Promise<{
    authenticated: boolean;
    user_id?: number;
    username?: string;
    email?: string;
  }> {
    try {
      const response = await authAxios.get('/api/auth/check');
      return response.data;
    } catch (error) {
      return { authenticated: false };
    }
  }
}

// Export singleton instance
export const authClient = new AuthClient();

// Export types
export type {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  RefreshTokenResponse,
  ChangePasswordRequest,
  ResetPasswordRequest,
  ResetPasswordConfirmRequest,
  UpdateProfileRequest,
  UserProfile,
};