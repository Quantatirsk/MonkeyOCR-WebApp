"""
数据持久化模块
管理任务状态的持久化存储，支持 Redis 和文件系统
"""

import json
import os
import threading
import time
import hashlib
import asyncio
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime
import logging
from models.schemas import ProcessingTask, TaskStatusHistory

logger = logging.getLogger(__name__)

class PersistenceManager:
    """
    任务状态持久化管理器
    
    提供线程安全的任务状态持久化存储，支持：
    - JSON 文件存储
    - 数据完整性验证
    - 错误恢复
    - 并发访问控制
    """
    
    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.tasks_file = self.data_dir / "tasks.json"
        self._lock = threading.RLock()  # 可重入锁
        self._tasks_cache: Dict[str, Dict[str, Any]] = {}
        self._last_save_time = 0
        self._save_interval = 1.0  # 最小保存间隔（秒）
        
        # 确保数据目录存在
        self.data_dir.mkdir(exist_ok=True)
        
        # 加载现有数据
        self._load_tasks()
    
    def _load_tasks(self) -> None:
        """
        从文件加载任务数据
        """
        try:
            if self.tasks_file.exists():
                with open(self.tasks_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                # 验证数据结构
                if isinstance(data, dict) and 'tasks' in data and 'version' in data:
                    self._tasks_cache = data['tasks']
                    logger.info(f"Loaded {len(self._tasks_cache)} tasks from {self.tasks_file}")
                else:
                    logger.warning(f"Invalid data structure in {self.tasks_file}, starting fresh")
                    self._tasks_cache = {}
            else:
                logger.info(f"Tasks file {self.tasks_file} not found, starting fresh")
                self._tasks_cache = {}
                
        except (json.JSONDecodeError, IOError) as e:
            logger.error(f"Failed to load tasks from {self.tasks_file}: {e}")
            logger.warning("Starting with empty task storage")
            self._tasks_cache = {}
    
    
    def _save_tasks(self, force: bool = False) -> None:
        """
        保存任务数据到文件
        
        Args:
            force: 是否强制保存（忽略时间间隔限制）
        """
        current_time = time.time()
        
        # 防止频繁保存
        if not force and (current_time - self._last_save_time) < self._save_interval:
            return
            
        try:
            # 准备保存的数据，保留原始创建时间或使用当前时间（如果是首次创建）
            existing_created_at = None
            if self.tasks_file.exists():
                try:
                    with open(self.tasks_file, 'r', encoding='utf-8') as f:
                        existing_data = json.load(f)
                        existing_created_at = existing_data.get('created_at')
                except (json.JSONDecodeError, IOError):
                    pass
            
            save_data = {
                'version': '1.0',
                'created_at': existing_created_at or datetime.now().isoformat(),
                'tasks': self._tasks_cache
            }
            
            # 先保存到临时文件
            temp_file = self.tasks_file.with_suffix('.tmp')
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(save_data, f, indent=2, ensure_ascii=False)
            
            # 原子性替换
            temp_file.replace(self.tasks_file)
            
            self._last_save_time = current_time
            logger.debug(f"Saved {len(self._tasks_cache)} tasks to {self.tasks_file}")
            
        except IOError as e:
            logger.error(f"Failed to save tasks to {self.tasks_file}: {e}")
            raise
    
    def add_task(self, task: ProcessingTask) -> None:
        """
        添加任务
        
        Args:
            task: 要添加的任务
        """
        with self._lock:
            task_dict = task.dict()
            self._tasks_cache[task.id] = task_dict
            self._save_tasks()
            logger.info(f"Added task {task.id}: {task.filename}")
    
    def update_task(self, task_id: str, updates: Dict[str, Any]) -> Optional[ProcessingTask]:
        """
        更新任务
        
        Args:
            task_id: 任务ID
            updates: 要更新的字段
            
        Returns:
            更新后的任务，如果任务不存在则返回 None
        """
        with self._lock:
            if task_id not in self._tasks_cache:
                logger.warning(f"Task {task_id} not found for update")
                return None
            
            # 更新字段
            self._tasks_cache[task_id].update(updates)
            
            # 更新时间戳
            self._tasks_cache[task_id]['updated_at'] = datetime.now().isoformat()
            
            self._save_tasks()
            
            # 返回更新后的任务
            return ProcessingTask(**self._tasks_cache[task_id])
    
    def get_task(self, task_id: str) -> Optional[ProcessingTask]:
        """
        获取任务
        
        Args:
            task_id: 任务ID
            
        Returns:
            任务对象，如果不存在则返回 None
        """
        with self._lock:
            task_data = self._tasks_cache.get(task_id)
            if task_data:
                return ProcessingTask(**task_data)
            return None
    
    def get_all_tasks(self) -> List[ProcessingTask]:
        """
        获取所有任务
        
        Returns:
            任务列表，按创建时间倒序排列
        """
        with self._lock:
            tasks = []
            for task_data in self._tasks_cache.values():
                try:
                    tasks.append(ProcessingTask(**task_data))
                except Exception as e:
                    logger.error(f"Failed to parse task data: {e}")
                    continue
            
            # 按创建时间倒序排序
            tasks.sort(key=lambda x: x.created_at, reverse=True)
            return tasks
    
    def delete_task(self, task_id: str) -> bool:
        """
        删除任务
        
        Args:
            task_id: 任务ID
            
        Returns:
            是否删除成功
        """
        with self._lock:
            if task_id in self._tasks_cache:
                del self._tasks_cache[task_id]
                self._save_tasks()
                logger.info(f"Deleted task {task_id}")
                return True
            return False
    
    def get_tasks_by_status(self, status: str) -> List[ProcessingTask]:
        """
        根据状态获取任务
        
        Args:
            status: 任务状态
            
        Returns:
            指定状态的任务列表
        """
        with self._lock:
            tasks = []
            for task_data in self._tasks_cache.values():
                if task_data.get('status') == status:
                    try:
                        tasks.append(ProcessingTask(**task_data))
                    except Exception as e:
                        logger.error(f"Failed to parse task data: {e}")
                        continue
            
            return tasks
    
    def get_processing_tasks(self) -> List[ProcessingTask]:
        """
        获取正在处理的任务
        
        Returns:
            处理中的任务列表
        """
        return self.get_tasks_by_status('processing')
    
    def get_task_count(self) -> int:
        """
        获取任务总数
        
        Returns:
            任务总数
        """
        with self._lock:
            return len(self._tasks_cache)
    
    def get_task_stats(self) -> Dict[str, int]:
        """
        获取任务统计信息
        
        Returns:
            任务状态统计
        """
        with self._lock:
            stats = {
                'total': 0,
                'pending': 0,
                'processing': 0,
                'completed': 0,
                'failed': 0
            }
            
            for task_data in self._tasks_cache.values():
                stats['total'] += 1
                status = task_data.get('status', 'unknown')
                if status in stats:
                    stats[status] += 1
            
            return stats
    
    def force_save(self) -> None:
        """
        强制保存数据到文件
        """
        with self._lock:
            self._save_tasks(force=True)
    
    def validate_data(self) -> Dict[str, Any]:
        """
        验证数据完整性
        
        Returns:
            验证结果
        """
        with self._lock:
            result = {
                'valid': True,
                'errors': [],
                'warnings': [],
                'task_count': len(self._tasks_cache)
            }
            
            for task_id, task_data in self._tasks_cache.items():
                try:
                    # 尝试创建 ProcessingTask 对象验证数据
                    ProcessingTask(**task_data)
                except Exception as e:
                    result['valid'] = False
                    result['errors'].append(f"Task {task_id}: {str(e)}")
            
            return result
    
    def cleanup_old_tasks(self, days: int = 30) -> int:
        """
        清理旧任务（可选功能）
        
        Args:
            days: 保留天数
            
        Returns:
            清理的任务数量
        """
        if days <= 0:
            return 0
            
        with self._lock:
            cutoff_time = datetime.now().timestamp() - (days * 24 * 3600)
            to_delete = []
            
            for task_id, task_data in self._tasks_cache.items():
                try:
                    created_at = datetime.fromisoformat(task_data['created_at'])
                    if created_at.timestamp() < cutoff_time:
                        # 只清理已完成或失败的任务
                        if task_data.get('status') in ['completed', 'failed']:
                            to_delete.append(task_id)
                except Exception as e:
                    logger.error(f"Error checking task {task_id} age: {e}")
            
            # 删除旧任务
            for task_id in to_delete:
                del self._tasks_cache[task_id]
            
            if to_delete:
                self._save_tasks()
                logger.info(f"Cleaned up {len(to_delete)} old tasks")
            
            return len(to_delete)
    
    def update_task_status(self, task_id: str, new_status: str, message: Optional[str] = None, **kwargs) -> Optional[ProcessingTask]:
        """
        更新任务状态并记录历史
        
        Args:
            task_id: 任务ID
            new_status: 新状态
            message: 状态变更消息
            **kwargs: 其他要更新的字段
            
        Returns:
            更新后的任务，如果任务不存在则返回 None
        """
        with self._lock:
            if task_id not in self._tasks_cache:
                logger.warning(f"Task {task_id} not found for status update")
                return None
            
            task_data = self._tasks_cache[task_id]
            old_status = task_data.get('status')
            
            # 只在状态真正改变时记录历史
            if old_status != new_status:
                # 确保状态历史列表存在
                if 'status_history' not in task_data:
                    task_data['status_history'] = []
                
                # 添加状态历史记录
                history_entry = TaskStatusHistory(
                    status=new_status,
                    timestamp=datetime.now().isoformat(),
                    message=message
                )
                task_data['status_history'].append(history_entry.dict())
                
                logger.info(f"Task {task_id} status changed: {old_status} -> {new_status}")
            
            # 更新状态和其他字段
            task_data['status'] = new_status
            task_data['last_modified'] = datetime.now().isoformat()
            
            # 处理特殊状态的时间戳
            if new_status == 'processing' and 'processing_started_at' not in task_data:
                task_data['processing_started_at'] = datetime.now().isoformat()
            elif new_status in ['completed', 'failed']:
                task_data['completed_at'] = datetime.now().isoformat()
                
                # 计算处理时长
                if 'processing_started_at' in task_data and task_data['processing_started_at']:
                    try:
                        started_at = datetime.fromisoformat(task_data['processing_started_at'])
                        completed_at = datetime.now()
                        duration = (completed_at - started_at).total_seconds()
                        task_data['processing_duration'] = duration
                    except Exception as e:
                        logger.error(f"Failed to calculate processing duration: {e}")
            
            # 更新其他字段
            task_data.update(kwargs)
            
            self._save_tasks()
            
            # 返回更新后的任务
            return ProcessingTask(**task_data)
    
    def add_file_metadata(self, task_id: str, file_content: bytes, filename: str) -> None:
        """
        添加文件元数据（哈希和大小）
        
        Args:
            task_id: 任务ID
            file_content: 文件内容
            filename: 文件名
        """
        with self._lock:
            if task_id not in self._tasks_cache:
                logger.warning(f"Task {task_id} not found for file metadata update")
                return
            
            # 计算文件哈希
            file_hash = hashlib.sha256(file_content).hexdigest()
            file_size = len(file_content)
            
            # 更新任务数据
            self._tasks_cache[task_id].update({
                'file_hash': file_hash,
                'file_size': file_size,
                'filename': filename,  # 确保文件名是正确的
                'last_modified': datetime.now().isoformat()
            })
            
            self._save_tasks()
            logger.info(f"Added file metadata for task {task_id}: hash={file_hash[:8]}..., size={file_size}")
    
    def get_task_by_hash(self, file_hash: str) -> Optional[ProcessingTask]:
        """
        根据文件哈希查找任务
        
        Args:
            file_hash: 文件哈希值
            
        Returns:
            匹配的任务，如果不存在则返回 None
        """
        with self._lock:
            for task_data in self._tasks_cache.values():
                if task_data.get('file_hash') == file_hash:
                    return ProcessingTask(**task_data)
            return None
    
    def get_tasks_with_metadata(self) -> Dict[str, ProcessingTask]:
        """
        获取所有任务并返回字典格式
        用于与 get_all_tasks 区分，这个方法返回字典而不是列表
        
        Returns:
            任务字典，键为任务ID
        """
        with self._lock:
            tasks = {}
            for task_id, task_data in self._tasks_cache.items():
                try:
                    tasks[task_id] = ProcessingTask(**task_data)
                except Exception as e:
                    logger.error(f"Failed to parse task data for {task_id}: {e}")
                    continue
            return tasks


# 全局持久化管理器实例
_persistence_manager: Optional[PersistenceManager] = None

def get_persistence_manager() -> PersistenceManager:
    """
    获取全局持久化管理器实例
    
    Returns:
        PersistenceManager 实例
    """
    global _persistence_manager
    if _persistence_manager is None:
        _persistence_manager = PersistenceManager()
    return _persistence_manager

def init_persistence(data_dir: str = "data") -> PersistenceManager:
    """
    初始化持久化管理器
    
    Args:
        data_dir: 数据目录路径
        
    Returns:
        PersistenceManager 实例
    """
    global _persistence_manager
    if _persistence_manager is None:
        _persistence_manager = PersistenceManager(data_dir)
        logger.info(f"Initialized persistence manager with data_dir: {data_dir}")
    else:
        logger.info("Persistence manager already initialized, reusing existing instance")
    return _persistence_manager

