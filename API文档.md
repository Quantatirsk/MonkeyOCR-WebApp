# MonkeyOCR API 完整使用文档

## 概述

MonkeyOCR 是一个强大的 OCR（光学字符识别）和文档解析 API 服务，支持从图像和 PDF 文件中提取文本、公式和表格。本文档详细介绍了如何使用 Python 调用 MonkeyOCR API。

**服务器地址**: [https://ocr.teea.cn](https://ocr.teea.cn)

**API测试地址**: [https://ocr.teea.cn/docs](https://ocr.teea.cn/docs)

## 功能特性

- **文本提取**: 从图像或PDF中提取纯文本
- **公式识别**: 识别和提取数学公式
- **表格提取**: 提取表格数据并结构化
- **完整文档解析**: 解析整个文档的所有内容
- **批量处理**: 支持多文件批量处理
- **异步处理**: 支持大文件异步处理
- **优先级队列**: 支持高优先级任务

## Python 环境准备

```python
import requests
import time
import json
from pathlib import Path

# API 基础配置
BASE_URL = "https://ocr.teea.cn"
```

## 1. 基础 OCR 功能

### 1.1 文本提取

```python
def extract_text(file_path):
    """
    从图像或PDF中提取文本
    
    Args:
        file_path (str): 文件路径
    
    Returns:
        dict: 提取结果
    """
    url = f"{BASE_URL}/ocr/text"
    
    with open(file_path, 'rb') as file:
        files = {'file': file}
        response = requests.post(url, files=files)
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"请求失败: {response.status_code}")
        return None

# 使用示例
result = extract_text("document.pdf")
if result and result['success']:
    print("提取的文本:")
    print(result['content'])
```

### 1.2 公式提取

```python
def extract_formula(file_path):
    """
    从图像或PDF中提取数学公式
    
    Args:
        file_path (str): 文件路径
    
    Returns:
        dict: 提取结果
    """
    url = f"{BASE_URL}/ocr/formula"
    
    with open(file_path, 'rb') as file:
        files = {'file': file}
        response = requests.post(url, files=files)
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"请求失败: {response.status_code}")
        return None

# 使用示例
result = extract_formula("math_document.pdf")
if result and result['success']:
    print("提取的公式:")
    print(result['content'])
```

### 1.3 表格提取

```python
def extract_table(file_path):
    """
    从图像或PDF中提取表格
    
    Args:
        file_path (str): 文件路径
    
    Returns:
        dict: 提取结果
    """
    url = f"{BASE_URL}/ocr/table"
    
    with open(file_path, 'rb') as file:
        files = {'file': file}
        response = requests.post(url, files=files)
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"请求失败: {response.status_code}")
        return None

# 使用示例
result = extract_table("table_document.pdf")
if result and result['success']:
    print("提取的表格:")
    print(result['content'])
```

## 2. 完整文档解析

### 2.1 标准文档解析

```python
def parse_document(file_path):
    """
    解析完整文档
    
    Args:
        file_path (str): 文件路径
    
    Returns:
        dict: 解析结果
    """
    url = f"{BASE_URL}/parse"
    
    with open(file_path, 'rb') as file:
        files = {'file': file}
        response = requests.post(url, files=files)
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"请求失败: {response.status_code}")
        return None

# 使用示例
result = parse_document("complete_document.pdf")
if result and result['success']:
    print("解析成功!")
    print(f"消息: {result['message']}")
    if result.get('download_url'):
        print(f"下载链接: {result['download_url']}")
```

### 2.2 分页解析

```python
def parse_document_split(file_path):
    """
    解析文档并按页面分割结果
    
    Args:
        file_path (str): 文件路径
    
    Returns:
        dict: 解析结果
    """
    url = f"{BASE_URL}/parse/split"
    
    with open(file_path, 'rb') as file:
        files = {'file': file}
        response = requests.post(url, files=files)
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"请求失败: {response.status_code}")
        return None

# 使用示例
result = parse_document_split("multi_page_document.pdf")
if result and result['success']:
    print("分页解析成功!")
    if result.get('files'):
        print(f"生成的文件: {result['files']}")
```

## 3. 批量处理

### 3.1 提交批量任务

```python
def submit_batch_job(file_paths, task_type=None, split_pages=False, priority="normal"):
    """
    提交批量处理任务
    
    Args:
        file_paths (list): 文件路径列表
        task_type (str): 任务类型 (可选)
        split_pages (bool): 是否分页处理
        priority (str): 优先级 ("normal", "high")
    
    Returns:
        dict: 批量任务响应
    """
    url = f"{BASE_URL}/batch/submit"
    
    # 准备查询参数
    params = {
        'split_pages': split_pages,
        'priority': priority
    }
    if task_type:
        params['task_type'] = task_type
    
    # 准备文件
    files = []
    for file_path in file_paths:
        files.append(('files', (Path(file_path).name, open(file_path, 'rb'), 'application/octet-stream')))
    
    try:
        response = requests.post(url, files=files, params=params)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"请求失败: {response.status_code}")
            return None
    finally:
        # 关闭所有文件句柄
        for _, file_tuple in files:
            file_tuple[1].close()

# 使用示例
file_list = ["doc1.pdf", "doc2.pdf", "doc3.pdf"]
batch_result = submit_batch_job(file_list, split_pages=True)
if batch_result and batch_result['success']:
    job_id = batch_result['job_id']
    print(f"批量任务已提交，任务ID: {job_id}")
    print(f"总文件数: {batch_result['total_files']}")
```

### 3.2 检查批量任务状态

```python
def get_batch_status(job_id):
    """
    获取批量任务状态
    
    Args:
        job_id (str): 任务ID
    
    Returns:
        dict: 任务状态信息
    """
    url = f"{BASE_URL}/batch/{job_id}/status"
    response = requests.get(url)
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"请求失败: {response.status_code}")
        return None

def monitor_batch_job(job_id, check_interval=10):
    """
    监控批量任务进度
    
    Args:
        job_id (str): 任务ID
        check_interval (int): 检查间隔（秒）
    """
    print(f"开始监控批量任务: {job_id}")
    
    while True:
        status = get_batch_status(job_id)
        if not status:
            break
            
        print(f"状态: {status['status']}")
        print(f"进度: {status['progress_percentage']:.2f}%")
        print(f"已完成: {status['completed_files']}/{status['total_files']}")
        print(f"失败: {status['failed_files']}")
        
        if status['status'] in ['completed', 'failed', 'cancelled']:
            if status['status'] == 'completed' and status.get('results_url'):
                print(f"任务完成！结果下载链接: {status['results_url']}")
            break
            
        time.sleep(check_interval)

# 使用示例
monitor_batch_job(job_id)
```

### 3.3 下载批量结果

```python
def download_batch_results(job_id, save_path="batch_results.zip"):
    """
    下载批量任务结果
    
    Args:
        job_id (str): 任务ID
        save_path (str): 保存路径
    
    Returns:
        bool: 下载是否成功
    """
    url = f"{BASE_URL}/batch/{job_id}/results"
    response = requests.get(url)
    
    if response.status_code == 200:
        with open(save_path, 'wb') as f:
            f.write(response.content)
        print(f"结果已保存到: {save_path}")
        return True
    else:
        print(f"下载失败: {response.status_code}")
        return False

# 使用示例
download_batch_results(job_id, "my_batch_results.zip")
```

## 4. 异步处理

### 4.1 提交异步任务

```python
def submit_async_task(file_path, task_type=None, split_pages=False):
    """
    提交异步处理任务
    
    Args:
        file_path (str): 文件路径
        task_type (str): 任务类型 (可选)
        split_pages (bool): 是否分页处理
    
    Returns:
        dict: 异步任务响应
    """
    url = f"{BASE_URL}/async/parse"
    
    # 准备查询参数
    params = {'split_pages': split_pages}
    if task_type:
        params['task_type'] = task_type
    
    with open(file_path, 'rb') as file:
        files = {'file': file}
        response = requests.post(url, files=files, params=params)
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"请求失败: {response.status_code}")
        return None

# 使用示例
async_result = submit_async_task("large_document.pdf", split_pages=True)
if async_result and async_result['success']:
    task_id = async_result['task_id']
    print(f"异步任务已提交，任务ID: {task_id}")
```

### 4.2 检查异步任务状态

```python
def get_async_task_status(task_id):
    """
    获取异步任务状态
    
    Args:
        task_id (str): 任务ID
    
    Returns:
        dict: 任务状态信息
    """
    url = f"{BASE_URL}/async/task/{task_id}/status"
    response = requests.get(url)
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"请求失败: {response.status_code}")
        return None

def monitor_async_task(task_id, check_interval=5):
    """
    监控异步任务进度
    
    Args:
        task_id (str): 任务ID
        check_interval (int): 检查间隔（秒）
    """
    print(f"开始监控异步任务: {task_id}")
    
    while True:
        status = get_async_task_status(task_id)
        if not status:
            break
            
        print(f"状态: {status['status']}")
        print(f"进度: {status['progress_percentage']:.2f}%")
        print(f"消息: {status['message']}")
        
        if status['status'] in ['completed', 'failed', 'cancelled']:
            if status['status'] == 'completed' and status.get('result_url'):
                print(f"任务完成！结果下载链接: {status['result_url']}")
            elif status['status'] == 'failed':
                print(f"任务失败: {status.get('error_detail', '未知错误')}")
            break
            
        time.sleep(check_interval)

# 使用示例
monitor_async_task(task_id)
```

### 4.3 下载异步任务结果

```python
def download_async_result(task_id, save_path=None):
    """
    下载异步任务结果
    
    Args:
        task_id (str): 任务ID
        save_path (str): 保存路径 (可选)
    
    Returns:
        bool: 下载是否成功
    """
    url = f"{BASE_URL}/async/task/{task_id}/result"
    response = requests.get(url)
    
    if response.status_code == 200:
        if not save_path:
            save_path = f"async_result_{task_id}.zip"
        
        with open(save_path, 'wb') as f:
            f.write(response.content)
        print(f"结果已保存到: {save_path}")
        return True
    else:
        print(f"下载失败: {response.status_code}")
        return False

# 使用示例
download_async_result(task_id, "my_async_result.zip")
```

## 5. 优先级队列处理

### 5.1 提交高优先级任务

```python
def submit_priority_task(file_path, task_type=None, split_pages=False):
    """
    提交高优先级任务（立即处理）
    
    Args:
        file_path (str): 文件路径
        task_type (str): 任务类型 (可选)
        split_pages (bool): 是否分页处理
    
    Returns:
        dict: 优先级任务响应
    """
    url = f"{BASE_URL}/queue/priority"
    
    # 准备查询参数
    params = {'split_pages': split_pages}
    if task_type:
        params['task_type'] = task_type
    
    with open(file_path, 'rb') as file:
        files = {'file': file}
        response = requests.post(url, files=files, params=params)
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"请求失败: {response.status_code}")
        return None

# 使用示例
priority_result = submit_priority_task("urgent_document.pdf")
if priority_result and priority_result['success']:
    task_id = priority_result['task_id']
    print(f"高优先级任务已提交，任务ID: {task_id}")
```

### 5.2 查看队列状态

```python
def get_queue_status():
    """
    获取当前队列状态和处理指标
    
    Returns:
        dict: 队列状态信息
    """
    url = f"{BASE_URL}/queue/status"
    response = requests.get(url)
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"请求失败: {response.status_code}")
        return None

# 使用示例
queue_status = get_queue_status()
if queue_status:
    print("队列状态:")
    print(f"队列大小: {queue_status['queue_size']}")
    print(f"等待结果: {queue_status['pending_results']}")
    print(f"最大队列大小: {queue_status['max_queue_size']}")
    print(f"正在处理: {queue_status['processing']}")
    print(f"每秒请求数: {queue_status['requests_per_second']:.2f}")
    print(f"平均处理时间: {queue_status['average_processing_time']:.2f}秒")
```

## 6. 系统信息和管理

### 6.1 获取模型信息

```python
def get_model_info():
    """
    获取当前模型配置和功能
    
    Returns:
        dict: 模型信息
    """
    url = f"{BASE_URL}/models/info"
    response = requests.get(url)
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"请求失败: {response.status_code}")
        return None

# 使用示例
model_info = get_model_info()
if model_info:
    print("模型信息:")
    print(f"模型名称: {model_info['model_name']}")
    print(f"后端: {model_info['backend']}")
    print(f"支持异步: {model_info['supports_async']}")
    print(f"支持批量: {model_info['supports_batch']}")
    print(f"支持的格式: {', '.join(model_info['supported_formats'])}")
```

### 6.2 列出活动任务

```python
def list_active_tasks():
    """
    列出所有活动的批量任务和异步任务
    
    Returns:
        dict: 活动任务列表
    """
    url = f"{BASE_URL}/tasks/list"
    response = requests.get(url)
    
    if response.status_code == 200:
        return response.json()
    else:
        print(f"请求失败: {response.status_code}")
        return None

# 使用示例
active_tasks = list_active_tasks()
if active_tasks:
    print("活动任务:")
    print(json.dumps(active_tasks, indent=2, ensure_ascii=False))
```

### 6.3 取消任务

```python
def cancel_task(task_id):
    """
    取消正在运行的任务
    
    Args:
        task_id (str): 任务ID
    
    Returns:
        bool: 取消是否成功
    """
    url = f"{BASE_URL}/tasks/{task_id}/cancel"
    response = requests.delete(url)
    
    if response.status_code == 200:
        print(f"任务 {task_id} 已成功取消")
        return True
    else:
        print(f"取消任务失败: {response.status_code}")
        return False

# 使用示例
cancel_task("your-task-id")
```

## 7. 完整使用示例

### 7.1 单文件处理完整流程

```python
def process_single_file_complete(file_path):
    """
    单文件处理的完整流程示例
    """
    print(f"开始处理文件: {file_path}")
    
    # 1. 检查队列状态
    queue_status = get_queue_status()
    if queue_status and queue_status['queue_size'] > 10:
        print("队列较忙，使用异步处理...")
        
        # 提交异步任务
        async_result = submit_async_task(file_path, split_pages=True)
        if async_result and async_result['success']:
            task_id = async_result['task_id']
            print(f"异步任务ID: {task_id}")
            
            # 监控任务进度
            monitor_async_task(task_id)
            
            # 下载结果
            download_async_result(task_id)
    else:
        print("队列空闲，使用同步处理...")
        
        # 直接解析文档
        result = parse_document_split(file_path)
        if result and result['success']:
            print("处理完成!")
            if result.get('download_url'):
                print(f"下载链接: {result['download_url']}")

# 使用示例
process_single_file_complete("my_document.pdf")
```

### 7.2 批量文件处理完整流程

```python
def process_multiple_files_complete(file_paths):
    """
    多文件批量处理的完整流程示例
    """
    print(f"开始批量处理 {len(file_paths)} 个文件")
    
    # 1. 提交批量任务
    batch_result = submit_batch_job(file_paths, split_pages=True, priority="high")
    if not batch_result or not batch_result['success']:
        print("批量任务提交失败")
        return
    
    job_id = batch_result['job_id']
    print(f"批量任务ID: {job_id}")
    
    # 2. 监控批量任务
    monitor_batch_job(job_id, check_interval=15)
    
    # 3. 下载结果
    if download_batch_results(job_id):
        print("批量处理完成！")

# 使用示例
file_list = ["doc1.pdf", "doc2.pdf", "doc3.pdf", "doc4.pdf"]
process_multiple_files_complete(file_list)
```

## 8. 错误处理和最佳实践

### 8.1 通用错误处理

```python
def safe_api_call(func, *args, **kwargs):
    """
    安全的API调用包装器
    """
    try:
        result = func(*args, **kwargs)
        return result
    except requests.exceptions.ConnectionError:
        print("连接错误：请检查网络连接和服务器地址")
        return None
    except requests.exceptions.Timeout:
        print("请求超时：请稍后重试")
        return None
    except requests.exceptions.RequestException as e:
        print(f"请求异常: {e}")
        return None
    except Exception as e:
        print(f"未知错误: {e}")
        return None

# 使用示例
result = safe_api_call(extract_text, "document.pdf")
```

### 8.2 最佳实践建议

1. **文件大小考虑**：
   - 小文件（< 10MB）：使用同步API
   - 大文件（> 10MB）：使用异步API
   - 多个文件：使用批量处理API

2. **任务监控**：
   - 设置合理的检查间隔
   - 实现超时机制
   - 记录任务状态和错误信息

3. **资源管理**：
   - 及时关闭文件句柄
   - 避免同时提交过多任务
   - 定期清理完成的任务

4. **错误处理**：
   - 实现重试机制
   - 记录详细的错误日志
   - 提供用户友好的错误提示

## 9. 常见问题解答

**Q: 支持哪些文件格式？**
A: 支持常见的图像格式（PNG、JPG、JPEG等）和PDF文件。

**Q: 文件大小有限制吗？**
A: 建议单文件不超过100MB，具体限制请参考服务器配置。

**Q: 批量处理最多支持多少文件？**
A: 默认支持的最大批量大小可通过获取模型信息API查询。

**Q: 如何处理中文文档？**
A: MonkeyOCR对中文有良好支持，无需特殊配置。

**Q: API调用频率有限制吗？**
A: 建议合理控制调用频率，避免对服务器造成压力。
