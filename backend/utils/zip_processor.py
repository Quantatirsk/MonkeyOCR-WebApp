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
        self.media_dir = Path("media")
        self.media_dir.mkdir(exist_ok=True)
    
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
        task_dir = self.media_dir / task_id
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
                metadata=metadata
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
                media_url = f"/media/{task_id}/{relative_path}"
                
                images.append(ImageResource(
                    filename=image_file.name,
                    path=str(relative_path),
                    url=media_url,
                    alt=f"Image: {image_file.stem}"
                ))
        
        return images
    
    def _fix_image_paths(self, markdown_content: str, task_id: str) -> str:
        """
        Fix image paths in markdown to use our media URLs
        
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
            if original_path.startswith(('http://', 'https://', '/media/')):
                return match.group(0)
            
            # Extract filename from path
            path_parts = original_path.replace('\\', '/').split('/')
            filename = path_parts[-1]
            
            # Try to find the directory structure
            if len(path_parts) > 1:
                # Preserve directory structure but handle filename prefix mismatch
                directory = '/'.join(path_parts[:-1])  # e.g., "images"
                
                # First try exact match
                exact_path = f"media/{task_id}/{directory}/{filename}"
                if Path(exact_path).exists():
                    new_url = f"/media/{task_id}/{directory}/{filename}"
                else:
                    # Look for files with the same suffix (handle prefix mismatch)
                    directory_path = Path(f"media/{task_id}/{directory}")
                    if directory_path.exists():
                        matching_files = list(directory_path.glob(f"*_{filename}"))
                        if not matching_files:
                            # Also try files that end with the filename
                            matching_files = list(directory_path.glob(f"*{filename}"))
                        
                        if matching_files:
                            # Use the first match
                            actual_filename = matching_files[0].name
                            new_url = f"/media/{task_id}/{directory}/{actual_filename}"
                        else:
                            # Fallback to original path
                            new_url = f"/media/{task_id}/{directory}/{filename}"
                    else:
                        new_url = f"/media/{task_id}/{directory}/{filename}"
            else:
                # Just the filename - look in common directories
                new_url = f"/media/{task_id}/{filename}"
                
                # Check if it might be in an images subdirectory
                if not Path(f"media/{task_id}/{filename}").exists():
                    potential_dirs = ["images", "img", "assets"]
                    
                    for dir_name in potential_dirs:
                        # First try exact filename match
                        exact_path = Path(f"media/{task_id}/{dir_name}/{filename}")
                        if exact_path.exists():
                            new_url = f"/media/{task_id}/{dir_name}/{filename}"
                            break
                        
                        # Then try prefix-suffixed filename match
                        directory_path = Path(f"media/{task_id}/{dir_name}")
                        if directory_path.exists():
                            matching_files = list(directory_path.glob(f"*_{filename}"))
                            if not matching_files:
                                matching_files = list(directory_path.glob(f"*{filename}"))
                            
                            if matching_files:
                                actual_filename = matching_files[0].name
                                new_url = f"/media/{task_id}/{dir_name}/{actual_filename}"
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
            file_size=file_size
        )
    
    def cleanup_task_directory(self, task_id: str):
        """
        Clean up the task directory
        
        Args:
            task_id: Task ID
        """
        
        task_dir = self.media_dir / task_id
        if task_dir.exists():
            shutil.rmtree(task_dir)
    
    async def extract_block_data(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Extract block data from middle.json file if it exists
        
        Args:
            task_id: Task ID to locate the extracted directory
            
        Returns:
            Dictionary containing block data or None if not found
        """
        task_dir = self.media_dir / task_id
        
        # Look for middle.json files with pattern tmpXXX_middle.json
        middle_json_files = list(task_dir.rglob("*_middle.json"))
        
        if not middle_json_files:
            return None
        
        # Use the first middle.json file found
        middle_json_path = middle_json_files[0]
        
        try:
            async with aiofiles.open(middle_json_path, 'r', encoding='utf-8') as f:
                content = await f.read()
                raw_data = json.loads(content)
                
                # Store task_id context for image path processing
                self._current_task_id = task_id
                
                # Transform raw data to frontend-compatible format
                result = self._transform_block_data(raw_data)
                
                # Clear task_id context
                self._current_task_id = None
                
                return result
        except json.JSONDecodeError as e:
            print(f"JSON decode error in file {middle_json_path}: {e}")
            print(f"Error at line {e.lineno}, column {e.colno}")
            return None
        except FileNotFoundError as e:
            print(f"File not found: {middle_json_path}")
            return None
        except IndexError as e:
            print(f"IndexError while processing {middle_json_path}: {e}")
            import traceback
            traceback.print_exc()
            return None
        except Exception as e:
            print(f"Unexpected error reading middle.json file {middle_json_path}: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def _transform_block_data(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform raw middle.json data to frontend-compatible BlockProcessingData format
        
        Args:
            raw_data: Raw data from middle.json file
            
        Returns:
            Transformed data compatible with frontend BlockProcessingData interface
        """
        if 'pdf_info' not in raw_data or not raw_data['pdf_info']:
            return {
                'preproc_blocks': [],
                'total_pages': 0
            }
        
        page_count = len(raw_data['pdf_info'])
        
        print(f"🔍 Processing {page_count} pages of block data...")
        
        # First, collect all blocks with their original positions and metadata
        all_raw_blocks = []
        processed_images = set()  # Track processed images to avoid duplication
        
        for page_idx, page_info in enumerate(raw_data['pdf_info']):
            page_num = page_idx + 1
            page_size = page_info.get('page_size', [595, 842])  # Default A4 size
            preproc_blocks = page_info.get('preproc_blocks', [])
            images = page_info.get('images', [])
            tables = page_info.get('tables', [])
            
            # Collect preproc_blocks with processing metadata (excluding image and table blocks to avoid duplication)
            for block in preproc_blocks:
                # Skip image blocks from preproc_blocks to avoid duplication with images array
                # Skip table blocks from preproc_blocks to avoid duplication with tables array
                # Process text, title, and interline_equation blocks
                if block.get('type') not in ['image', 'table']:
                    # Ensure bbox is valid
                    bbox = block.get('bbox', [0, 0, 0, 0])
                    if not isinstance(bbox, list) or len(bbox) < 4:
                        bbox = [0, 0, 0, 0]
                    
                    all_raw_blocks.append({
                        'source_type': 'preproc',
                        'data': block,
                        'page_num': page_num,
                        'page_size': page_size,
                        'original_index': block.get('index', 0),
                        'bbox': bbox
                    })
            
            # Collect image blocks with processing metadata and deduplication  
            for image_block in images:
                # Ensure bbox is valid
                bbox = image_block.get('bbox', [0, 0, 0, 0])
                if not isinstance(bbox, list) or len(bbox) < 4:
                    bbox = [0, 0, 0, 0]
                    
                # Create unique identifier for image based on bbox and page
                image_id = f"{page_num}_{bbox}"
                if image_id not in processed_images:
                    processed_images.add(image_id)
                    all_raw_blocks.append({
                        'source_type': 'image',
                        'data': image_block,
                        'page_num': page_num,
                        'page_size': page_size,
                        'original_index': image_block.get('index', 0),
                        'bbox': bbox
                    })
            
            # Collect table blocks with processing metadata
            for table_block in tables:
                # Ensure bbox is valid
                bbox = table_block.get('bbox', [0, 0, 0, 0])
                if not isinstance(bbox, list) or len(bbox) < 4:
                    bbox = [0, 0, 0, 0]
                    
                all_raw_blocks.append({
                    'source_type': 'table',
                    'data': table_block,
                    'page_num': page_num,
                    'page_size': page_size,
                    'original_index': table_block.get('index', 0),
                    'bbox': bbox
                })
        
        # Sort all blocks by page first, then by original reading order (Y position, then X position)
        def get_sort_key(raw_block):
            page_num = raw_block['page_num']
            bbox = raw_block['bbox']
            original_index = raw_block['original_index']
            
            # Ensure bbox has at least 4 elements, fill with zeros if needed
            if not isinstance(bbox, list):
                bbox = [0, 0, 0, 0]
            elif len(bbox) < 4:
                bbox = list(bbox) + [0] * (4 - len(bbox))
            
            # Primary: page number
            # Secondary: original index from MonkeyOCR (semantic reading order)
            # Tertiary: Y position (top to bottom)
            # Quaternary: X position (left to right) 
            return (page_num, original_index, bbox[1] if len(bbox) > 1 else 0, bbox[0] if len(bbox) > 0 else 0)
        
        sorted_raw_blocks = sorted(all_raw_blocks, key=get_sort_key)
        
        print(f"📋 Sorted block order: {[(rb['page_num'], rb['original_index'], rb['source_type']) for rb in sorted_raw_blocks]}")
        
        # Now process sorted blocks and assign sequential index
        all_blocks = []
        global_block_index = 1  # 全文档连续编号，从1开始
        
        for raw_block in sorted_raw_blocks:
            source_type = raw_block['source_type']
            data = raw_block['data']
            page_num = raw_block['page_num']
            page_size = raw_block['page_size']
            
            processed_blocks = []
            if source_type == 'preproc':
                processed_block = self._process_block(data, page_num, page_size, global_block_index)
                if processed_block:
                    processed_blocks.append(processed_block)
                    global_block_index += 1
            elif source_type == 'image':
                processed_block = self._process_image_block(data, page_num, page_size, global_block_index)
                if processed_block:
                    processed_blocks.append(processed_block)
                    global_block_index += 1
            elif source_type == 'table':
                # Process table block - table titles should be separate text/title blocks
                # NOT extracted from the table HTML content
                processed_block = self._process_table_block(data, page_num, page_size, global_block_index)
                if processed_block:
                    processed_blocks.append(processed_block)
                    global_block_index += 1
            
            all_blocks.extend(processed_blocks)
        
        # Final debug: show the complete index sequence
        print(f"📊 Final block sequence: {[block['index'] for block in all_blocks]}")
        print(f"📊 Total blocks processed: {len(all_blocks)}")
        
        return {
            'preproc_blocks': all_blocks,
            'total_pages': page_count,
            'document_metadata': {
                'title': 'Extracted Document',
                'processing_timestamp': raw_data.get('_version_name', ''),
                'parse_type': raw_data.get('_parse_type', 'unknown')
            }
        }
    
    def _process_block(self, block: Dict[str, Any], page_num: int, page_size: list, global_index: int) -> Optional[Dict[str, Any]]:
        """
        Process a regular block (text, title, interline_equation, or image from preproc_blocks)
        """
        block_type = block.get('type', 'text')
        
        if block_type == 'image':
            # Handle image blocks with nested structure
            return self._process_image_block_from_preproc(block, page_num, page_size, global_index)
        elif block_type == 'interline_equation':
            # Handle interline equation blocks - wrap content with $$
            content = self._extract_text_content(block)
            # Wrap the equation content with $$ for proper rendering
            formatted_content = f"$${content}$$" if content else ""
            
            return {
                'index': global_index,
                'bbox': block.get('bbox', [0, 0, 0, 0]),
                'type': 'interline_equation',  # Keep the original type for frontend
                'content': formatted_content,
                'page_num': page_num,
                'page_size': page_size,
                '_raw_index': block.get('index', None),
                '_global_index': global_index
            }
        else:
            # Handle text and title blocks
            content = self._extract_text_content(block)
            
            return {
                'index': global_index,
                'bbox': block.get('bbox', [0, 0, 0, 0]),
                'type': block_type,
                'content': content,
                'page_num': page_num,
                'page_size': page_size,
                '_raw_index': block.get('index', None),
                '_global_index': global_index
            }
    
    def _process_image_block_from_preproc(self, block: Dict[str, Any], page_num: int, page_size: list, global_index: int) -> Optional[Dict[str, Any]]:
        """
        Process image block from preproc_blocks (has nested blocks structure)
        """
        image_path = None
        caption = ""
        
        # Extract image path and caption from blocks structure
        if 'blocks' in block:
            for sub_block in block['blocks']:
                if sub_block.get('type') == 'image_body':
                    # Extract image path from spans
                    image_path = self._extract_image_path_from_spans(sub_block)
                elif sub_block.get('type') == 'image_caption':
                    # Only use the first caption that contains "Fig" for figure images
                    extracted_caption = self._extract_text_content(sub_block)
                    if caption == "":  # Use first caption if we don't have one yet
                        caption = extracted_caption
                    elif "Fig" in extracted_caption and "Fig" not in caption:
                        # Prefer figure captions for images
                        caption = extracted_caption
        
        if not image_path:
            return None
            
        # Find the actual image file that matches the image_path
        actual_image_path = self._find_matching_image_file(image_path, global_index)
        
        # Create markdown content for image (caption only in alt text to avoid duplication)
        content = f"![{caption or 'Image'}]({actual_image_path})"
        
        return {
            'index': global_index,
            'bbox': block.get('bbox', [0, 0, 0, 0]),
            'type': 'image',
            'content': content,
            'image_path': image_path,
            'caption': caption,
            'page_num': page_num,
            'page_size': page_size,
            '_raw_index': block.get('index', None),
            '_global_index': global_index
        }
    
    def _process_image_block(self, image_block: Dict[str, Any], page_num: int, page_size: list, global_index: int) -> Optional[Dict[str, Any]]:
        """
        Process image block from images array
        """
        image_path = None
        caption = ""
        
        # Extract image path and caption
        if 'blocks' in image_block:
            for sub_block in image_block['blocks']:
                if sub_block.get('type') == 'image_body':
                    image_path = self._extract_image_path_from_spans(sub_block)
                elif sub_block.get('type') == 'image_caption':
                    # Only use the first caption that contains "Fig" for figure images
                    # This avoids picking up table captions that might be nearby
                    extracted_caption = self._extract_text_content(sub_block)
                    if caption == "":  # Use first caption if we don't have one yet
                        caption = extracted_caption
                    elif "Fig" in extracted_caption and "Fig" not in caption:
                        # Prefer figure captions for images
                        caption = extracted_caption
        
        if not image_path:
            return None
        
        # Find the actual image file that matches the image_path
        actual_image_path = self._find_matching_image_file(image_path, global_index)
        
        # Create markdown content for image (caption only in alt text to avoid duplication)
        content = f"![{caption or 'Image'}]({actual_image_path})"
        
        return {
            'index': global_index,
            'bbox': image_block.get('bbox', [0, 0, 0, 0]),
            'type': 'image',
            'content': content,
            'image_path': image_path,
            'caption': caption,
            'page_num': page_num,
            'page_size': page_size,
            '_raw_index': image_block.get('index', None),
            '_global_index': global_index
        }
    
    def _process_table_block(self, table_block: Dict[str, Any], page_num: int, page_size: list, global_index: int) -> Optional[Dict[str, Any]]:
        """
        Process table block from tables array
        """
        html_content = None
        image_path = None
        
        # Extract HTML and image path from table spans
        if 'blocks' in table_block:
            for sub_block in table_block['blocks']:
                if sub_block.get('type') == 'table_body':
                    if 'lines' in sub_block:
                        for line in sub_block['lines']:
                            if 'spans' in line:
                                for span in line['spans']:
                                    if span.get('type') == 'table' and 'html' in span:
                                        html_content = span['html']
                                        image_path = span.get('image_path')
                                        break
        
        if not html_content:
            return None
        
        # Convert HTML table to markdown WITHOUT any title extraction
        # Titles should be separate blocks in the document
        markdown_content = self._convert_html_table_to_markdown(html_content, extract_title=False)
        
        return {
            'index': global_index,
            'bbox': table_block.get('bbox', [0, 0, 0, 0]),
            'type': 'table',
            'content': markdown_content,
            'html_content': html_content,
            'image_path': image_path,
            'page_num': page_num,
            'page_size': page_size,
            '_raw_index': table_block.get('index', None),
            '_global_index': global_index
        }
    
    def _process_table_with_title_extraction(self, table_block: Dict[str, Any], page_num: int, page_size: list, global_index: int) -> tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        """
        Process table block with title extraction as separate blocks
        
        Args:
            table_block: Raw table block data
            page_num: Page number
            page_size: Page dimensions
            global_index: Starting global index (will be used for title if present)
            
        Returns:
            Tuple of (title_block, table_block) - either can be None
        """
        html_content = None
        image_path = None
        
        # Extract HTML and image path from table spans
        if 'blocks' in table_block:
            for sub_block in table_block['blocks']:
                if sub_block.get('type') == 'table_body':
                    if 'lines' in sub_block:
                        for line in sub_block['lines']:
                            if 'spans' in line:
                                for span in line['spans']:
                                    if span.get('type') == 'table' and 'html' in span:
                                        html_content = span['html']
                                        image_path = span.get('image_path')
                                        break
        
        if not html_content:
            return None, None
        
        # Extract table title separately
        title_block = None
        table_title = self._extract_table_title_from_html(html_content)
        if table_title:
            # Create a separate title block that appears before the table
            # Use the SAME bbox as the table to ensure proper reading order
            # The global_index sequence will determine the order, not bbox positioning
            table_bbox = table_block.get('bbox', [0, 0, 0, 0])
            
            title_block = {
                'index': global_index,
                'bbox': table_bbox,  # Use same bbox as table - order controlled by index
                'type': 'title',
                'content': table_title,
                'page_num': page_num,
                'page_size': page_size,
                '_raw_index': table_block.get('index', None),
                '_global_index': global_index,
                '_table_title': True,  # Mark as extracted table title
                '_table_order_priority': -1  # Ensure title appears before table in same position
            }
            print(f"📋 Created separate title block: '{table_title}' (index {global_index})")
        
        # Convert HTML table to markdown WITHOUT embedded title
        markdown_content = self._convert_html_table_to_markdown(html_content, extract_title=False)
        
        # Create table block with updated index
        table_index = global_index + (1 if title_block else 0)
        processed_table_block = {
            'index': table_index,
            'bbox': table_block.get('bbox', [0, 0, 0, 0]),
            'type': 'table',
            'content': markdown_content,
            'html_content': html_content,
            'image_path': image_path,
            'page_num': page_num,
            'page_size': page_size,
            '_raw_index': table_block.get('index', None),
            '_global_index': table_index,
            '_table_order_priority': 0  # Normal table priority
        }
        
        print(f"🔄 Processed table block (index {table_index})")
        
        return title_block, processed_table_block
    
    def _extract_table_title_from_html_if_present(self, table_block: Dict[str, Any]) -> Optional[str]:
        """
        Extract table title from table block's HTML content if present
        
        Args:
            table_block: Raw table block data containing HTML
            
        Returns:
            Table title string or None if not found
        """
        # Extract HTML content from table block
        html_content = None
        if 'blocks' in table_block:
            for sub_block in table_block['blocks']:
                if sub_block.get('type') == 'table_body':
                    if 'lines' in sub_block:
                        for line in sub_block['lines']:
                            if 'spans' in line:
                                for span in line['spans']:
                                    if span.get('type') == 'table' and 'html' in span:
                                        html_content = span['html']
                                        break
        
        if not html_content:
            return None
        
        return self._extract_table_title_from_html(html_content)
    
    def _extract_table_title_from_html(self, html_content: str) -> Optional[str]:
        """
        Extract table title from HTML content
        
        Args:
            html_content: HTML table content
            
        Returns:
            Table title string or None if not found
        """
        import re
        
        # Extract table title from HTML (first colspan header)
        title_pattern = r'<tr[^>]*>\s*<th[^>]*colspan[^>]*>(.*?)</th>\s*</tr>'
        title_match = re.search(title_pattern, html_content, re.DOTALL | re.IGNORECASE)
        
        if title_match:
            table_title = self._clean_table_cell_content(title_match.group(1))
            if table_title.strip():
                return table_title.strip()
        
        return None
    
    def _extract_text_content(self, block: Dict[str, Any]) -> str:
        """
        Extract text content from lines/spans structure
        """
        content_parts = []
        if 'lines' in block and block['lines']:
            for line in block['lines']:
                if 'spans' in line and line['spans']:
                    for span in line['spans']:
                        if 'content' in span and span['content'].strip():
                            content_parts.append(span['content'].strip())
        return ' '.join(content_parts)
    
    def _extract_image_path_from_spans(self, block: Dict[str, Any]) -> Optional[str]:
        """
        Extract image_path from spans structure
        """
        if 'lines' in block and block['lines']:
            for line in block['lines']:
                if 'spans' in line and line['spans']:
                    for span in line['spans']:
                        if span.get('type') == 'image' and 'image_path' in span:
                            return span['image_path']
        return None
    
    def _convert_html_table_to_markdown(self, html_content: str, extract_title: bool = False) -> str:
        """
        Convert HTML table to Markdown format with enhanced robustness
        
        Args:
            html_content: HTML table content to convert
            extract_title: Whether to extract and embed table title (default False - titles should be separate blocks)
        """
        import re
        from html import unescape
        
        # Clean up the HTML content
        html_content = unescape(html_content)
        print(f"🔄 Converting table HTML to Markdown (extract_title={extract_title}): {html_content[:200]}...")
        
        markdown_lines = []
        
        # Check if there's a title row (colspan header) to handle
        has_title_row = False
        title_pattern = r'<tr[^>]*>\s*<th[^>]*colspan[^>]*>(.*?)</th>\s*</tr>'
        title_match = re.search(title_pattern, html_content, re.DOTALL | re.IGNORECASE)
        if title_match:
            has_title_row = True
            table_title_content = self._clean_table_cell_content(title_match.group(1))
            print(f"📋 Found table title row: '{table_title_content}'")
        
        # Handle title extraction if requested
        title_extracted = False
        if extract_title and has_title_row:
            if table_title_content.strip():
                # Add table title as a separate heading
                markdown_lines.append(f"### {table_title_content}")
                markdown_lines.append("")  # Empty line after title
                title_extracted = True
                print(f"📋 Extracted table title: {table_title_content}")
        
        # More flexible header detection - try multiple patterns
        header_patterns = [
            r'<tr[^>]*>\s*<th(?![^>]*colspan)[^>]*>(.*?)</th>.*?</tr>',  # Standard th header
            r'<tr[^>]*>\s*<td[^>]*(?:class="[^"]*header[^"]*"|style="[^"]*font-weight[^"]*bold[^"]*")[^>]*>(.*?)</td>.*?</tr>',  # Styled header
        ]
        
        headers_found = False
        
        # First, check if there's a thead section
        thead_match = re.search(r'<thead[^>]*>(.*?)</thead>', html_content, re.DOTALL | re.IGNORECASE)
        if thead_match:
            thead_content = thead_match.group(1)
            # Find all rows in thead
            thead_rows = re.findall(r'<tr[^>]*>(.*?)</tr>', thead_content, re.DOTALL)
            
            # Look for the actual header row (usually the last non-empty row in thead)
            actual_headers = []
            for row in reversed(thead_rows):
                # Check if this row has actual content (not just empty cells)
                cells = re.findall(r'<(?:th|td)[^>]*>(.*?)</(?:th|td)>', row, re.DOTALL)
                clean_cells = []
                for cell in cells:
                    clean_cell = self._clean_table_cell_content(cell)
                    clean_cells.append(clean_cell if clean_cell else '')
                
                # If this row has meaningful content, use it as headers
                if any(c.strip() for c in clean_cells):
                    # Special handling for complex multi-row headers
                    # Check if this looks like a multi-column group header (e.g., ReACT, Plan+Execute)
                    if all('colspan' in row for row in thead_rows[:1]) and len(thead_rows) > 1:
                        # This is likely a complex header with column groups
                        # Extract headers from the row with actual column headers
                        for check_row in thead_rows:
                            if 'Procedure' in check_row or 'Completion' in check_row:
                                # This row has the actual column headers
                                header_cells = re.findall(r'<(?:th|td)[^>]*>(.*?)</(?:th|td)>', check_row, re.DOTALL)
                                clean_headers = []
                                for hcell in header_cells:
                                    clean_hcell = self._clean_table_cell_content(hcell)
                                    if clean_hcell:  # Only add non-empty headers
                                        clean_headers.append(clean_hcell)
                                if len(clean_headers) >= 4:  # Ensure we have enough headers
                                    actual_headers = clean_headers
                                    break
                    
                    # If we didn't find headers through special handling, use the current row
                    if not actual_headers:
                        actual_headers = clean_cells
                    break
            
            if actual_headers and any(h.strip() for h in actual_headers):
                clean_headers = actual_headers
                markdown_lines.append('| ' + ' | '.join(clean_headers) + ' |')
                markdown_lines.append('| ' + ' | '.join(['---'] * len(clean_headers)) + ' |')
                headers_found = True
                print(f"✅ Found table headers from thead: {clean_headers}")
        
        # If no headers found in thead, try the original pattern matching
        if not headers_found:
            for header_pattern in header_patterns:
                header_match = re.search(header_pattern, html_content, re.DOTALL | re.IGNORECASE)
                if header_match:
                    header_row = header_match.group(0)
                    
                    # Skip if this is the title row (contains colspan)
                    if 'colspan' in header_row:
                        continue
                        
                    # Extract all header cells from the matched row
                    header_cells = re.findall(r'<th(?![^>]*colspan)[^>]*>(.*?)</th>', header_row, re.DOTALL)
                    if not header_cells:
                        # Try td cells as headers
                        header_cells = re.findall(r'<td[^>]*>(.*?)</td>', header_row, re.DOTALL)
                    
                    if header_cells:
                        # Clean header cells
                        clean_headers = []
                        for cell in header_cells:
                            clean_cell = self._clean_table_cell_content(cell)
                            clean_headers.append(clean_cell if clean_cell else ' ')
                        
                        # Create markdown header
                        markdown_lines.append('| ' + ' | '.join(clean_headers) + ' |')
                        markdown_lines.append('| ' + ' | '.join(['---'] * len(clean_headers)) + ' |')
                        headers_found = True
                        print(f"✅ Found table headers: {clean_headers}")
                        break
        
        # Extract table body rows - try with and without tbody
        body_content = html_content
        tbody_match = re.search(r'<tbody[^>]*>(.*?)</tbody>', html_content, re.DOTALL)
        if tbody_match:
            body_content = tbody_match.group(1)
            print(f"📋 Found tbody section")
        else:
            # If no tbody, process all rows but skip title row (if exists) and already-processed header rows
            remaining_content = html_content
            
            # Always skip title row if it exists (regardless of extract_title setting)
            # Because title should either be extracted as heading or ignored completely
            if has_title_row:
                title_row_match = re.search(r'<tr[^>]*>\s*<th[^>]*colspan[^>]*>.*?</tr>', remaining_content, re.DOTALL)
                if title_row_match:
                    title_row_end = title_row_match.end()
                    remaining_content = remaining_content[title_row_end:]
                    print(f"📋 Skipped title row (has_title_row=True, extract_title={extract_title})")
            
            # Skip header row if found and already processed
            if headers_found:
                # Find first non-colspan header row
                for pattern in header_patterns:
                    header_match = re.search(pattern, remaining_content, re.DOTALL | re.IGNORECASE)
                    if header_match and 'colspan' not in header_match.group(0):
                        header_row_end = header_match.end()
                        remaining_content = remaining_content[header_row_end:]
                        print(f"📋 Skipped already-processed header row")
                        break
            
            body_content = remaining_content
            print(f"📋 No tbody found, processing remaining rows after skipping title/header")
        
        # Extract all rows from body content
        row_pattern = r'<tr[^>]*>(.*?)</tr>'
        rows = re.findall(row_pattern, body_content, re.DOTALL)
        
        print(f"📊 Found {len(rows)} table body rows")
        
        for row_idx, row in enumerate(rows):
            # Extract cells from each row - handle both td and th
            cell_patterns = [
                r'<td[^>]*>(.*?)</td>',  # Standard data cells
                r'<th[^>]*>(.*?)</th>',  # Header cells (might be in body)
            ]
            
            cells = []
            for pattern in cell_patterns:
                found_cells = re.findall(pattern, row, re.DOTALL)
                cells.extend(found_cells)
            
            if cells:
                # Clean cell content
                clean_cells = []
                for cell in cells:
                    clean_cell = self._clean_table_cell_content(cell)
                    clean_cells.append(clean_cell if clean_cell else ' ')
                
                # Create markdown row
                markdown_row = '| ' + ' | '.join(clean_cells) + ' |'
                markdown_lines.append(markdown_row)
                
                if row_idx == 0 and not headers_found:
                    # If no headers were found, treat first row as headers
                    separator = '| ' + ' | '.join(['---'] * len(clean_cells)) + ' |'
                    markdown_lines.append(separator)
                    headers_found = True
                    print(f"✅ Using first row as headers: {clean_cells}")
            else:
                print(f"⚠️ No cells found in row {row_idx}: {row[:100]}...")
        
        result = '\n'.join(markdown_lines)
        print(f"📝 Generated markdown table ({len(markdown_lines)} lines): {result[:200]}...")
        
        if not result.strip():
            print(f"❌ Table conversion failed, returning fallback")
            return "| Content | \n| --- |\n| Table conversion failed |" 
        
        return result
    
    def _clean_table_cell_content(self, cell_content: str) -> str:
        """
        Clean individual table cell content while preserving formatting
        """
        # Remove HTML tags but preserve some formatting
        clean_cell = re.sub(r'<i[^>]*>(.*?)</i>', r'*\1*', cell_content)  # Italic
        clean_cell = re.sub(r'<em[^>]*>(.*?)</em>', r'*\1*', clean_cell)  # Emphasis
        clean_cell = re.sub(r'<b[^>]*>(.*?)</b>', r'**\1**', clean_cell)  # Bold
        clean_cell = re.sub(r'<strong[^>]*>(.*?)</strong>', r'**\1**', clean_cell)  # Strong
        clean_cell = re.sub(r'<sup[^>]*>(.*?)</sup>', r'^\1^', clean_cell)  # Superscript
        clean_cell = re.sub(r'<sub[^>]*>(.*?)</sub>', r'~\1~', clean_cell)  # Subscript
        clean_cell = re.sub(r'<[^>]+>', '', clean_cell)  # Remove remaining tags
        clean_cell = clean_cell.replace('\n', ' ').replace('\r', ' ')  # Clean line breaks
        clean_cell = re.sub(r'\s+', ' ', clean_cell)  # Normalize whitespace
        clean_cell = clean_cell.strip()
        
        return clean_cell
    
    def _find_matching_image_file(self, image_path: str, global_index: int) -> str:
        """
        Find the actual image file that matches the given image_path
        
        Args:
            image_path: The image path from middle.json (usually just filename)
            global_index: Global index for fallback identification
            
        Returns:
            Corrected image path with proper directory structure
        """
        # Store task_id for this processing context
        task_id = getattr(self, '_current_task_id', None)
        if not task_id:
            # If no task_id context, just return as-is with absolute path
            return f"/media/{task_id or 'unknown'}/images/{image_path}"
        
        task_dir = self.media_dir / task_id
        
        # Try common image directories
        potential_dirs = ['images', 'img', 'assets', '']
        
        for dir_name in potential_dirs:
            if dir_name:
                search_dir = task_dir / dir_name
            else:
                search_dir = task_dir
            
            if not search_dir.exists():
                continue
                
            # Try exact filename match first
            exact_file = search_dir / image_path
            if exact_file.exists():
                if dir_name:
                    return f"/media/{task_id}/{dir_name}/{image_path}"
                else:
                    return f"/media/{task_id}/{image_path}"
            
            # Try files that end with the given filename (handle prefix mismatch)
            for existing_file in search_dir.glob("*"):
                if existing_file.is_file() and existing_file.name.endswith(image_path):
                    if dir_name:
                        return f"/media/{task_id}/{dir_name}/{existing_file.name}"
                    else:
                        return f"/media/{task_id}/{existing_file.name}"
        
        # Fallback: return the path as-is with images directory and absolute path
        print(f"⚠️ Could not find matching image file for: {image_path}")
        return f"/media/{task_id}/images/{image_path}"