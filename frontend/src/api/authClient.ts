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
  token: string;  // Simplified: single token instead of tokens object
}

// Refresh tokens removed in simplified auth

interface TokenResponse {
  token: string;
  token_type: string;
}

interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
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
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for 401 handling (no refresh token in simplified auth)
authAxios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Skip for auth endpoints
    const skipEndpoints = ['/api/auth/login', '/api/auth/register'];
    const isSkipEndpoint = skipEndpoints.some(endpoint => originalRequest.url?.includes(endpoint));
    
    // If 401 and not an auth endpoint, logout user
    if (error.response?.status === 401 && !isSkipEndpoint) {
      const state = useAuthStore.getState();
      
      // Only logout if we were authenticated
      if (state.isAuthenticated) {
        state.logout();
        window.location.href = '/login';
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
    // Logout is handled client-side with JWT (stateless)
    useAuthStore.getState().logout();
  }


  /**
   * Renew token before expiry
   */
  async renewToken(): Promise<TokenResponse> {
    const response = await authAxios.post<TokenResponse>('/api/auth/token/renew');
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
   * Change password for current user
   */
  async changePassword(data: ChangePasswordRequest): Promise<void> {
    await authAxios.post('/api/auth/password', data);
  }


  /**
   * Validate current token
   */
  async validateToken(): Promise<{
    valid: boolean;
    user?: {
      id: number;
      username: string;
      email: string;
    };
  }> {
    try {
      const response = await authAxios.get('/api/auth/validate');
      return response.data;
    } catch (error) {
      return { valid: false };
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
  TokenResponse,
  ChangePasswordRequest,
  UserProfile,
};