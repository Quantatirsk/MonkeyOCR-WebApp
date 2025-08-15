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
// Default to '/' for production (same domain), can be overridden with VITE_API_BASE_URL
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/';
export const API_TIMEOUT = 30000; // 30 seconds


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
export const getMediaFileUrl = (filePath: string): string => {
  const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
  // Handle relative path case
  if (API_BASE_URL === '/') {
    return `/media/${cleanPath}`;
  }
  return `${API_BASE_URL}/media/${cleanPath}`;
};

export const getApiUrl = (path: string): string => {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  // Handle relative path case
  if (API_BASE_URL === '/') {
    return `/${cleanPath}`;
  }
  return `${API_BASE_URL}/${cleanPath}`;
};

// Environment validation
if (import.meta.env.DEV && !import.meta.env.VITE_API_BASE_URL) {
  console.info('VITE_API_BASE_URL not set, using default "/" - you may need to set it to "http://localhost:8001" for development');
}

export default APP_CONFIG;