/**
 * 后端健康检查工具
 * 用于诊断前端与后端的连接问题
 */

import { API_BASE_URL } from '../config';

const API_BASE = API_BASE_URL;

export class HealthChecker {
  private static instance: HealthChecker;
  
  static getInstance(): HealthChecker {
    if (!HealthChecker.instance) {
      HealthChecker.instance = new HealthChecker();
    }
    return HealthChecker.instance;
  }

  /**
   * 检查后端健康状态
   */
  async checkHealth(): Promise<{
    healthy: boolean;
    latency?: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${API_BASE}/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(3000), // 3秒超时
      });
      
      const latency = Date.now() - startTime;
      
      if (!response.ok) {
        return {
          healthy: false,
          latency,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }
      
      const data = await response.json();
      return {
        healthy: data.status === 'healthy',
        latency,
        error: data.status !== 'healthy' ? 'Backend reports unhealthy' : undefined
      };
      
    } catch (error) {
      const latency = Date.now() - startTime;
      let errorMessage = 'Unknown error';
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Request timeout (>3s)';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Cannot connect to backend server';
        } else {
          errorMessage = error.message;
        }
      }
      
      return {
        healthy: false,
        latency,
        error: errorMessage
      };
    }
  }

  /**
   * 检查同步API可用性
   */
  async checkSyncAPI(): Promise<{
    available: boolean;
    error?: string;
  }> {
    try {
      const response = await fetch(`${API_BASE}/api/sync/status`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(3000),
      });
      
      if (!response.ok) {
        return {
          available: false,
          error: `Sync API returned ${response.status}: ${response.statusText}`
        };
      }
      
      const data = await response.json();
      return {
        available: data.success === true,
        error: data.success !== true ? data.error || 'Sync API reports failure' : undefined
      };
      
    } catch (error) {
      let errorMessage = 'Unknown error';
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Sync API timeout';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Cannot reach sync API';
        } else {
          errorMessage = error.message;
        }
      }
      
      return {
        available: false,
        error: errorMessage
      };
    }
  }

  /**
   * 运行完整的健康检查
   */
  async runFullCheck(): Promise<{
    overall: boolean;
    health: {
      healthy: boolean;
      latency?: number;
      error?: string;
    };
    sync: {
      available: boolean;
      error?: string;
    };
  }> {
    const [health, sync] = await Promise.all([
      this.checkHealth(),
      this.checkSyncAPI()
    ]);
    
    return {
      overall: health.healthy && sync.available,
      health,
      sync
    };
  }
}

export const healthChecker = HealthChecker.getInstance();