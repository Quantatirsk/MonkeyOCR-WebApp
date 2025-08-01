/**
 * 状态同步管理器
 * 处理前端与后端的状态同步，包括增量同步和冲突解决
 */

import { ProcessingTask, APIResponse } from '../types';

export interface SyncResponse {
  tasks: ProcessingTask[];
  server_timestamp: string;
  total_count: number;
  sync_type: 'full' | 'incremental';
}

export interface SyncStatus {
  last_sync: string | null;
  is_syncing: boolean;
  sync_error: string | null;
  server_data_hash: string | null;
}

class SyncManager {
  private baseURL: string;
  private lastSyncTimestamp: string | null = null;
  private isSyncing: boolean = false;
  private syncCallbacks: Array<(status: SyncStatus) => void> = [];
  private serverDataHash: string | null = null;
  private pendingSyncPromise: Promise<ProcessingTask[]> | null = null;

  constructor(baseURL: string = 'http://localhost:8001/api') {
    this.baseURL = baseURL;
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
      sync_error: null,
      server_data_hash: this.serverDataHash
    };
  }

  /**
   * 从 localStorage 加载同步状态
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
   * 保存同步状态到 localStorage
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

  /**
   * 通知同步状态变化
   */
  private notifySyncStatusChange(error?: string | null) {
    const status: SyncStatus = {
      last_sync: this.lastSyncTimestamp,
      is_syncing: this.isSyncing,
      sync_error: error || null,
      server_data_hash: this.serverDataHash
    };
    
    this.syncCallbacks.forEach(callback => {
      try {
        callback(status);
      } catch (err) {
        console.error('Error in sync status callback:', err);
      }
    });
  }

  /**
   * 执行全量同步
   */
  async syncAll(): Promise<ProcessingTask[]> {
    return this.performSync('full');
  }

  /**
   * 执行增量同步
   */
  async syncIncremental(): Promise<ProcessingTask[]> {
    if (!this.lastSyncTimestamp) {
      return this.syncAll();
    }
    return this.performSync('incremental');
  }

  /**
   * 智能同步 - 根据情况选择全量或增量
   */
  async smartSync(): Promise<ProcessingTask[]> {
    try {
      // 先检查服务器状态
      const statusResponse = await fetch(`${this.baseURL}/sync/status`);
      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.status}`);
      }

      const statusData = await statusResponse.json();
      const serverHash = statusData.data?.data_hash;

      // 如果服务器数据哈希与本地不同，执行全量同步
      if (serverHash && serverHash !== this.serverDataHash) {
        console.log('Server data changed, performing full sync');
        return this.syncAll();
      }

      // 否则执行增量同步
      return this.syncIncremental();
    } catch (error) {
      console.error('Smart sync failed, falling back to full sync:', error);
      return this.syncAll();
    }
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
      // 构建请求URL
      let url = `${this.baseURL}/sync`;
      const params = new URLSearchParams();

      if (type === 'incremental' && this.lastSyncTimestamp) {
        params.append('last_sync', this.lastSyncTimestamp);
      }

      if (params.toString()) {
        url += '?' + params.toString();
      }

      // 添加 ETag 头用于缓存验证
      const headers: HeadersInit = {
        'Accept': 'application/json'
      };

      if (this.serverDataHash) {
        headers['If-None-Match'] = `"${this.serverDataHash}"`;
      }

      const response = await fetch(url, { headers });

      // 处理 304 Not Modified
      if (response.status === 304) {
        console.log('Data not modified, using cached version');
        return [];
      }

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status} ${response.statusText}`);
      }

      const data: APIResponse<SyncResponse> = await response.json();

      if (!data.success || !data.data) {
        throw new Error(data.error || 'Sync response invalid');
      }

      // 更新同步状态
      this.lastSyncTimestamp = data.data.server_timestamp;
      
      // 从响应头获取 ETag
      const etag = response.headers.get('etag');
      if (etag) {
        this.serverDataHash = etag.replace(/"/g, '');
      }

      this.saveSyncState();
      this.notifySyncStatusChange();

      console.log(`${data.data.sync_type} sync completed:`, data.data.total_count, 'tasks');
      return data.data.tasks;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
      console.error('Sync failed:', errorMessage);
      this.notifySyncStatusChange(errorMessage);
      throw error;
    }
  }

  /**
   * 合并任务列表，处理冲突
   */
  mergeTasks(localTasks: ProcessingTask[], serverTasks: ProcessingTask[]): ProcessingTask[] {
    const merged = new Map<string, ProcessingTask>();

    // 先添加本地任务
    localTasks.forEach(task => {
      merged.set(task.id, task);
    });

    // 然后添加/更新服务器任务
    serverTasks.forEach(serverTask => {
      const localTask = merged.get(serverTask.id);
      
      if (!localTask) {
        // 新任务，直接添加
        merged.set(serverTask.id, serverTask);
      } else {
        // 存在冲突，服务器数据优先
        // 但保留本地的 UI 状态（如果有的话）
        const mergedTask: ProcessingTask = {
          ...serverTask,
          // 可以在这里添加特殊的合并逻辑
        };
        merged.set(serverTask.id, mergedTask);
      }
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
    return `${this.baseURL}/files/${taskId}/original`;
  }

  /**
   * 获取任务预览信息
   */
  async getTaskPreview(taskId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}/tasks/${taskId}/preview`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        // 添加超时控制
        signal: AbortSignal.timeout(5000), // 5秒超时
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Task ${taskId} not found`);
        }
        throw new Error(`Failed to get task preview: ${response.status} ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout for task ${taskId}`);
        }
        if (error.message.includes('Failed to fetch')) {
          throw new Error(`Network error: Cannot connect to server`);
        }
      }
      throw error;
    }
  }
}

// 导出单例实例
export const syncManager = new SyncManager();

// 导出类型和类供测试使用
export { SyncManager };
export default syncManager;