/**
 * Application configuration
 * Centralized configuration for all environment-specific settings
 * 
 * Environment files:
 * - .env.development: Development settings (included in version control)
 * - .env.production: Production settings (included in version control) 
 * - .env.local: Local overrides (ignored by git)
 * 
 * All components should import configuration from this file instead of 
 * directly accessing environment variables or hardcoding URLs.
 */

// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';
export const API_TIMEOUT = 30000; // 30 seconds

// Development settings
export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;

// App Configuration
export const APP_CONFIG = {
  // API settings
  api: {
    baseURL: API_BASE_URL,
    timeout: API_TIMEOUT,
  },
  
  // Upload settings
  upload: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    maxFiles: 10,
  },
  
  // UI settings
  ui: {
    toastTimeout: 5000,
    taskPollInterval: 2000, // 2 seconds
  },
} as const;

// Helper functions
export const getStaticFileUrl = (filePath: string): string => {
  return `${API_BASE_URL}/static/${filePath}`;
};

export const getApiUrl = (path: string): string => {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${API_BASE_URL}/${cleanPath}`;
};

// Environment validation
if (!API_BASE_URL) {
  console.warn('VITE_API_BASE_URL not set, using default localhost:8001');
}

export default APP_CONFIG;