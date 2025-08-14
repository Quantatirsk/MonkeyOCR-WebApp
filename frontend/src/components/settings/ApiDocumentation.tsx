/**
 * API Documentation Component
 * Displays API usage documentation with example code
 */

import React from 'react';
import { FileText, Copy, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import BlockMarkdownViewer from '@/components/markdown/BlockMarkdownViewer';
import './api-documentation.css';

interface ApiDocumentationProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiDocumentation: React.FC<ApiDocumentationProps> = ({ isOpen, onClose }) => {
  const { token } = useAuthStore();
  
  // Generate API documentation with current user's token
  const generateDocumentation = () => {
    const baseUrl = window.location.origin;
    const tokenDisplay = token || 'YOUR_API_TOKEN';
    
    return `# MonkeyOCR WebApp API 文档

## 认证

所有 API 请求都需要在请求头中包含 JWT Token：

\`\`\`
Authorization: Bearer ${tokenDisplay}
\`\`\`

## Python 示例代码

### 安装依赖

\`\`\`bash
pip install requests

# 如果需要自动解压功能，Python已内置zipfile模块，无需额外安装
\`\`\`

### 完整示例

\`\`\`python
import requests
import time
import mimetypes
import zipfile
import shutil
from pathlib import Path

class MonkeyOCRClient:
    """MonkeyOCR WebApp API 客户端"""
    
    def __init__(self, base_url="${baseUrl}", token="${tokenDisplay}"):
        self.base_url = base_url.rstrip('/')
        self.token = token
        self.headers = {
            "Authorization": f"Bearer {self.token}"
        }
    
    def upload_file(self, file_path, ocr_option="basic"):
        """
        上传文件进行 OCR 识别
        
        Args:
            file_path: 文件路径
            ocr_option: OCR 选项 ("basic", "format", "markdown")
        
        Returns:
            任务 ID
        """
        url = f"{self.base_url}/api/upload"
        
        # 获取文件的 MIME 类型
        file_path = Path(file_path)
        mime_type, _ = mimetypes.guess_type(str(file_path))
        
        # 如果无法猜测 MIME 类型，根据扩展名设置
        if not mime_type:
            ext = file_path.suffix.lower()
            mime_map = {
                '.pdf': 'application/pdf',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.webp': 'image/webp'
            }
            mime_type = mime_map.get(ext, 'application/octet-stream')
        
        with open(file_path, 'rb') as f:
            files = {'file': (file_path.name, f, mime_type)}
            data = {'ocr_option': ocr_option}
            
            response = requests.post(
                url, 
                files=files, 
                data=data,
                headers=self.headers
            )
        
        if response.status_code == 200:
            result = response.json()
            # API 返回包装的响应格式
            if result.get('success'):
                task_data = result.get('data', {})
                return task_data.get('id')
            else:
                raise Exception(f"API返回失败: {result.get('message')}")
        else:
            raise Exception(f"上传失败: {response.text}")
    
    def get_task_status(self, task_id):
        """
        获取任务状态
        
        Args:
            task_id: 任务 ID
        
        Returns:
            任务状态信息
        """
        url = f"{self.base_url}/api/tasks/{task_id}/status"
        response = requests.get(url, headers=self.headers)
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                return result.get('data', {})
            else:
                raise Exception(f"API返回失败: {result.get('message')}")
        else:
            raise Exception(f"获取状态失败: {response.text}")
    
    def get_task_result(self, task_id):
        """
        获取任务结果
        
        Args:
            task_id: 任务 ID
        
        Returns:
            OCR 识别结果
        """
        url = f"{self.base_url}/api/tasks/{task_id}/result"
        response = requests.get(url, headers=self.headers)
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                return result.get('data', {})
            else:
                raise Exception(f"API返回失败: {result.get('message')}")
        else:
            raise Exception(f"获取结果失败: {response.text}")
    
    def wait_for_completion(self, task_id, timeout=300):
        """
        等待任务完成
        
        Args:
            task_id: 任务 ID
            timeout: 超时时间（秒）
        
        Returns:
            任务结果
        """
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            status = self.get_task_status(task_id)
            
            if status['status'] == 'completed':
                return self.get_task_result(task_id)
            elif status['status'] == 'failed':
                raise Exception(f"任务失败: {status.get('error', '未知错误')}")
            
            time.sleep(2)  # 每2秒检查一次
        
        raise TimeoutError(f"任务超时: {timeout}秒")
    
    def process_document(self, file_path, ocr_option="markdown"):
        """
        完整的文档处理流程
        
        Args:
            file_path: 文件路径
            ocr_option: OCR 选项
        
        Returns:
            处理结果
        """
        print(f"上传文件: {file_path}")
        task_id = self.upload_file(file_path, ocr_option)
        print(f"任务ID: {task_id}")
        
        print("等待处理...")
        result = self.wait_for_completion(task_id)
        
        print("处理完成!")
        return result
    
    def download_result(self, download_url, output_path="result.zip"):
        """
        下载OCR结果文件
        
        Args:
            download_url: 下载链接
            output_path: 保存路径
        
        Returns:
            下载是否成功
        """
        try:
            # 如果是相对路径，拼接基础URL
            if download_url.startswith('/'):
                full_url = f"{self.base_url}{download_url}"
            else:
                full_url = download_url
            
            print(f"下载文件: {full_url}")
            
            response = requests.get(full_url, headers=self.headers, stream=True)
            
            if response.status_code == 200:
                with open(output_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                print(f"文件已保存到: {output_path}")
                return True
            else:
                print(f"下载失败 (HTTP {response.status_code}): {response.text}")
                return False
        except Exception as e:
            print(f"下载错误: {e}")
            return False
    
    def extract_result(self, zip_path, extract_dir=None):
        """
        解压OCR结果文件
        
        Args:
            zip_path: ZIP文件路径
            extract_dir: 解压目录，如果为None则自动生成
        
        Returns:
            解压目录路径
        """
        try:
            zip_path = Path(zip_path)
            
            # 如果没有指定解压目录，使用ZIP文件名（不带扩展名）
            if extract_dir is None:
                extract_dir = zip_path.stem
            
            extract_dir = Path(extract_dir)
            
            # 如果目录已存在，先删除
            if extract_dir.exists():
                print(f"目录 {extract_dir} 已存在，删除旧目录...")
                shutil.rmtree(extract_dir)
            
            # 创建目录并解压
            extract_dir.mkdir(parents=True, exist_ok=True)
            
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
            
            print(f"✅ 文件已解压到: {extract_dir}")
            
            # 列出解压的文件
            files = list(extract_dir.rglob('*'))
            print(f"  解压文件数: {len([f for f in files if f.is_file()])} 个")
            
            # 显示主要文件
            md_files = list(extract_dir.glob('*.md'))
            if md_files:
                print(f"  Markdown文件: {', '.join([f.name for f in md_files])}")
            
            img_files = list(extract_dir.rglob('*.png')) + list(extract_dir.rglob('*.jpg'))
            if img_files:
                print(f"  图片文件: {len(img_files)} 个")
            
            return str(extract_dir)
            
        except Exception as e:
            print(f"解压错误: {e}")
            return None

# 使用示例
if __name__ == "__main__":
    # 初始化客户端
    client = MonkeyOCRClient()
    
    # 设置要处理的文件
    input_file = "example.pdf"
    
    # 处理单个文档
    try:
        result = client.process_document(input_file)
        
        # 打印结果结构
        print(f"\\n返回的结果字段: {result.keys()}")
        
        # 获取各个字段
        task_id = result.get('task_id')
        markdown_content = result.get('markdown_content', '')
        download_url = result.get('download_url')
        metadata = result.get('metadata', {})
        
        # 使用原始文件名（不带扩展名）作为基础名称
        base_name = Path(input_file).stem
        
        # 创建以文件名命名的目录
        output_dir = Path(base_name)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # 先下载并解压完整结果包
        if download_url:
            print(f"\\n下载URL: {download_url}")
            
            # 下载ZIP文件到临时位置
            temp_zip = f"{task_id}_result.zip" if task_id else f"{base_name}_result.zip"
            
            if client.download_result(download_url, temp_zip):
                print(f"✅ 完整结果已下载")
                
                # 解压到目标目录
                print(f"开始解压文件...")
                if client.extract_result(temp_zip, str(output_dir)):
                    print(f"✅ 文件已解压到: {output_dir}/")
                    
                    # 删除临时ZIP文件
                    Path(temp_zip).unlink()
                    print(f"✅ 已清理临时文件")
            else:
                print("❌ 下载失败")
        
        # 然后保存 Markdown 结果（这样不会被解压覆盖）
        if markdown_content:
            md_filename = output_dir / f"{base_name}.md"
            with open(md_filename, "w", encoding="utf-8") as f:
                f.write(markdown_content)
            print(f"✅ Markdown内容已保存到: {md_filename}")
        
        # 输出最终结果
        print(f"\\n🎉 处理完成！")
        print(f"  - 结果目录: {output_dir}/")
        print(f"  - Markdown文件: {output_dir}/{base_name}.md")
        if (output_dir / "images").exists():
            print(f"  - 图片文件: {output_dir}/images/")
        else:
            print("\\n⚠️ 未识别到文档图片，已跳过")
        
        # 显示元数据信息
        if metadata:
            print(f"\\n📊 文档信息:")
            for key, value in metadata.items():
                print(f"  - {key}: {value}")
        
    except Exception as e:
        print(f"❌ 错误: {e}")
\`\`\`

## API 端点详细说明

### 1. 文件上传

**端点**: \`POST /api/upload\`

**请求头**:
- \`Authorization: Bearer {token}\`

**请求体** (multipart/form-data):
- \`file\`: 要上传的文件（支持 PDF, JPG, PNG, WEBP）
- \`ocr_option\`: OCR 选项
  - \`"basic"\`: 基础识别
  - \`"format"\`: 保留格式
  - \`"markdown"\`: Markdown 格式（推荐）

**响应示例**:
\`\`\`json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "created_at": "2024-01-13T10:00:00Z"
}
\`\`\`

### 2. 获取任务状态

**端点**: \`GET /api/tasks/{task_id}/status\`

**响应示例**:
\`\`\`json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "progress": 100,
  "created_at": "2024-01-13T10:00:00Z",
  "completed_at": "2024-01-13T10:01:30Z"
}
\`\`\`

### 3. 获取任务结果

**端点**: \`GET /api/tasks/{task_id}/result\`

**响应示例**:
\`\`\`json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "markdown_content": "# 文档标题\\n\\n文档内容...",
  "page_count": 10,
  "blocks": [
    {
      "type": "text",
      "content": "段落内容",
      "page": 1
    }
  ]
}
\`\`\`

### 4. 获取任务列表

**端点**: \`GET /api/tasks\`

**查询参数**:
- \`limit\`: 返回数量（默认: 10）
- \`offset\`: 偏移量（默认: 0）

**响应示例**:
\`\`\`json
{
  "tasks": [
    {
      "task_id": "550e8400-e29b-41d4-a716-446655440000",
      "filename": "document.pdf",
      "status": "completed",
      "created_at": "2024-01-13T10:00:00Z"
    }
  ],
  "total": 25
}
\`\`\`

## 错误处理

API 使用标准 HTTP 状态码：

- \`200\`: 成功
- \`400\`: 请求参数错误
- \`401\`: 未授权（Token 无效或过期）
- \`404\`: 资源未找到
- \`429\`: 请求过于频繁
- \`500\`: 服务器错误

错误响应格式：
\`\`\`json
{
  "error": "错误信息",
  "detail": "详细错误描述"
}
\`\`\`

## 注意事项

1. **文件大小限制**: 单个文件最大 50MB
2. **支持格式**: PDF, JPG, PNG, WEBP
3. **并发限制**: 每个用户最多 5 个并发任务
4. **Token 有效期**: 24 小时，过期需重新登录获取
5. **速率限制**: 
   - 上传: 100 次/分钟
   - 查询: 600 次/分钟

## 更多示例

### 批量处理文档 - 完整示例

\`\`\`python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量处理 PDF 文档的完整示例
使用方法: python batch_process.py /path/to/pdfs /path/to/output
"""

import os
import sys
import time
import json
import logging
import mimetypes
import zipfile
import shutil
from pathlib import Path
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('batch_process.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class MonkeyOCRClient:
    """MonkeyOCR WebApp API 客户端"""
    
    def __init__(self, base_url="${baseUrl}", token="${tokenDisplay}"):
        self.base_url = base_url.rstrip('/')
        self.token = token
        self.headers = {
            "Authorization": f"Bearer {self.token}"
        }
        self.session = requests.Session()
        self.session.headers.update(self.headers)
    
    def upload_file(self, file_path, ocr_option="markdown"):
        """上传文件进行 OCR 识别"""
        url = f"{self.base_url}/api/upload"
        
        # 获取文件的 MIME 类型
        file_path = Path(file_path)
        mime_type, _ = mimetypes.guess_type(str(file_path))
        
        # 如果无法猜测 MIME 类型，根据扩展名设置
        if not mime_type:
            ext = file_path.suffix.lower()
            mime_map = {
                '.pdf': 'application/pdf',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.webp': 'image/webp'
            }
            mime_type = mime_map.get(ext, 'application/octet-stream')
        
        with open(file_path, 'rb') as f:
            files = {'file': (file_path.name, f, mime_type)}
            data = {'ocr_option': ocr_option}
            
            response = self.session.post(url, files=files, data=data)
        
        if response.status_code == 200:
            result = response.json()
            # API 返回包装的响应格式
            if result.get('success'):
                task_data = result.get('data', {})
                return task_data.get('id')
            else:
                raise Exception(f"API返回失败: {result.get('message')}")
        else:
            raise Exception(f"上传失败: {response.text}")
    
    def get_task_status(self, task_id):
        """获取任务状态"""
        url = f"{self.base_url}/api/tasks/{task_id}/status"
        response = self.session.get(url)
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                return result.get('data', {})
            else:
                raise Exception(f"API返回失败: {result.get('message')}")
        else:
            raise Exception(f"获取状态失败: {response.text}")
    
    def get_task_result(self, task_id):
        """获取任务结果"""
        url = f"{self.base_url}/api/tasks/{task_id}/result"
        response = self.session.get(url)
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                return result.get('data', {})
            else:
                raise Exception(f"API返回失败: {result.get('message')}")
        else:
            raise Exception(f"获取结果失败: {response.text}")
    
    def wait_for_completion(self, task_id, timeout=300):
        """等待任务完成"""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            status = self.get_task_status(task_id)
            
            if status['status'] == 'completed':
                return self.get_task_result(task_id)
            elif status['status'] == 'failed':
                raise Exception(f"任务失败: {status.get('error', '未知错误')}")
            
            time.sleep(2)
        
        raise TimeoutError(f"任务超时: {timeout}秒")
    
    def process_document_with_retry(self, file_path, max_retries=3):
        """带重试机制的文档处理"""
        for attempt in range(max_retries):
            try:
                logger.info(f"处理文件: {file_path} (尝试 {attempt + 1}/{max_retries})")
                
                # 上传文件
                task_id = self.upload_file(file_path)
                logger.info(f"任务ID: {task_id}")
                
                # 等待处理完成
                result = self.wait_for_completion(task_id)
                logger.info(f"文件处理成功: {file_path}")
                return result
                
            except Exception as e:
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    logger.warning(f"处理失败，{wait_time}秒后重试: {e}")
                    time.sleep(wait_time)
                else:
                    logger.error(f"处理失败，已达最大重试次数: {e}")
                    raise
    
    def download_result(self, download_url, output_path):
        """下载OCR结果文件"""
        try:
            # 如果是相对路径，拼接基础URL
            if download_url.startswith('/'):
                full_url = f"{self.base_url}{download_url}"
            else:
                full_url = download_url
            
            response = self.session.get(full_url, stream=True)
            
            if response.status_code == 200:
                with open(output_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                return True
            else:
                logger.error(f"下载失败 (HTTP {response.status_code})")
                return False
        except Exception as e:
            logger.error(f"下载错误: {e}")
            return False
    
    def extract_result(self, zip_path, extract_dir):
        """解压OCR结果文件"""
        try:
            zip_path = Path(zip_path)
            extract_dir = Path(extract_dir)
            
            # 如果目录已存在，先删除
            if extract_dir.exists():
                shutil.rmtree(extract_dir)
            
            # 创建目录并解压
            extract_dir.mkdir(parents=True, exist_ok=True)
            
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
            
            return str(extract_dir)
            
        except Exception as e:
            logger.error(f"解压错误: {e}")
            return None


def process_single_file(client, file_path, output_dir):
    """处理单个文件"""
    try:
        # 处理文档
        result = client.process_document_with_retry(file_path)
        
        # 生成基础名称
        base_name = Path(file_path).stem
        
        # 为每个文件创建独立的输出目录
        file_output_dir = Path(output_dir) / base_name
        file_output_dir.mkdir(parents=True, exist_ok=True)
        
        # 先下载并解压完整结果
        download_url = result.get('download_url')
        if download_url:
            # 下载ZIP文件到临时位置
            task_id = result.get('task_id', base_name)
            temp_zip = Path(output_dir) / f"temp_{task_id}.zip"
            
            if client.download_result(download_url, str(temp_zip)):
                # 解压到文件目录
                client.extract_result(str(temp_zip), str(file_output_dir))
                logger.info(f"结果已解压到: {file_output_dir}")
                
                # 删除临时ZIP文件
                temp_zip.unlink()
        
        # 然后保存 Markdown 内容（这样不会被解压覆盖）
        markdown_content = result.get('markdown_content', '')
        if markdown_content:
            output_path = file_output_dir / f"{base_name}.md"
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(markdown_content)
            logger.info(f"Markdown已保存: {output_path}")
        
        # 最后保存元数据
        metadata_path = file_output_dir / "metadata.json"
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump({
                'task_id': result.get('task_id'),
                'processed_at': datetime.now().isoformat(),
                'source_file': str(file_path),
                'metadata': result.get('metadata', {})
            }, f, ensure_ascii=False, indent=2)
        
        return True, f"✅ {Path(file_path).name} → {file_output_dir}"
        
    except Exception as e:
        return False, f"❌ {Path(file_path).name} 处理失败: {e}"


def batch_process_documents(input_dir, output_dir, max_workers=3):
    """批量处理文档主函数"""
    
    # 创建输出目录
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    # 查找所有支持的文件
    supported_extensions = ['.pdf', '.jpg', '.jpeg', '.png', '.webp']
    files_to_process = []
    
    for ext in supported_extensions:
        files_to_process.extend(Path(input_dir).glob(f'*{ext}'))
        files_to_process.extend(Path(input_dir).glob(f'*{ext.upper()}'))
    
    if not files_to_process:
        logger.warning(f"未找到可处理的文件在: {input_dir}")
        return
    
    logger.info(f"找到 {len(files_to_process)} 个文件待处理")
    
    # 初始化客户端
    client = MonkeyOCRClient()
    
    # 统计信息
    success_count = 0
    failed_count = 0
    results = []
    
    # 使用线程池并发处理
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # 提交所有任务
        futures = {
            executor.submit(process_single_file, client, file_path, output_dir): file_path
            for file_path in files_to_process
        }
        
        # 处理完成的任务
        for future in as_completed(futures):
            file_path = futures[future]
            success, message = future.result()
            
            if success:
                success_count += 1
            else:
                failed_count += 1
            
            results.append({
                'file': str(file_path),
                'success': success,
                'message': message
            })
            
            logger.info(message)
            logger.info(f"进度: {success_count + failed_count}/{len(files_to_process)}")
    
    # 生成处理报告
    report_path = Path(output_dir) / 'processing_report.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump({
            'total_files': len(files_to_process),
            'success_count': success_count,
            'failed_count': failed_count,
            'processed_at': datetime.now().isoformat(),
            'results': results
        }, f, ensure_ascii=False, indent=2)
    
    # 输出总结
    logger.info("=" * 50)
    logger.info(f"批量处理完成！")
    logger.info(f"成功: {success_count} 个文件")
    logger.info(f"失败: {failed_count} 个文件")
    logger.info(f"输出目录: {output_dir}")
    logger.info(f"处理报告: {report_path}")


def main():
    """主函数"""
    if len(sys.argv) != 3:
        print("使用方法: python batch_process.py <输入目录> <输出目录>")
        print("示例: python batch_process.py ./pdfs ./output")
        sys.exit(1)
    
    input_dir = sys.argv[1]
    output_dir = sys.argv[2]
    
    if not Path(input_dir).exists():
        logger.error(f"输入目录不存在: {input_dir}")
        sys.exit(1)
    
    # 开始批量处理
    start_time = time.time()
    
    try:
        batch_process_documents(input_dir, output_dir, max_workers=3)
    except KeyboardInterrupt:
        logger.info("用户中断处理")
    except Exception as e:
        logger.error(f"批量处理出错: {e}", exc_info=True)
    finally:
        elapsed_time = time.time() - start_time
        logger.info(f"总耗时: {elapsed_time:.2f} 秒")


if __name__ == "__main__":
    main()
\`\`\`

### 使用示例

1. **保存脚本**：将上面的代码保存为 \`batch_process.py\`

2. **准备文件**：将要处理的 PDF、图片文件放在一个目录中

3. **运行脚本**：
\`\`\`bash
# 处理 pdfs 目录中的所有文件，输出到 output 目录
python batch_process.py ./pdfs ./output

# 处理特定目录
python batch_process.py /Users/username/Documents/scans /Users/username/Documents/ocr_results
\`\`\`

4. **查看结果**：
   每个文件的结果保存在独立目录中：
   - \`output/文件名/\` - 文件的完整结果目录
     - \`文件名.md\` - Markdown内容
     - \`images/\` - 提取的图片
     - \`metadata.json\` - 处理元数据
   - \`output/processing_report.json\` - 批量处理报告
   - \`batch_process.log\` - 处理日志

### 高级配置示例

\`\`\`python
# 自定义配置的批量处理
import configparser

# 读取配置文件
config = configparser.ConfigParser()
config.read('config.ini')

# 使用配置初始化客户端
client = MonkeyOCRClient(
    base_url=config.get('api', 'base_url'),
    token=config.get('api', 'token')
)

# 自定义并发数
max_workers = config.getint('processing', 'max_workers', fallback=3)

# 开始处理
batch_process_documents(
    input_dir=config.get('paths', 'input_dir'),
    output_dir=config.get('paths', 'output_dir'),
    max_workers=max_workers
)
\`\`\`

### 配置文件示例 (config.ini)

\`\`\`ini
[api]
base_url = ${baseUrl}
token = ${tokenDisplay}

[processing]
max_workers = 5
timeout = 600
max_retries = 3

[paths]
input_dir = ./documents
output_dir = ./ocr_results
\`\`\`
`;
  };

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(generateDocumentation());
      toast.success('文档已复制到剪贴板', { duration: 2000 });
    } catch (error) {
      toast.error('复制失败，请手动选择复制');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              API 调用文档
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyAll}
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                复制全部
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-1">
          <BlockMarkdownViewer
            content={generateDocumentation()}
            className="api-documentation"
            fontSize={90}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};