/**
 * BlockMarkdownViewer Component
 * Enhanced Markdown renderer with block marking and sync capabilities
 */

import React, { useMemo, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { BlockData, BlockSelection } from '../../types';
import { ContentMatcher, BlockProcessor } from '../../utils/blockProcessor';
import './block-styles.css';

export interface BlockMarkdownViewerProps {
  /** Markdown content to render */
  content: string;
  /** Block data for mapping */
  blockData?: BlockData[];
  /** Currently selected block */
  selectedBlock?: BlockSelection;
  /** Highlighted blocks */
  highlightedBlocks?: number[];
  /** Whether sync is enabled */
  syncEnabled?: boolean;
  /** Callback for block click */
  onBlockClick?: (blockIndex: number) => void;
  /** Callback for block hover */
  onBlockHover?: (blockIndex: number | null) => void;
  /** Font size multiplier */
  fontSize?: number;
  /** CSS class name */
  className?: string;
}

interface BlockMapping {
  blockIndex: number;
  paragraphIndex: number;
  blockType: 'text' | 'title' | 'image';
}

export const BlockMarkdownViewer: React.FC<BlockMarkdownViewerProps> = ({
  content,
  blockData = [],
  selectedBlock = { blockIndex: null, pageNumber: null, isActive: false },
  highlightedBlocks = [],
  syncEnabled = false,
  onBlockClick,
  onBlockHover,
  fontSize = 100,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredBlock, setHoveredBlock] = React.useState<number | null>(null);

  // Create block-to-paragraph mapping
  const blockMappings = useMemo<BlockMapping[]>(() => {
    if (!syncEnabled || blockData.length === 0) return [];

    const blockToMarkdownMap = ContentMatcher.matchBlocksToMarkdown(blockData, content);
    const mappings: BlockMapping[] = [];

    blockToMarkdownMap.forEach((paragraphIndex, blockIndex) => {
      const block = BlockProcessor.findBlockByIndex(blockData, blockIndex);
      if (block) {
        mappings.push({
          blockIndex,
          paragraphIndex,
          blockType: block.type
        });
      }
    });

    return mappings.sort((a, b) => a.paragraphIndex - b.paragraphIndex);
  }, [blockData, content, syncEnabled]);

  // Process content with block markers
  const processedContent = useMemo(() => {
    if (!syncEnabled || blockMappings.length === 0) {
      return content;
    }

    // Split content into paragraphs
    const paragraphs = content.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
    
    // Add block markers to matching paragraphs
    const processedParagraphs = paragraphs.map((paragraph, index) => {
      const mapping = blockMappings.find(m => m.paragraphIndex === index);
      
      if (!mapping) return paragraph;

      const { blockIndex, blockType } = mapping;
      const isSelected = selectedBlock.blockIndex === blockIndex && selectedBlock.isActive;
      const isHighlighted = highlightedBlocks.includes(blockIndex);
      const isHovered = hoveredBlock === blockIndex;

      // Determine CSS classes
      const blockClasses = [
        'block-paragraph',
        `block-type-${blockType}`,
        isSelected && 'block-selected',
        isHighlighted && 'block-highlighted',
        isHovered && 'block-hovered'
      ].filter(Boolean).join(' ');

      // Generate block marker
      const colorScheme = BlockProcessor.getBlockColorScheme(blockType);
      const typeLabel = blockType === 'title' ? '标题' : blockType === 'image' ? '图片' : '文本';

      return `<div class="${blockClasses}" data-block-index="${blockIndex}" data-block-type="${blockType}">
        <div class="block-marker" style="background-color: ${colorScheme.border};">
          <span class="block-index">${blockIndex}</span>
          <span class="block-type-label">${typeLabel}</span>
        </div>
        <div class="block-content">
${paragraph}
        </div>
      </div>`;
    });

    return processedParagraphs.join('\n\n');
  }, [content, blockMappings, selectedBlock, highlightedBlocks, hoveredBlock, syncEnabled]);

  // Handle block interactions
  const handleBlockClick = React.useCallback((event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const blockElement = target.closest('[data-block-index]');
    
    if (blockElement && onBlockClick) {
      const blockIndex = parseInt(blockElement.getAttribute('data-block-index') || '-1', 10);
      if (blockIndex >= 0) {
        onBlockClick(blockIndex);
      }
    }
  }, [onBlockClick]);

  const handleBlockHover = React.useCallback((event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const blockElement = target.closest('[data-block-index]');
    
    if (blockElement) {
      const blockIndex = parseInt(blockElement.getAttribute('data-block-index') || '-1', 10);
      if (blockIndex >= 0 && blockIndex !== hoveredBlock) {
        setHoveredBlock(blockIndex);
        if (onBlockHover) {
          onBlockHover(blockIndex);
        }
      }
    } else if (hoveredBlock !== null) {
      setHoveredBlock(null);
      if (onBlockHover) {
        onBlockHover(null);
      }
    }
  }, [hoveredBlock, onBlockHover]);

  const handleMouseLeave = React.useCallback(() => {
    if (hoveredBlock !== null) {
      setHoveredBlock(null);
      if (onBlockHover) {
        onBlockHover(null);
      }
    }
  }, [hoveredBlock, onBlockHover]);

  // Attach event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !syncEnabled) return;

    container.addEventListener('click', handleBlockClick);
    container.addEventListener('mouseover', handleBlockHover);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('click', handleBlockClick);
      container.removeEventListener('mouseover', handleBlockHover);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [handleBlockClick, handleBlockHover, handleMouseLeave, syncEnabled]);

  // Scroll to selected block
  useEffect(() => {
    if (!syncEnabled || !selectedBlock.isActive || selectedBlock.blockIndex === null) return;

    const container = containerRef.current;
    if (!container) return;

    const targetElement = container.querySelector(`[data-block-index="${selectedBlock.blockIndex}"]`);
    if (targetElement) {
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [selectedBlock, syncEnabled]);

  // Markdown components with custom renderers
  const components = useMemo(() => ({
    // Custom paragraph renderer to preserve block structure
    p: ({ children, ...props }: any) => (
      <p {...props} className="markdown-paragraph">
        {children}
      </p>
    ),
    
    // Custom heading renderers
    h1: ({ children, ...props }: any) => (
      <h1 {...props} className="markdown-heading markdown-h1">
        {children}
      </h1>
    ),
    h2: ({ children, ...props }: any) => (
      <h2 {...props} className="markdown-heading markdown-h2">
        {children}
      </h2>
    ),
    h3: ({ children, ...props }: any) => (
      <h3 {...props} className="markdown-heading markdown-h3">
        {children}
      </h3>
    ),
    h4: ({ children, ...props }: any) => (
      <h4 {...props} className="markdown-heading markdown-h4">
        {children}
      </h4>
    ),
    h5: ({ children, ...props }: any) => (
      <h5 {...props} className="markdown-heading markdown-h5">
        {children}
      </h5>
    ),
    h6: ({ children, ...props }: any) => (
      <h6 {...props} className="markdown-heading markdown-h6">
        {children}
      </h6>
    ),

    // Custom image renderer
    img: ({ src, alt, ...props }: any) => (
      <div className="markdown-image-container">
        <img 
          {...props} 
          src={src} 
          alt={alt}
          className="markdown-image"
          loading="lazy"
        />
        {alt && <figcaption className="markdown-image-caption">{alt}</figcaption>}
      </div>
    ),

    // Custom code block renderer
    pre: ({ children, ...props }: any) => (
      <pre {...props} className="markdown-code-block">
        {children}
      </pre>
    ),

    // Custom inline code renderer
    code: ({ children, ...props }: any) => (
      <code {...props} className="markdown-inline-code">
        {children}
      </code>
    ),

    // Custom blockquote renderer
    blockquote: ({ children, ...props }: any) => (
      <blockquote {...props} className="markdown-blockquote">
        {children}
      </blockquote>
    ),

    // Custom list renderers
    ul: ({ children, ...props }: any) => (
      <ul {...props} className="markdown-list markdown-unordered-list">
        {children}
      </ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol {...props} className="markdown-list markdown-ordered-list">
        {children}
      </ol>
    ),
    li: ({ children, ...props }: any) => (
      <li {...props} className="markdown-list-item">
        {children}
      </li>
    ),

    // Custom table renderers
    table: ({ children, ...props }: any) => (
      <div className="markdown-table-container">
        <table {...props} className="markdown-table">
          {children}
        </table>
      </div>
    ),
    thead: ({ children, ...props }: any) => (
      <thead {...props} className="markdown-table-header">
        {children}
      </thead>
    ),
    tbody: ({ children, ...props }: any) => (
      <tbody {...props} className="markdown-table-body">
        {children}
      </tbody>
    ),
    tr: ({ children, ...props }: any) => (
      <tr {...props} className="markdown-table-row">
        {children}
      </tr>
    ),
    th: ({ children, ...props }: any) => (
      <th {...props} className="markdown-table-header-cell">
        {children}
      </th>
    ),
    td: ({ children, ...props }: any) => (
      <td {...props} className="markdown-table-cell">
        {children}
      </td>
    )
  }), []);

  return (
    <div 
      ref={containerRef}
      className={`block-markdown-viewer ${syncEnabled ? 'sync-enabled' : ''} ${className}`}
      style={{ fontSize: `${fontSize}%` }}
    >
      {/* Block mapping debug info (only in development) */}
      {process.env.NODE_ENV === 'development' && syncEnabled && blockMappings.length > 0 && (
        <div className="block-debug-info">
          <details>
            <summary>Block Mappings ({blockMappings.length})</summary>
            <pre>{JSON.stringify(blockMappings, null, 2)}</pre>
          </details>
        </div>
      )}

      {/* Markdown content */}
      <ReactMarkdown
        components={components}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        className="markdown-content"
      >
        {processedContent}
      </ReactMarkdown>

      {/* Block overlay indicators */}
      {syncEnabled && blockMappings.length > 0 && (
        <div className="block-overlay-info">
          <div className="block-stats">
            已映射 {blockMappings.length} 个区块
          </div>
        </div>
      )}
    </div>
  );
};

export default BlockMarkdownViewer;