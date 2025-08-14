"""
MonkeyOCR API Client
Handles communication with the MonkeyOCR API service
"""

import httpx
import asyncio
import socket
import time
from typing import Dict, Any, Optional, TypedDict
from pathlib import Path


class MonkeyOCRError(Exception):
    """Base exception for MonkeyOCR client errors"""
    pass


class MonkeyOCRAPIError(MonkeyOCRError):
    """Exception raised for API-related errors"""
    pass


class MonkeyOCRNetworkError(MonkeyOCRError):
    """Exception raised for network-related errors"""
    pass


class MonkeyOCRDownloadError(MonkeyOCRError):
    """Exception raised for download-related errors"""
    pass


class DNSCacheEntry(TypedDict):
    """Type definition for DNS cache entries"""
    ip: str
    timestamp: float


class MonkeyOCRClient:
    """
    Client for MonkeyOCR API with dynamic DNS resolution
    
    Attributes:
        timeout (int): Request timeout in seconds (default: 300)
        max_retries (int): Maximum number of retry attempts (default: 3)
        dns_cache (Dict[str, DNSCacheEntry]): Cache for DNS resolution results
        dns_cache_ttl (int): Time-to-live for DNS cache entries in seconds (default: 300)
        base_url (str): Dynamically resolved base URL for the API
    """
    
    def __init__(self):
        self.timeout = 300  # 5 minutes timeout
        self.max_retries = 3
        self.dns_cache: Dict[str, DNSCacheEntry] = {}  # Cache for DNS resolution
        self.dns_cache_ttl = 300  # 5 minutes cache TTL
        
        # Initialize base_url with DNS resolution
        self.base_url = self._resolve_base_url()
        
    async def process_file(
        self,
        file_path: str
    ) -> Dict[str, Any]:
        """
        Process a file with MonkeyOCR API
        
        Args:
            file_path: Path to the file to process
            
        Returns:
            Dict containing the API response with download URL
        """
        
        # Always use standard parse endpoint
        endpoint = "/parse"
        url = f"{self.base_url}{endpoint}"
        
        # Prepare file for upload
        file_path_obj = Path(file_path)
        if not file_path_obj.exists():
            raise FileNotFoundError(f"File not found: {file_path_obj}")
            
        # Prepare form data - using context manager to ensure file is closed
        file_handle = open(file_path_obj, "rb")
        files = {
            "file": (file_path_obj.name, file_handle, self._get_content_type(file_path_obj))
        }
        
        # No additional data needed for standard mode
        data = {}
            
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
                                raise MonkeyOCRAPIError("Rate limited by MonkeyOCR API")
                                
                        else:
                            error_msg = f"MonkeyOCR API error: {response.status_code} - {response.text}"
                            if attempt < self.max_retries - 1:
                                await asyncio.sleep(1)
                                continue
                            else:
                                raise MonkeyOCRAPIError(error_msg)
                                
                    except httpx.TimeoutException:
                        if attempt < self.max_retries - 1:
                            await asyncio.sleep(2)
                            continue
                        else:
                            raise MonkeyOCRNetworkError("MonkeyOCR API request timed out")
                            
        finally:
            # Clean up file handle
            if 'file_handle' in locals():
                file_handle.close()
                    
        raise MonkeyOCRAPIError("Failed to process file after all retry attempts")
    
    async def download_result(self, download_url: str, task_id: str) -> str:
        """
        Download the result ZIP file from MonkeyOCR
        
        Args:
            download_url: URL to download the result from
            task_id: Task ID for naming the result file
            
        Returns:
            Path to the downloaded result file
        """
        
        # Ensure download URL has proper protocol
        if not download_url.startswith(('http://', 'https://')):
            # If it's a relative URL, prepend the base URL
            if download_url.startswith('/'):
                download_url = self.base_url.rstrip('/') + download_url
            else:
                download_url = f"{self.base_url.rstrip('/')}/{download_url}"
        
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
                        raise MonkeyOCRDownloadError(f"Failed to download result: {response.status_code} - {response.text}")
                        
        except Exception as e:
            # Clean up partial file if download failed
            if result_file_path.exists():
                result_file_path.unlink()
            raise MonkeyOCRDownloadError(f"Download failed: {str(e)}")
    
    async def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """
        Get the status of a MonkeyOCR processing task
        
        Args:
            task_id: The task ID to check status for
            
        Returns:
            Dict containing task status information
        
        Note: This is a placeholder - MonkeyOCR API might not support task status checking
        In practice, you might need to implement polling or use webhooks
        """
        
        # This would be implemented if MonkeyOCR API supports status checking
        # For now, return a default response
        # task_id parameter is kept for API compatibility
        _ = task_id  # Mark as intentionally unused
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
    
    def _resolve_dns(self, hostname: str) -> Optional[str]:
        """
        Resolve hostname to IP address with caching
        
        Args:
            hostname: The hostname to resolve
            
        Returns:
            IP address string or None if resolution fails
        """
        current_time = time.time()
        
        # Check cache first
        if hostname in self.dns_cache:
            cached_entry = self.dns_cache[hostname]
            if current_time - cached_entry['timestamp'] < self.dns_cache_ttl:
                return cached_entry['ip']
        
        try:
            # Resolve hostname to IP
            ip_address = socket.gethostbyname(hostname)
            
            # Cache the result
            self.dns_cache[hostname] = DNSCacheEntry(
                ip=ip_address,
                timestamp=current_time
            )
            
            return ip_address
            
        except socket.gaierror as e:
            print(f"DNS resolution failed for {hostname}: {e}")
            return None
    
    def _resolve_base_url(self) -> str:
        """
        Resolve the base URL by querying DNS for diamond.vect.one
        
        Returns:
            The resolved base URL
            
        Raises:
            MonkeyOCRNetworkError: If DNS resolution fails
        """
        hostname = "diamond.vect.one"
        port = 18001
        
        try:
            ip_address = self._resolve_dns(hostname)
            
            if ip_address:
                resolved_url = f"http://{ip_address}:{port}"
                print(f"Resolved MonkeyOCR base URL: {resolved_url} (from {hostname})")
                return resolved_url
            else:
                raise MonkeyOCRNetworkError(f"Failed to resolve DNS for {hostname}")
                
        except MonkeyOCRNetworkError:
            raise
        except Exception as e:
            raise MonkeyOCRNetworkError(f"Error resolving base URL for {hostname}: {e}")
    
    def refresh_base_url(self) -> str:
        """
        Force refresh of the base URL by clearing cache and re-resolving
        
        Returns:
            The new base URL
        """
        # Clear DNS cache for the hostname
        hostname = "diamond.vect.one"
        if hostname in self.dns_cache:
            del self.dns_cache[hostname]
        
        # Re-resolve base URL
        self.base_url = self._resolve_base_url()
        return self.base_url
    
    async def health_check(self, retry_with_refresh: bool = True) -> bool:
        """
        Check if MonkeyOCR API is accessible
        
        Args:
            retry_with_refresh: If True, try refreshing base URL on failure
            
        Returns:
            True if API is accessible, False otherwise
        """
        
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(self.base_url)
                if response.status_code < 500:
                    return True
                else:
                    print(f"Health check failed with status {response.status_code}")
                    
        except Exception as e:
            print(f"Health check failed: {e}")
        
        # If initial health check failed and retry is enabled, try refreshing URL
        if retry_with_refresh:
            print("Attempting to refresh base URL and retry health check...")
            try:
                old_url = self.base_url
                new_url = self.refresh_base_url()
                
                if new_url != old_url:
                    print(f"Base URL changed from {old_url} to {new_url}, retrying health check...")
                    return await self.health_check(retry_with_refresh=False)  # Prevent infinite recursion
                else:
                    print("Base URL unchanged after refresh")
            except MonkeyOCRNetworkError as e:
                print(f"Failed to refresh base URL: {e}")
                # Can't refresh, return the original failure
        
        return False