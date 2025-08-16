import requests
import time
import mimetypes
import zipfile
import shutil
from pathlib import Path

class MonkeyOCRClient:
    """MonkeyOCR WebApp API 客户端"""
    
    def __init__(self, base_url="https://ocr.teea.cn", token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMSIsInVzZXJuYW1lIjoiZGVtbyIsImVtYWlsIjoiZGVtb0BleGFtcGxlLmNvbSIsImV4cCI6MTc1NTIzNDc1MSwiaWF0IjoxNzU1MTQ4MzUxfQ.PElzNzNgsHxGOK_d3gf_wA4FnivCx_ZhzX_HC0pEbUY"):
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
        print(f"\n返回的结果字段: {result.keys()}")
        
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
            print(f"\n下载URL: {download_url}")
            
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
        print(f"\n🎉 处理完成！")
        print(f"  - 结果目录: {output_dir}/")
        print(f"  - Markdown文件: {output_dir}/{base_name}.md")
        if (output_dir / "images").exists():
            print(f"  - 图片文件: {output_dir}/images/")
        else:
            print("\n⚠️ 未识别到文档图片，已跳过")
        
        # 显示元数据信息
        if metadata:
            print(f"\n📊 文档信息:")
            for key, value in metadata.items():
                print(f"  - {key}: {value}")
        
    except Exception as e:
        print(f"❌ 错误: {e}")