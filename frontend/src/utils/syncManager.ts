/**
 * 状态同步管理器
 * 处理前端与后端的状态同步，包括增量同步和冲突解决
 */

import { ProcessingTask, APIResponse } from '../types';
import { getApiUrl } from '../config';

export interface SyncResponse {
  tasks: ProcessingTask[];
  server_timestamp: string;
  total_count: number;
  sync_type: 'full' | 'incremental';
}

export interface SyncResult {
  tasks: ProcessingTask[];
  syncType: 'full' | 'incremental';
}

export interface SyncStatus {
  last_sync: string | null;
  is_syncing: boolean;
  sync_error: string | null;
  server_data_hash: string | null;
  retry_count: number;
  max_retries: number;
}

class SyncManager {
  private baseURL: string;
  private lastSyncTimestamp: string | null = null;
  private isSyncing: boolean = false;
  private syncCallbacks: Array<(status: SyncStatus) => void> = [];
  private serverDataHash: string | null = null;
  private pendingSyncPromise: Promise<ProcessingTask[]> | null = null;
  private retryCount: number = 0;
  private maxRetries: number = 3;
  private lastSyncError: string | null = null;

  constructor(baseURL: string = getApiUrl('/')) {
    this.baseURL = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
    this.loadSyncState();
  }

  /**
   * 添加同步状态变化监听器
   */
  onSyncStatusChange(callback: (status: SyncStatus) => void) {
    this.syncCallbacks.push(callback);
    
    // 立即调用一次以获取当前状态
    callback(this.getSyncStatus());
    
    // 返回取消订阅函数
    return () => {
      this.syncCallbacks = this.syncCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * 获取当前同步状态
   */
  getSyncStatus(): SyncStatus {
    return {
      last_sync: this.lastSyncTimestamp,
      is_syncing: this.isSyncing,
      sync_error: this.lastSyncError,
      server_data_hash: this.serverDataHash,
      retry_count: this.retryCount,
      max_retries: this.maxRetries
    };
  }

  /**
   * 通知同步状态变化
   */
  private notifySyncStatusChange() {
    const status = this.getSyncStatus();
    this.syncCallbacks.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('Sync status callback error:', error);
      }
    });
  }

  /**
   * 智能同步 - 根据服务器状态选择增量或全量同步，带重试机制
   * @param forceFullSync - 是否强制全量同步
   */
  async smartSync(forceFullSync: boolean = false): Promise<SyncResult> {
    return this.syncWithRetry(async () => {
      try {
        // 如果强制全量同步，直接执行
        if (forceFullSync) {
          console.log('Forced full sync requested');
          const tasks = await this.syncAll();
          return { tasks, syncType: 'full' };
        }

        // 检查服务器状态
        const statusResponse = await fetch(`${this.baseURL}/api/sync/status`, {
          signal: AbortSignal.timeout(5000) // 5秒超时
        });
        
        if (!statusResponse.ok) {
          throw new Error(`Server status check failed: ${statusResponse.statusText}`);
        }

        const statusData = await statusResponse.json();
        const serverHash = statusData.data?.data_hash;

        // 如果服务器数据哈希与本地不同，执行全量同步
        if (serverHash && serverHash !== this.serverDataHash) {
          console.log('Server data changed, performing full sync');
          const tasks = await this.syncAll();
          return { tasks, syncType: 'full' };
        }

        // 否则执行增量同步
        const tasks = await this.syncIncremental();
        return { tasks, syncType: 'incremental' };
      } catch (error) {
        console.error('Smart sync failed, falling back to full sync:', error);
        const tasks = await this.syncAll();
        return { tasks, syncType: 'full' };
      }
    });
  }

  /**
   * 带重试机制的同步包装器
   */
  private async syncWithRetry<T>(syncFn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        this.retryCount = attempt;
        const result = await syncFn();
        
        // 成功时重置重试计数和错误
        this.retryCount = 0;
        this.lastSyncError = null;
        this.notifySyncStatusChange();
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown sync error');
        this.lastSyncError = lastError.message;
        
        console.error(`Sync attempt ${attempt + 1}/${this.maxRetries + 1} failed:`, error);
        
        // 如果还有重试机会，等待一段时间后重试
        if (attempt < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // 指数退避，最大10秒
          console.log(`Retrying sync in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        this.notifySyncStatusChange();
      }
    }
    
    // 所有重试都失败了
    throw lastError || new Error('Sync failed after all retries');
  }

  /**
   * 执行同步操作
   */
  private async performSync(type: 'full' | 'incremental'): Promise<ProcessingTask[]> {
    // 如果已经有同步在进行，返回现有的Promise
    if (this.isSyncing && this.pendingSyncPromise) {
      console.log('Sync already in progress, waiting for existing sync...');
      return this.pendingSyncPromise;
    }

    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;
    this.notifySyncStatusChange();

    // 创建同步Promise并保存引用
    this.pendingSyncPromise = this._executeSync(type);

    try {
      const result = await this.pendingSyncPromise;
      return result;
    } finally {
      this.pendingSyncPromise = null;
      this.isSyncing = false;
    }
  }

  /**
   * 实际执行同步操作的私有方法
   */
  private async _executeSync(type: 'full' | 'incremental'): Promise<ProcessingTask[]> {
    try {
      console.log(`Executing ${type} sync...`);
      
      const url = `${this.baseURL}/api/sync`;
      const params = new URLSearchParams();
      
      if (type === 'incremental' && this.lastSyncTimestamp) {
        params.set('last_sync', this.lastSyncTimestamp);
      }

      const fullUrl = params.toString() ? `${url}?${params}` : url;
      
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Sync request failed: ${response.statusText}`);
      }

      const data: APIResponse<SyncResponse> = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Sync failed');
      }

      // 更新同步状态
      this.lastSyncTimestamp = data.data!.server_timestamp;
      this.serverDataHash = response.headers.get('etag')?.replace(/"/g, '') || null;
      this.saveSyncState();
      this.notifySyncStatusChange();

      console.log(`${type} sync completed: ${data.data!.tasks.length} tasks`);
      return data.data!.tasks;

    } catch (error) {
      console.error(`${type} sync failed:`, error);
      this.notifySyncStatusChange();
      throw error;
    }
  }

  /**
   * 全量同步
   */
  async syncAll(): Promise<ProcessingTask[]> {
    return this.performSync('full');
  }

  /**
   * 增量同步
   */
  async syncIncremental(): Promise<ProcessingTask[]> {
    return this.performSync('incremental');
  }

  /**
   * 合并任务列表，处理冲突
   * 增量同步：合并更新
   * 全量同步：完全替换
   */
  mergeTasks(localTasks: ProcessingTask[], serverTasks: ProcessingTask[], isFullSync: boolean = false): ProcessingTask[] {
    const merged = new Map<string, ProcessingTask>();
    
    // 如果是全量同步，直接使用服务器数据
    if (isFullSync) {
      serverTasks.forEach(task => {
        merged.set(task.id, task);
      });
      return Array.from(merged.values());
    }
    
    // 增量同步：先保留所有本地任务
    localTasks.forEach(task => {
      merged.set(task.id, task);
    });
    
    // 然后用服务器返回的任务更新或添加
    serverTasks.forEach(serverTask => {
      merged.set(serverTask.id, serverTask);
    });
    
    return Array.from(merged.values());
  }

  /**
   * 清除同步状态
   */
  clearSyncState() {
    this.lastSyncTimestamp = null;
    this.serverDataHash = null;
    localStorage.removeItem('monkeyocr-sync-state');
    this.notifySyncStatusChange();
  }

  /**
   * 获取原始文件预览URL
   */
  getOriginalFileUrl(taskId: string): string {
    return `${this.baseURL}/api/files/${taskId}/original`;
  }

  /**
   * 获取任务预览信息
   */
  async getTaskPreview(taskId: string): Promise<APIResponse<any>> {
    const response = await fetch(`${this.baseURL}/api/tasks/${taskId}/preview`);
    
    if (!response.ok) {
      throw new Error(`Preview request failed: ${response.statusText}`);
    }
    
    return response.json();
  }

  /**
   * 加载同步状态
   */
  private loadSyncState() {
    try {
      const saved = localStorage.getItem('monkeyocr-sync-state');
      if (saved) {
        const state = JSON.parse(saved);
        this.lastSyncTimestamp = state.lastSyncTimestamp;
        this.serverDataHash = state.serverDataHash;
      }
    } catch (error) {
      console.error('Failed to load sync state:', error);
    }
  }

  /**
   * 保存同步状态
   */
  private saveSyncState() {
    try {
      const state = {
        lastSyncTimestamp: this.lastSyncTimestamp,
        serverDataHash: this.serverDataHash
      };
      localStorage.setItem('monkeyocr-sync-state', JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save sync state:', error);
    }
  }
}

// 创建全局实例
export const syncManager = new SyncManager();
export default syncManager;