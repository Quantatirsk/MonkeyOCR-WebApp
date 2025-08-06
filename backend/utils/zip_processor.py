"""
ZIP Processor Utility
Handles extraction and processing of MonkeyOCR result ZIP files
"""

import os
import zipfile
import shutil
import re
import json
from pathlib import Path
from typing import List, Optional, Dict, Any
import aiofiles
from models import ImageResource, DocumentResult, DocumentMetadata

class ZipProcessor:
    """Processes ZIP files returned by MonkeyOCR API"""
    
    def __init__(self):
        self.static_dir = Path("static")
        self.static_dir.mkdir(exist_ok=True)
    
    async def process_zip_file(self, zip_path: str, task_id: str) -> DocumentResult:
        """
        Process a ZIP file from MonkeyOCR and extract content
        
        Args:
            zip_path: Path to the ZIP file
            task_id: Task ID for organizing extracted files
            
        Returns:
            DocumentResult with processed content
        """
        
        # Create task-specific directory
        task_dir = self.static_dir / task_id
        task_dir.mkdir(exist_ok=True)
        
        try:
            # Extract ZIP file
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(task_dir)
            
            # Find markdown files
            markdown_files = list(task_dir.rglob("*.md"))
            if not markdown_files:
                raise ValueError("No markdown files found in ZIP")
            
            # Process the main markdown file (usually the first or largest)
            main_md_file = self._select_main_markdown_file(markdown_files)
            
            # Read markdown content
            async with aiofiles.open(main_md_file, 'r', encoding='utf-8') as f:
                raw_markdown = await f.read()
            
            # Process images
            images = await self._process_images(task_dir, task_id)
            
            # Fix markdown image paths
            processed_markdown = self._fix_image_paths(raw_markdown, task_id)
            
            # Write the processed markdown back to the file
            async with aiofiles.open(main_md_file, 'w', encoding='utf-8') as f:
                await f.write(processed_markdown)
            
            # Process middle.json for block synchronization
            middle_data = await self._extract_middle_data(task_dir)
            
            # Generate metadata
            metadata = self._generate_metadata(
                zip_path, 
                processed_markdown, 
                len(images)
            )
            
            # Create result
            result = DocumentResult(
                task_id=task_id,
                markdown_content=processed_markdown,
                images=images,
                download_url=f"/api/download/{task_id}",
                metadata=metadata,
                middle_data=middle_data
            )
            
            return result
            
        except Exception as e:
            # Clean up on failure
            if task_dir.exists():
                shutil.rmtree(task_dir)
            raise Exception(f"Failed to process ZIP file: {str(e)}")
    
    def _select_main_markdown_file(self, markdown_files: List[Path]) -> Path:
        """
        Select the main markdown file from a list of candidates
        
        Args:
            markdown_files: List of markdown file paths
            
        Returns:
            Path to the main markdown file
        """
        
        if len(markdown_files) == 1:
            return markdown_files[0]
        
        # Prefer files with certain names
        preferred_names = ['README.md', 'index.md', 'main.md', 'document.md']
        for preferred in preferred_names:
            for md_file in markdown_files:
                if md_file.name.lower() == preferred.lower():
                    return md_file
        
        # Fall back to the largest file
        return max(markdown_files, key=lambda f: f.stat().st_size)
    
    async def _process_images(self, task_dir: Path, task_id: str) -> List[ImageResource]:
        """
        Process images found in the extracted directory
        
        Args:
            task_dir: Directory containing extracted files
            task_id: Task ID for URL generation
            
        Returns:
            List of ImageResource objects
        """
        
        images = []
        image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'}
        
        # Look for images in the extracted directory
        for image_file in task_dir.rglob("*"):
            if image_file.is_file() and image_file.suffix.lower() in image_extensions:
                # Calculate relative path from task directory
                relative_path = image_file.relative_to(task_dir)
                
                # Create static URL
                static_url = f"/static/{task_id}/{relative_path}"
                
                images.append(ImageResource(
                    filename=image_file.name,
                    path=str(relative_path),
                    url=static_url,
                    alt=f"Image: {image_file.stem}"
                ))
        
        return images
    
    async def _extract_middle_data(self, task_dir: Path) -> Optional[Dict[str, Any]]:
        """
        Extract and parse middle.json data for block synchronization
        
        Args:
            task_dir: Directory containing extracted files
            
        Returns:
            Parsed middle.json data or None if not found
        """
        
        try:
            # Look for middle.json files
            middle_json_files = list(task_dir.rglob("*middle.json"))
            
            if not middle_json_files:
                print(f"No middle.json file found in {task_dir}")
                return None
            
            # Use the first middle.json file found
            middle_json_file = middle_json_files[0]
            print(f"Found middle.json: {middle_json_file}")
            
            # Read and parse the JSON data
            async with aiofiles.open(middle_json_file, 'r', encoding='utf-8') as f:
                content = await f.read()
                middle_data = json.loads(content)
                
            # Validate basic structure
            if not isinstance(middle_data, dict):
                print("Invalid middle.json structure: not a dictionary")
                return None
                
            if 'pdf_info' not in middle_data:
                print("Invalid middle.json structure: missing pdf_info")
                return None
                
            if not isinstance(middle_data['pdf_info'], list):
                print("Invalid middle.json structure: pdf_info is not a list")
                return None
            
            print(f"Successfully parsed middle.json with {len(middle_data['pdf_info'])} pages")
            return middle_data
            
        except json.JSONDecodeError as e:
            print(f"Failed to parse middle.json: {str(e)}")
            return None
        except Exception as e:
            print(f"Error extracting middle.json data: {str(e)}")
            return None
    
    def _fix_image_paths(self, markdown_content: str, task_id: str) -> str:
        """
        Fix image paths in markdown to use our static URLs
        
        Args:
            markdown_content: Original markdown content
            task_id: Task ID for URL generation
            
        Returns:
            Markdown content with fixed image paths
        """
        
        # Pattern to match markdown image syntax: ![alt](path)
        image_pattern = r'!\[([^\]]*)\]\(([^)]+)\)'
        
        def replace_image_path(match):
            alt_text = match.group(1)
            original_path = match.group(2)
            
            # Skip if it's already a full URL
            if original_path.startswith(('http://', 'https://', '/static/')):
                return match.group(0)
            
            # Extract filename from path
            path_parts = original_path.replace('\\', '/').split('/')
            filename = path_parts[-1]
            
            # Try to find the directory structure
            if len(path_parts) > 1:
                # Preserve directory structure but handle filename prefix mismatch
                directory = '/'.join(path_parts[:-1])  # e.g., "images"
                
                # First try exact match
                exact_path = f"static/{task_id}/{directory}/{filename}"
                if Path(exact_path).exists():
                    new_url = f"/static/{task_id}/{directory}/{filename}"
                else:
                    # Look for files with the same suffix (handle prefix mismatch)
                    directory_path = Path(f"static/{task_id}/{directory}")
                    if directory_path.exists():
                        matching_files = list(directory_path.glob(f"*_{filename}"))
                        if not matching_files:
                            # Also try files that end with the filename
                            matching_files = list(directory_path.glob(f"*{filename}"))
                        
                        if matching_files:
                            # Use the first match
                            actual_filename = matching_files[0].name
                            new_url = f"/static/{task_id}/{directory}/{actual_filename}"
                        else:
                            # Fallback to original path
                            new_url = f"/static/{task_id}/{directory}/{filename}"
                    else:
                        new_url = f"/static/{task_id}/{directory}/{filename}"
            else:
                # Just the filename - look in common directories
                new_url = f"/static/{task_id}/{filename}"
                
                # Check if it might be in an images subdirectory
                if not Path(f"static/{task_id}/{filename}").exists():
                    potential_dirs = ["images", "img", "assets"]
                    
                    for dir_name in potential_dirs:
                        # First try exact filename match
                        exact_path = Path(f"static/{task_id}/{dir_name}/{filename}")
                        if exact_path.exists():
                            new_url = f"/static/{task_id}/{dir_name}/{filename}"
                            break
                        
                        # Then try prefix-suffixed filename match
                        directory_path = Path(f"static/{task_id}/{dir_name}")
                        if directory_path.exists():
                            matching_files = list(directory_path.glob(f"*_{filename}"))
                            if not matching_files:
                                matching_files = list(directory_path.glob(f"*{filename}"))
                            
                            if matching_files:
                                actual_filename = matching_files[0].name
                                new_url = f"/static/{task_id}/{dir_name}/{actual_filename}"
                                break
            
            return f"![{alt_text}]({new_url})"
        
        # Replace all image references
        fixed_content = re.sub(image_pattern, replace_image_path, markdown_content)
        
        return fixed_content
    
    def _generate_metadata(
        self, 
        zip_path: str, 
        markdown_content: str, 
        image_count: int
    ) -> DocumentMetadata:
        """
        Generate metadata for the processed document
        
        Args:
            zip_path: Path to the original ZIP file
            markdown_content: Processed markdown content
            image_count: Number of images found
            
        Returns:
            DocumentMetadata object
        """
        
        # Get file size
        file_size = os.path.getsize(zip_path)
        
        # Estimate page count from content
        # This is a rough estimate - MonkeyOCR might provide better metadata
        line_count = len(markdown_content.split('\n'))
        estimated_pages = max(1, line_count // 50)  # Rough estimate
        
        # Look for page indicators in markdown
        page_markers = re.findall(r'page[\s_-]*(\d+)', markdown_content, re.IGNORECASE)
        if page_markers:
            try:
                max_page = max(int(marker) for marker in page_markers)
                estimated_pages = max(estimated_pages, max_page)
            except (ValueError, TypeError):
                pass
        
        return DocumentMetadata(
            total_pages=estimated_pages,
            processing_time=0,  # This should be tracked during processing
            file_size=file_size,
            extraction_type="standard"  # This should be passed from the request
        )
    
    def cleanup_task_directory(self, task_id: str):
        """
        Clean up the task directory
        
        Args:
            task_id: Task ID
        """
        
        task_dir = self.static_dir / task_id
        if task_dir.exists():
            shutil.rmtree(task_dir)