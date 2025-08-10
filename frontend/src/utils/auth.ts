/**
 * Authentication utility functions
 */

/**
 * 获取当前的访问令牌
 * @returns Access token if authenticated, null otherwise
 */
export function getAccessToken(): string | null {
  try {
    // 注意：zustand 使用 'auth-storage' 作为键名，不是 'authStore'
    const authStorage = localStorage.getItem('auth-storage');
    if (!authStorage) {
      return null;
    }
    
    const auth = JSON.parse(authStorage);
    const token = auth?.state?.token;
    
    if (token) {
      return token;
    }
  } catch (error) {
    // 静默失败，避免日志噪音
  }
  
  return null;
}

/**
 * 检查用户是否已认证
 * @returns True if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

/**
 * 为 fetch 请求添加认证头
 * @param headers 现有的请求头
 * @returns 包含认证令牌的请求头
 */
export function withAuthHeaders(headers: HeadersInit = {}): HeadersInit {
  const token = getAccessToken();
  
  if (token) {
    return {
      ...headers,
      'Authorization': `Bearer ${token}`,
    };
  }
  
  return headers;
}

/**
 * 创建带认证的 fetch 函数
 * @param url 请求URL
 * @param options 请求选项
 * @returns Fetch response
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const authHeaders = withAuthHeaders(options.headers);
  
  return fetch(url, {
    ...options,
    headers: authHeaders,
  });
}