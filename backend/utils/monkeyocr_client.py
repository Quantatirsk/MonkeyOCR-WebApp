"""
MonkeyOCR API Client
Handles communication with the MonkeyOCR API service
"""

import os
import httpx
import asyncio
from typing import Dict, Any, Optional
from pathlib import Path

class MonkeyOCRClient:
    """Client for MonkeyOCR API"""
    
    def __init__(self):
        self.base_url = "https://ocr.teea.cn"
        self.timeout = 300  # 5 minutes timeout
        self.max_retries = 3
        
    async def process_file(
        self,
        file_path: str,
        extract_type: str = "standard",
        split_pages: bool = False
    ) -> Dict[str, Any]:
        """
        Process a file with MonkeyOCR API
        
        Args:
            file_path: Path to the file to process
            extract_type: Type of extraction (standard, split, text, formula, table)
            split_pages: Whether to split pages
            
        Returns:
            Dict containing the API response with download URL
        """
        
        # Determine endpoint based on extract_type
        if extract_type == "split" or split_pages:
            endpoint = "/parse/split"
        else:
            endpoint = "/parse"
            
        url = f"{self.base_url}{endpoint}"
        
        # Prepare file for upload
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
            
        # Prepare form data
        files = {
            "file": (file_path.name, open(file_path, "rb"), self._get_content_type(file_path))
        }
        
        data = {}
        if extract_type != "standard":
            data["type"] = extract_type
            
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                # Make request with retries
                for attempt in range(self.max_retries):
                    try:
                        response = await client.post(url, files=files, data=data)
                        
                        if response.status_code == 200:
                            result = response.json()
                            
                            # Check if the response contains a download URL
                            if "download_url" in result or "url" in result:
                                return {
                                    "success": True,
                                    "download_url": result.get("download_url") or result.get("url"),
                                    "message": result.get("message", "Processing completed"),
                                    "data": result
                                }
                            else:
                                # Handle case where response format is different
                                return {
                                    "success": True,
                                    "download_url": None,
                                    "message": "Processing completed but no download URL provided",
                                    "data": result
                                }
                                
                        elif response.status_code == 429:  # Rate limited
                            if attempt < self.max_retries - 1:
                                wait_time = 2 ** attempt  # Exponential backoff
                                await asyncio.sleep(wait_time)
                                continue
                            else:
                                raise Exception("Rate limited by MonkeyOCR API")
                                
                        else:
                            error_msg = f"MonkeyOCR API error: {response.status_code} - {response.text}"
                            if attempt < self.max_retries - 1:
                                await asyncio.sleep(1)
                                continue
                            else:
                                raise Exception(error_msg)
                                
                    except httpx.TimeoutException:
                        if attempt < self.max_retries - 1:
                            await asyncio.sleep(2)
                            continue
                        else:
                            raise Exception("MonkeyOCR API request timed out")
                            
        finally:
            # Clean up file handle
            for file_info in files.values():
                if hasattr(file_info[1], 'close'):
                    file_info[1].close()
                    
        raise Exception("Failed to process file after all retry attempts")
    
    async def download_result(self, download_url: str, task_id: str) -> str:
        """
        Download the result ZIP file from MonkeyOCR
        
        Args:
            download_url: URL to download the result from
            task_id: Task ID for naming the result file
            
        Returns:
            Path to the downloaded result file
        """
        
        # Create results directory if it doesn't exist
        results_dir = Path("results")
        results_dir.mkdir(exist_ok=True)
        
        # Prepare result file path
        result_file_path = results_dir / f"{task_id}_result.zip"
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                # Download with streaming to handle large files
                async with client.stream("GET", download_url) as response:
                    if response.status_code == 200:
                        with open(result_file_path, "wb") as f:
                            async for chunk in response.aiter_bytes():
                                f.write(chunk)
                        
                        return str(result_file_path)
                    else:
                        raise Exception(f"Failed to download result: {response.status_code} - {response.text}")
                        
        except Exception as e:
            # Clean up partial file if download failed
            if result_file_path.exists():
                result_file_path.unlink()
            raise Exception(f"Download failed: {str(e)}")
    
    async def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """
        Get the status of a MonkeyOCR processing task
        
        Note: This is a placeholder - MonkeyOCR API might not support task status checking
        In practice, you might need to implement polling or use webhooks
        """
        
        # This would be implemented if MonkeyOCR API supports status checking
        # For now, return a default response
        return {
            "success": True,
            "status": "unknown",
            "message": "Status checking not implemented in MonkeyOCR API"
        }
    
    def _get_content_type(self, file_path: Path) -> str:
        """Get content type based on file extension"""
        
        suffix = file_path.suffix.lower()
        content_types = {
            ".pdf": "application/pdf",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp"
        }
        
        return content_types.get(suffix, "application/octet-stream")
    
    async def health_check(self) -> bool:
        """
        Check if MonkeyOCR API is accessible
        """
        
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(self.base_url)
                return response.status_code < 500
        except:
            return False