"""
File Handler Utility
Manages file operations, temporary files, and result processing
"""

import os
import shutil
import tempfile
import zipfile
import re
import logging
from pathlib import Path
from typing import List, Optional, Dict, Any
import aiofiles
from models import ImageResource, DocumentResult, DocumentMetadata

logger = logging.getLogger(__name__)

try:
    import PyPDF2
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False
    logger.warning("PyPDF2 not available, PDF page counting disabled")

class FileHandler:
    """Handles file operations for the MonkeyOCR WebApp"""
    
    def __init__(self):
        self.temp_dir = Path("temp")
        self.results_dir = Path("results") 
        self.static_dir = Path("static")
        self.uploads_dir = Path("uploads")
        
        # Create directories if they don't exist
        for directory in [self.temp_dir, self.results_dir, self.static_dir, self.uploads_dir]:
            directory.mkdir(exist_ok=True)
    
    async def save_temp_file(self, file_content: bytes, filename: str) -> str:
        """
        Save uploaded file content to a temporary file
        
        Args:
            file_content: The file content as bytes
            filename: Original filename
            
        Returns:
            Path to the temporary file
        """
        
        # Create a unique temporary file
        file_extension = Path(filename).suffix
        temp_file = tempfile.NamedTemporaryFile(
            dir=self.temp_dir,
            suffix=file_extension,
            delete=False
        )
        
        try:
            async with aiofiles.open(temp_file.name, 'wb') as f:
                await f.write(file_content)
            
            return temp_file.name
            
        except Exception as e:
            # Clean up on failure
            if os.path.exists(temp_file.name):
                os.unlink(temp_file.name)
            raise Exception(f"Failed to save temporary file: {str(e)}")
    
    async def save_original_file(self, task_id: str, file_content: bytes, filename: str) -> str:
        """
        Save original file for a specific task
        
        Args:
            task_id: Task ID
            file_content: The file content as bytes
            filename: Original filename
            
        Returns:
            Path to the saved original file
        """
        
        # Create task-specific directory
        task_uploads_dir = self.uploads_dir / task_id
        task_uploads_dir.mkdir(exist_ok=True)
        
        # Save original file
        original_file_path = task_uploads_dir / filename
        
        try:
            async with aiofiles.open(original_file_path, 'wb') as f:
                await f.write(file_content)
            
            logger.info(f"Saved original file for task {task_id}: {filename}")
            return str(original_file_path)
            
        except Exception as e:
            raise Exception(f"Failed to save original file: {str(e)}")
    
    def get_original_file(self, task_id: str, filename: Optional[str] = None) -> Optional[str]:
        """
        Get the path to the original file for a task
        
        Args:
            task_id: Task ID
            filename: Original filename (optional, will look for any file if not provided)
            
        Returns:
            Path to the original file, or None if not found
        """
        
        task_uploads_dir = self.uploads_dir / task_id
        
        if filename:
            # Look for specific file
            original_file_path = task_uploads_dir / filename
            return str(original_file_path) if original_file_path.exists() else None
        else:
            # Look for any file in the task directory
            if task_uploads_dir.exists():
                for file_path in task_uploads_dir.iterdir():
                    if file_path.is_file():
                        return str(file_path)
            return None
    
    async def process_result_zip(self, zip_path: str, task_id: str) -> DocumentResult:
        """
        Process the ZIP file returned by MonkeyOCR API
        
        Args:
            zip_path: Path to the downloaded ZIP file
            task_id: Task ID for organizing files
            
        Returns:
            DocumentResult with processed content and images
        """
        
        # Create task-specific directory in static folder
        task_static_dir = self.static_dir / task_id
        task_static_dir.mkdir(exist_ok=True)
        
        try:
            # Extract ZIP file
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(task_static_dir)
            
            # Find markdown files and images
            markdown_files = list(task_static_dir.glob("*.md"))
            images_dir = task_static_dir / "images"
            
            if not markdown_files:
                raise ValueError("No markdown files found in the result ZIP")
            
            # Process the main markdown file (usually the first one)
            main_md_file = markdown_files[0]
            
            async with aiofiles.open(main_md_file, 'r', encoding='utf-8') as f:
                markdown_content = await f.read()
            
            # Process images
            images = []
            if images_dir.exists():
                for image_file in images_dir.iterdir():
                    if image_file.is_file() and self._is_image_file(image_file):
                        # Create static URL for the image
                        relative_path = f"{task_id}/images/{image_file.name}"
                        static_url = f"/static/{relative_path}"
                        
                        images.append(ImageResource(
                            filename=image_file.name,
                            path=str(image_file),
                            url=static_url,
                            alt=f"Image from {main_md_file.stem}"
                        ))
            
            # Fix image paths in markdown to point to our static URLs
            markdown_content = self._fix_markdown_image_paths(markdown_content, task_id)
            
            # Generate metadata
            metadata = self._generate_metadata(
                zip_path, 
                markdown_content, 
                len(images),
                "standard"  # This should be passed from the processing request
            )
            
            # Create document result
            result = DocumentResult(
                task_id=task_id,
                markdown_content=markdown_content,
                images=images,
                download_url=f"/api/download/{task_id}",
                metadata=metadata
            )
            
            return result
            
        except Exception as e:
            # Clean up on failure
            if task_static_dir.exists():
                shutil.rmtree(task_static_dir)
            raise Exception(f"Failed to process result ZIP: {str(e)}")
    
    def _fix_markdown_image_paths(self, markdown_content: str, task_id: str) -> str:
        """
        Fix image paths in markdown to point to static URLs
        
        Args:
            markdown_content: Original markdown content
            task_id: Task ID for constructing static URLs
            
        Returns:
            Modified markdown content with corrected image paths
        """
        
        # Pattern to match markdown image syntax: ![alt](path)
        image_pattern = r'!\[([^\]]*)\]\(([^)]+)\)'
        
        def replace_image_path(match):
            alt_text = match.group(1)
            original_path = match.group(2)
            
            # Extract filename from the original path
            filename = Path(original_path).name
            
            # Create new static URL
            new_url = f"/static/{task_id}/images/{filename}"
            
            return f"![{alt_text}]({new_url})"
        
        # Replace all image paths
        fixed_content = re.sub(image_pattern, replace_image_path, markdown_content)
        
        return fixed_content
    
    def _is_image_file(self, file_path: Path) -> bool:
        """Check if a file is an image based on its extension"""
        
        image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'}
        return file_path.suffix.lower() in image_extensions
    
    def _generate_metadata(
        self, 
        zip_path: str, 
        markdown_content: str, 
        image_count: int,
        extraction_type: str
    ) -> DocumentMetadata:
        """
        Generate metadata for the document result
        
        Args:
            zip_path: Path to the result ZIP file
            markdown_content: Processed markdown content
            image_count: Number of images found
            extraction_type: Type of extraction performed
            
        Returns:
            DocumentMetadata object
        """
        
        # Get file size
        file_size = os.path.getsize(zip_path)
        
        # Estimate page count from content (this is a rough estimate)
        # You might want to parse the actual metadata from MonkeyOCR if available
        word_count = len(markdown_content.split())
        estimated_pages = max(1, word_count // 250)  # Rough estimate: 250 words per page
        
        # For now, we don't have actual processing time from MonkeyOCR
        # This should be tracked from the start of processing
        processing_time = 0  # This should be calculated properly
        
        return DocumentMetadata(
            total_pages=estimated_pages,
            processing_time=processing_time,
            file_size=file_size,
            extraction_type=extraction_type
        )
    
    async def get_result_file(self, task_id: str) -> Optional[str]:
        """
        Get the path to the result file for a task
        
        Args:
            task_id: Task ID
            
        Returns:
            Path to the result file, or None if not found
        """
        
        result_file = self.results_dir / f"{task_id}_result.zip"
        return str(result_file) if result_file.exists() else None
    
    async def cleanup_task_files(self, task_id: str):
        """
        Clean up all files associated with a task
        
        Args:
            task_id: Task ID
        """
        
        # Remove result ZIP file
        result_file = self.results_dir / f"{task_id}_result.zip"
        if result_file.exists():
            result_file.unlink()
            logger.info(f"Removed result file: {result_file}")
        
        # Remove static files directory
        task_static_dir = self.static_dir / task_id
        if task_static_dir.exists():
            shutil.rmtree(task_static_dir)
            logger.info(f"Removed static directory: {task_static_dir}")
        
        # Remove uploads directory for the task
        task_uploads_dir = self.uploads_dir / task_id
        if task_uploads_dir.exists():
            shutil.rmtree(task_uploads_dir)
            logger.info(f"Removed uploads directory: {task_uploads_dir}")
        
        # Remove any temporary files (they should already be cleaned up)
        # This is a safety measure
        for temp_file in self.temp_dir.glob(f"*{task_id}*"):
            if temp_file.is_file():
                temp_file.unlink()
                logger.debug(f"Removed temp file: {temp_file}")
    
    def get_static_url(self, task_id: str, filename: str) -> str:
        """
        Generate a static URL for a file
        
        Args:
            task_id: Task ID
            filename: File name
            
        Returns:
            Static URL for the file
        """
        
        return f"/static/{task_id}/{filename}"
    
    def get_pdf_page_count(self, file_content: bytes) -> Optional[int]:
        """
        Extract page count from PDF file
        
        Args:
            file_content: PDF file content as bytes
            
        Returns:
            Number of pages in PDF, or None if extraction fails
        """
        if not PDF_SUPPORT:
            logger.warning("PyPDF2 not available, cannot count PDF pages")
            return None
            
        try:
            import io
            pdf_stream = io.BytesIO(file_content)
            pdf_reader = PyPDF2.PdfReader(pdf_stream)
            page_count = len(pdf_reader.pages)
            logger.info(f"PDF has {page_count} pages")
            return page_count
        except Exception as e:
            logger.error(f"Failed to count PDF pages: {e}")
            return None
    
    async def copy_cached_files(self, task_id: str, cached_files: Dict[str, str]) -> bool:
        """
        Copy cached result files to new task directory
        
        Args:
            task_id: New task ID
            cached_files: Dictionary mapping file types to cached file paths
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Create target directories
            task_result_dir = self.results_dir 
            task_static_dir = self.static_dir / task_id
            task_static_dir.mkdir(exist_ok=True)
            
            files_copied = 0
            
            # Copy main result file if it exists
            if cached_files.get("local_result_path"):
                source_file = Path(cached_files["local_result_path"])
                if source_file.exists():
                    target_file = task_result_dir / f"{task_id}_result.zip"
                    shutil.copy2(source_file, target_file)
                    logger.info(f"Copied cached result file: {source_file} -> {target_file}")
                    files_copied += 1
                    
                    # Extract original task ID from source file path 
                    # Format: results/{original_task_id}_result.zip
                    source_filename = source_file.name
                    if source_filename.endswith("_result.zip"):
                        original_task_id = source_filename[:-11]  # Remove "_result.zip"
                        
                        # Copy static files from original task directory
                        original_static_dir = self.static_dir / original_task_id
                        if original_static_dir.exists():
                            logger.info(f"Copying static files from {original_static_dir} to {task_static_dir}")
                            
                            # Copy all files and subdirectories
                            for item in original_static_dir.rglob("*"):
                                if item.is_file():
                                    # Calculate relative path from original static dir
                                    rel_path = item.relative_to(original_static_dir)
                                    target_path = task_static_dir / rel_path
                                    
                                    # Create parent directories if needed
                                    target_path.parent.mkdir(parents=True, exist_ok=True)
                                    
                                    # Copy file
                                    shutil.copy2(item, target_path)
                                    logger.debug(f"Copied static file: {item} -> {target_path}")
                                    files_copied += 1
                        else:
                            logger.warning(f"Original static directory not found: {original_static_dir}")
                else:
                    logger.warning(f"Cached result file not found: {source_file}")
            
            # Copy static files if explicitly provided
            if cached_files.get("static_files"):
                for static_file_info in cached_files["static_files"]:
                    source_path = Path(static_file_info["path"])
                    if source_path.exists():
                        target_path = task_static_dir / static_file_info["filename"]
                        target_path.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(source_path, target_path)
                        logger.debug(f"Copied explicit static file: {source_path} -> {target_path}")
                        files_copied += 1
            
            if files_copied > 0:
                logger.info(f"Successfully copied {files_copied} cached files for task {task_id}")
                return True
            else:
                logger.warning(f"No files were copied for cached task {task_id}")
                return False
            
        except Exception as e:
            logger.error(f"Failed to copy cached files for task {task_id}: {e}")
            return False