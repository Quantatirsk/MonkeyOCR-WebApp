/**
 * Document Viewer Utility Functions
 */

/**
 * Format processing time from seconds to human readable format
 */
export const formatProcessingTime = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
};

/**
 * Format file size from bytes to human readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Apply search highlighting to markdown content
 */
export const applySearchHighlight = (content: string, searchQuery: string): string => {
  if (!content || !searchQuery?.trim()) {
    return content;
  }

  const query = searchQuery.trim();
  
  // Skip highlighting for very large docs with short queries (performance optimization)
  if (content.length > 100000 && query.length < 3) {
    return content;
  }

  try {
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return content.replace(regex, '<mark class="search-highlight">$1</mark>');
  } catch (error) {
    console.warn('Search highlighting failed:', error);
    return content;
  }
};