/**
 * UI Store - 独立的 UI 状态管理
 * 不使用 persist，不与业务数据混合
 * 专门管理 UI 相关状态，避免触发业务组件重渲染
 */

import { create } from 'zustand';

interface UIState {
  // UI 状态
  taskListVisible: boolean;
  
  // UI 动作
  toggleTaskListVisible: () => void;
  setTaskListVisible: (visible: boolean) => void;
}

// 创建独立的 UI Store - 不使用 persist，轻量级
export const useUIStore = create<UIState>((set) => ({
  // 初始状态
  taskListVisible: true,
  
  // 动作
  toggleTaskListVisible: () => set((state) => ({ 
    taskListVisible: !state.taskListVisible 
  })),
  
  setTaskListVisible: (visible: boolean) => set({ 
    taskListVisible: visible 
  }),
}));