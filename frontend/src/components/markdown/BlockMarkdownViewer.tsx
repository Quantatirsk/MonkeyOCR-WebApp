/**
 * BlockMarkdownViewer Component
 * Enhanced Markdown renderer with block marking and sync capabilities
 */

import React, { useMemo, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { BlockData, BlockSelection } from '../../types';
import { ContentMatcher, BlockProcessor } from '../../utils/blockProcessor';
import { getStaticFileUrl } from '../../config';
import { TooltipProvider } from '../ui/tooltip';
import { BlockContainer } from './BlockContainer';
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
  /** Font size multiplier */
  fontSize?: number;
  /** CSS class name */
  className?: string;
  /** Translation content map (blockIndex -> translated content) */
  translations?: Map<number, string>;
  /** Explanation content map (blockIndex -> explanation content) */
  explanations?: Map<number, string>;
  /** Streaming translation state */
  streamingTranslation?: {
    blockIndex: number;
    content: string;
    isStreaming: boolean;
    type?: 'translate' | 'explain';
  };
  /** Callback to refresh translation */
  onRefreshTranslation?: (blockIndex: number) => void;
  /** Callback to refresh explanation */
  onRefreshExplanation?: (blockIndex: number) => void;
}

interface BlockMapping {
  blockIndex: number;
  paragraphIndex: number;
  blockType: 'text' | 'title' | 'image' | 'table';
}


// 通用的子元素处理函数，支持 LaTeX 和格式化
function processChildrenWithLatex(children: any): any {
  if (typeof children === 'string') {
    return processWithMathAndFormatting(children);
  }
  if (Array.isArray(children)) {
    return children.map((child, index) => {
      if (typeof child === 'string') {
        return <span key={index}>{processWithMathAndFormatting(child)}</span>;
      }
      // 递归处理嵌套元素
      if (React.isValidElement(child)) {
        const childProps = child.props as any;
        if (childProps?.children) {
          const processedChild = React.cloneElement(child as React.ReactElement<any>, {
            children: processChildrenWithLatex(childProps.children)
          });
          return processedChild;
        }
      }
      return child;
    });
  }
  return children;
}

// 综合处理数学公式和格式标记
function processWithMathAndFormatting(text: string): React.ReactNode {
  if (!text || typeof text !== 'string') return text;
  
  // 先处理数学公式，再处理格式标记
  const mathAndFormatRegex = /(\$\$[^$]+\$\$|\$[^$]+\$|\*\*[^*]+\*\*|\*[^*]+\*|\^[^^]+\^|~[^~]+~)/g;
  const parts = text.split(mathAndFormatRegex);
  
  if (parts.length === 1) {
    return text; // 没有特殊标记
  }
  
  return parts.map((part, index) => {
    if (!part) return null;
    
    // 块级数学公式 $$...$$
    if (part.match(/^\$\$[^$]+\$\$$/)) {
      const mathContent = part.slice(2, -2);
      try {
        const html = katex.renderToString(mathContent, {
          throwOnError: false,
          displayMode: true,
          output: 'html',
          strict: false,
        });
        return (
          <div 
            key={index}
            dangerouslySetInnerHTML={{ __html: html }} 
            style={{ 
              background: 'transparent', 
              textAlign: 'center', 
              margin: '0.5em 0' 
            }} 
          />
        );
      } catch (error) {
        console.error('KaTeX render error:', error);
        return <span key={index}>{part}</span>;
      }
    }
    // 内联数学公式 $...$
    else if (part.match(/^\$[^$]+\$$/)) {
      const mathContent = part.slice(1, -1);
      try {
        const html = katex.renderToString(mathContent, {
          throwOnError: false,
          displayMode: false,
          output: 'html',
          strict: false,
        });
        return (
          <span 
            key={index}
            dangerouslySetInnerHTML={{ __html: html }} 
            style={{ background: 'transparent' }} 
          />
        );
      } catch (error) {
        console.error('KaTeX render error:', error);
        return <span key={index}>{part}</span>;
      }
    }
    // 粗体 **text**
    else if (part.match(/^\*\*[^*]+\*\*$/)) {
      const content = part.slice(2, -2);
      return <strong key={index}>{content}</strong>;
    }
    // 斜体 *text*
    else if (part.match(/^\*[^*]+\*$/) && !part.match(/^\*\*.*\*\*$/)) {
      const content = part.slice(1, -1);
      return <em key={index}>{content}</em>;
    }
    // 上标 ^text^
    else if (part.match(/^\^[^^]+\^$/)) {
      const content = part.slice(1, -1);
      return <sup key={index}>{content}</sup>;
    }
    // 下标 ~text~
    else if (part.match(/^~[^~]+~$/)) {
      const content = part.slice(1, -1);
      return <sub key={index}>{content}</sub>;
    }
    // 普通文本
    else {
      return part ? <span key={index}>{part}</span> : null;
    }
  }).filter(Boolean);
}


export const BlockMarkdownViewer: React.FC<BlockMarkdownViewerProps> = React.memo(({
  content,
  blockData = [],
  selectedBlock = { blockIndex: null, pageNumber: null, isActive: false },
  highlightedBlocks = [],
  syncEnabled = false,
  onBlockClick,
  fontSize = 100,
  className = '',
  translations,
  explanations,
  streamingTranslation,
  onRefreshTranslation,
  onRefreshExplanation,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  

  // Create block-to-paragraph mapping
  const blockMappings = useMemo<BlockMapping[]>(() => {
    if (!syncEnabled || blockData.length === 0) return [];

    // Check if this content was generated by BlockMarkdownGenerator
    // If so, blocks have explicit data-block-index attributes and don't need mapping
    const isGeneratedContent = content.includes('block-container') || content.includes('---');
    
    if (isGeneratedContent) {
      // Blocks are self-identifying through data-block-index attributes
      return []; // No mapping needed
    } else {
      // Fall back to content matching for original markdown
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
    }
  }, [blockData, content, syncEnabled]);

  // Just return clean content for proper Markdown rendering
  const processedContent = useMemo(() => {
    return content;
  }, [content]);

  // Map rendered elements to block indices after render
  const markElementsWithBlockData = React.useCallback(() => {
    if (!syncEnabled || !containerRef.current) return;

    const container = containerRef.current;
    
    // Check if we have block containers (generated content)
    const blockContainers = container.querySelectorAll('.block-container[data-block-index]');
    
    if (blockContainers.length > 0) {
      // Use block containers directly - they already have data-block-index
      blockContainers.forEach((blockContainer) => {
        const blockIndex = parseInt(blockContainer.getAttribute('data-block-index') || '-1', 10);
        
        if (blockIndex >= 0) {
          // Add CSS classes for styling (excluding hover which is handled separately)
          const isSelected = selectedBlock.blockIndex === blockIndex && selectedBlock.isActive;
          const isHighlighted = highlightedBlocks.includes(blockIndex);

          blockContainer.classList.remove('block-selected', 'block-highlighted');
          
          if (isSelected) blockContainer.classList.add('block-selected');
          if (isHighlighted) blockContainer.classList.add('block-highlighted');
          
        }
      });
    } else if (blockMappings.length > 0) {
      // Fallback to paragraph mapping for original content
      const paragraphs = container.querySelectorAll('.markdown-paragraph, .markdown-heading, .markdown-table, .simulated-list-item');
      
      // Clear existing data attributes
      paragraphs.forEach(el => {
        el.removeAttribute('data-block-index');
        el.removeAttribute('data-block-type');
      });

      // Map paragraphs to blocks based on their order
      let renderedParagraphIndex = 0;
      let skippedSeparators = 0;
      
      paragraphs.forEach((paragraph) => {
        
        // Skip if this is a page separator or empty
        const textContent = paragraph.textContent?.trim();
        if (!textContent || textContent === '---') {
          skippedSeparators++;
          return;
        }

        const mapping = blockMappings.find(m => m.paragraphIndex === renderedParagraphIndex);
        if (mapping) {
          paragraph.setAttribute('data-block-index', mapping.blockIndex.toString());
          paragraph.setAttribute('data-block-type', mapping.blockType);
          
          // Add CSS classes for styling (excluding hover which is handled separately)
          const isSelected = selectedBlock.blockIndex === mapping.blockIndex && selectedBlock.isActive;
          const isHighlighted = highlightedBlocks.includes(mapping.blockIndex);

          paragraph.classList.remove('block-selected', 'block-highlighted');
          paragraph.classList.add('block-paragraph', `block-type-${mapping.blockType}`);
          
          if (isSelected) paragraph.classList.add('block-selected');
          if (isHighlighted) paragraph.classList.add('block-highlighted');
          
        }
        
        renderedParagraphIndex++;
      });
    }
  }, [syncEnabled, blockMappings, selectedBlock, highlightedBlocks]);



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



  // Removed hover event handlers - using CSS :hover for better performance

  // Attach event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !syncEnabled) return;

    container.addEventListener('click', handleBlockClick);

    return () => {
      container.removeEventListener('click', handleBlockClick);
    };
  }, [handleBlockClick, syncEnabled]);

  // Effect to mark elements after render
  useEffect(() => {
    markElementsWithBlockData();
  }, [markElementsWithBlockData]);
  
  // Removed hover effect - using CSS :hover for better performance

  // Track previous block index to detect actual changes
  const prevBlockIndexRef = useRef<number | null>(null);
  
  // Scroll to selected block only when block index actually changes
  useEffect(() => {
    if (!syncEnabled || !selectedBlock.isActive || selectedBlock.blockIndex === null) return;

    // Only scroll if the block index has actually changed
    if (prevBlockIndexRef.current === selectedBlock.blockIndex) return;
    
    prevBlockIndexRef.current = selectedBlock.blockIndex;

    const container = containerRef.current;
    if (!container) return;

    // First try to find a block container, then fallback to any element with data-block-index
    let targetElement = container.querySelector(`.block-container[data-block-index="${selectedBlock.blockIndex}"]`);
    if (!targetElement) {
      targetElement = container.querySelector(`[data-block-index="${selectedBlock.blockIndex}"]`);
    }
    
    if (targetElement) {
      // Check if element is already in view
      const rect = targetElement.getBoundingClientRect();
      const isInView = rect.top >= 0 && rect.bottom <= window.innerHeight;
      
      // Only scroll if element is not already in view
      if (!isInView) {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [selectedBlock.blockIndex, selectedBlock.isActive, syncEnabled]);

  // Markdown components with custom renderers
  const components = useMemo(() => ({
    // Custom div renderer for block containers
    div: ({ children, className, ...props }: any) => {
      // Check if this is a block container
      if (className === 'block-container') {
        const blockIndex = parseInt(props['data-block-index'] || '-1', 10);
        
        // 使用专门的 BlockContainer 组件处理翻译覆盖层
        return (
          <BlockContainer
            {...props}
            blockIndex={blockIndex}
            blockData={blockData || []}
            translations={translations}
            explanations={explanations}
            streamingTranslation={streamingTranslation}
            onRefreshTranslation={onRefreshTranslation}
            onRefreshExplanation={onRefreshExplanation}
          >
            {children}
          </BlockContainer>
        );
      }
      // Default div rendering
      return <div className={className} {...props}>{children}</div>;
    },
    
    // Custom paragraph renderer with LaTeX support
    p: ({ children, ...props }: any) => {
      const processedChildren = processChildrenWithLatex(children);
      
      // Check if children contains an image (which would have a div.markdown-image-container)
      // If so, render as div instead of p to avoid nesting issues
      const hasImage = React.Children.toArray(children).some((child: any) => 
        child?.props?.className === 'markdown-image-container'
      );
      
      if (hasImage) {
        return (
          <div {...props} className="markdown-paragraph">
            {processedChildren}
          </div>
        );
      }
      
      return (
        <p {...props} className="markdown-paragraph">
          {processedChildren}
        </p>
      );
    },
    
    // Custom heading renderers - simplified with a factory function
    ...(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].reduce((acc, tag) => {
      acc[tag] = ({ children, ...props }: any) => {
        const HeadingTag = tag as keyof JSX.IntrinsicElements;
        return React.createElement(
          HeadingTag,
          { ...props, className: `markdown-heading markdown-${tag}` },
          children
        );
      };
      return acc;
    }, {} as Record<string, any>)),
    
    

    // Custom image renderer
    img: ({ src, alt, ...props }: any) => {
      // Convert relative static paths to full URLs
      const imageSrc = src?.startsWith('/static/') ? getStaticFileUrl(src.slice(8)) : src;
      
      return (
        <div className="markdown-image-container">
          <img 
            {...props} 
            src={imageSrc} 
            alt={alt}
            className="markdown-image"
            loading="lazy"
          />
          {alt && <figcaption className="markdown-image-caption">{alt}</figcaption>}
        </div>
      );
    },

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
        {processChildrenWithLatex(children)}
      </th>
    ),
    td: ({ children, ...props }: any) => (
      <td {...props} className="markdown-table-cell">
        {processChildrenWithLatex(children)}
      </td>
    ),
    
    // Custom unordered list renderer
    ul: ({ children, ...props }: any) => (
      <ul {...props} className="markdown-unordered-list">
        {children}
      </ul>
    ),
    
    // Custom ordered list renderer
    ol: ({ children, ...props }: any) => (
      <ol {...props} className="markdown-ordered-list">
        {children}
      </ol>
    ),
    
    // Custom list item renderer with LaTeX support
    li: ({ children, ...props }: any) => (
      <li {...props} className="markdown-list-item">
        {processChildrenWithLatex(children)}
      </li>
    )
  }), [blockData, translations, explanations, streamingTranslation]);

  return (
    <TooltipProvider>
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
          remarkPlugins={[
            remarkGfm,
            [remarkMath, {
              singleDollarTextMath: true,
              inlineMathDouble: false,
            }]
          ]}
          rehypePlugins={[
            rehypeRaw,
            [rehypeKatex, {
              strict: false,
              throwOnError: false,
              errorColor: '#cc0000',
              output: 'html',
              displayMode: false,
              macros: {
                "\\RR": "\\mathbb{R}",
                "\\NN": "\\mathbb{N}",
                "\\ZZ": "\\mathbb{Z}",
                "\\QQ": "\\mathbb{Q}",
                "\\CC": "\\mathbb{C}",
              },
              trust: (context: any) => ['htmlId', 'htmlClass', 'htmlStyle', 'htmlData'].includes(context.command),
            }]
          ]}
          className="markdown-content"
        >
          {processedContent}
        </ReactMarkdown>

      </div>
    </TooltipProvider>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo optimization
  return (
    prevProps.content === nextProps.content &&
    prevProps.syncEnabled === nextProps.syncEnabled &&
    prevProps.fontSize === nextProps.fontSize &&
    prevProps.className === nextProps.className &&
    prevProps.selectedBlock?.blockIndex === nextProps.selectedBlock?.blockIndex &&
    prevProps.selectedBlock?.isActive === nextProps.selectedBlock?.isActive &&
    JSON.stringify(prevProps.highlightedBlocks) === JSON.stringify(nextProps.highlightedBlocks) &&
    prevProps.blockData?.length === nextProps.blockData?.length &&
    prevProps.translations?.size === nextProps.translations?.size &&
    prevProps.explanations?.size === nextProps.explanations?.size &&
    prevProps.streamingTranslation?.blockIndex === nextProps.streamingTranslation?.blockIndex &&
    prevProps.streamingTranslation?.isStreaming === nextProps.streamingTranslation?.isStreaming &&
    prevProps.streamingTranslation?.content === nextProps.streamingTranslation?.content &&  // 比较流式内容
    prevProps.streamingTranslation?.type === nextProps.streamingTranslation?.type  // 比较流式类型
  );
});

export default BlockMarkdownViewer;