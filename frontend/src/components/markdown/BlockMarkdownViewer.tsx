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
import { InlineBlockContainer } from './InlineBlockContainer';
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
  /** Callback to translate block */
  onTranslateBlock?: (blockIndex: number) => void;
  /** Callback to explain block */
  onExplainBlock?: (blockIndex: number) => void;
  /** Callback to mark block */
  onMarkBlock?: (blockIndex: number) => void;
  /** Use inline translation display instead of overlay */
  useInlineTranslation?: boolean;
}

interface BlockMapping {
  blockIndex: number;
  paragraphIndex: number;
  blockType: 'text' | 'title' | 'image' | 'table' | 'interline_equation';
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
  // 添加对 \begin{...}\end{...} 环境的支持
  const mathAndFormatRegex = /(\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}|\$\$[^$]+\$\$|\$[^$]+\$|\*\*[^*]+\*\*|\*[^*]+\*|\^[^^]+\^|~[^~]+~)/g;
  const parts = text.split(mathAndFormatRegex);
  
  if (parts.length === 1) {
    return text; // 没有特殊标记
  }
  
  return parts.map((part, index) => {
    if (!part) return null;
    
    // LaTeX 环境 \begin{...}...\end{...}
    if (part.match(/^\\begin\{[^}]+\}/)) {
      try {
        const html = katex.renderToString(part, {
          throwOnError: false,
          displayMode: true,
          output: 'html',
          strict: false,
          trust: true,
        });
        return (
          <div 
            key={index}
            dangerouslySetInnerHTML={{ __html: html }} 
            style={{ 
              background: 'transparent', 
              textAlign: 'center', 
              margin: '0.5em auto',
              display: 'block'
            }} 
          />
        );
      } catch (error) {
        console.error('KaTeX render error for LaTeX environment:', error);
        return <span key={index}>{part}</span>;
      }
    }
    // 块级数学公式 $$...$$
    else if (part.match(/^\$\$[^$]+\$\$$/)) {
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
              margin: '0.5em auto',
              display: 'block'
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
  onTranslateBlock,
  onExplainBlock,
  onMarkBlock,
  useInlineTranslation = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  

  // Create block-to-paragraph mapping
  const blockMappings = useMemo<BlockMapping[]>(() => {
    if (!syncEnabled || blockData.length === 0) return [];

    // Check if this content was generated by BlockMarkdownGenerator
    // If so, blocks have explicit data-block-index attributes and don't need mapping
    const isGeneratedContent = content.includes('block-container');
    
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

  // Process content to escape non-HTML angle brackets
  const processedContent = useMemo(() => {
    // List of valid HTML tags that should not be escaped
    const validHtmlTags = [
      'div', 'span', 'p', 'a', 'img', 'table', 'tr', 'td', 'th', 'thead', 'tbody',
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'strong', 'em', 'b', 'i', 'u', 'code', 'pre', 'blockquote',
      'br', 'hr', 'sub', 'sup', 'mark', 'del', 'ins', 'small',
      'section', 'article', 'header', 'footer', 'nav', 'aside'
    ];
    
    // Create a regex pattern for valid HTML tags (opening and closing)
    const validTagPattern = validHtmlTags.map(tag => 
      `<\\/?${tag}(?:\\s[^>]*)?>` // Matches <tag>, </tag>, or <tag attr="value">
    ).join('|');
    
    // Also match HTML comments and doctype
    const htmlPattern = new RegExp(`(${validTagPattern}|<!--[\\s\\S]*?-->|<!DOCTYPE[^>]*>)`, 'gi');
    
    // Replace < and > that are NOT part of valid HTML tags
    const htmlMatches: { start: number; end: number; content: string }[] = [];
    
    // First, find all valid HTML tags and store their positions
    let match;
    const regex = new RegExp(htmlPattern);
    while ((match = regex.exec(content)) !== null) {
      htmlMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[0]
      });
    }
    
    // Sort matches by position
    htmlMatches.sort((a, b) => a.start - b.start);
    
    // Build the result string, escaping non-HTML angle brackets
    let processedResult = '';
    let lastIndex = 0;
    
    for (const htmlMatch of htmlMatches) {
      // Process the text before this HTML tag
      const textBefore = content.substring(lastIndex, htmlMatch.start);
      // Escape angle brackets in non-HTML text
      const escapedText = textBefore.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      processedResult += escapedText;
      
      // Add the HTML tag as-is
      processedResult += htmlMatch.content;
      
      lastIndex = htmlMatch.end;
    }
    
    // Process any remaining text after the last HTML tag
    const remainingText = content.substring(lastIndex);
    const escapedRemaining = remainingText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    processedResult += escapedRemaining;
    
    return processedResult;
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
        
        // Skip if empty
        const textContent = paragraph.textContent?.trim();
        if (!textContent) {
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
    
    // Check if click is from hover actions - if so, ignore it
    if (target.closest('.block-hover-actions')) {
      return;
    }
    
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

  // Removed automatic scrolling on selection change
  // Scrolling is now handled explicitly through scrollToBlockInMarkdown calls
  // This prevents bidirectional scrolling issues

  // Markdown components with custom renderers
  const components = useMemo(() => ({
    // Custom div renderer for block containers
    div: ({ children, className, ...props }: any) => {
      // Check if this is a block container
      if (className === 'block-container') {
        const blockIndex = parseInt(props['data-block-index'] || '-1', 10);
        
        // 根据useInlineTranslation选择使用哪种容器组件
        const ContainerComponent = useInlineTranslation ? InlineBlockContainer : BlockContainer;
        
        return (
          <ContainerComponent
            {...props}
            blockIndex={blockIndex}
            blockData={blockData || []}
            translations={translations}
            explanations={explanations}
            streamingTranslation={streamingTranslation}
            onRefreshTranslation={onRefreshTranslation}
            onRefreshExplanation={onRefreshExplanation}
            onTranslateBlock={onTranslateBlock}
            onExplainBlock={onExplainBlock}
            onMarkBlock={onMarkBlock}
          >
            {children}
          </ContainerComponent>
        );
      }
      // Default div rendering
      return <div className={className} {...props}>{children}</div>;
    },
    
    // Custom paragraph renderer with LaTeX support
    p: ({ children, ...props }: any) => {
      // Check if children contains block-level elements that can't be inside <p>
      const hasBlockElement = React.Children.toArray(children).some((child: any) => {
        // Check for img elements or elements with type 'img'
        if (child?.type === 'img' || 
            child?.props?.mdxType === 'img' ||
            (typeof child === 'object' && child?.type?.name === 'img')) {
          return true;
        }
        
        // Check for div elements (including block-container divs)
        if (child?.type === 'div' || 
            (typeof child === 'object' && child?.type?.name === 'div') ||
            child?.props?.className?.includes('block-container')) {
          return true;
        }
        
        // Check if this is a BlockContainer component
        if (child?.type?.name === 'BlockContainer') {
          return true;
        }
        
        return false;
      });
      
      const processedChildren = processChildrenWithLatex(children);
      
      if (hasBlockElement) {
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
    
    

    // Custom image renderer - returns just the img element, no wrapper
    img: ({ src, alt, ...props }: any) => {
      // Convert relative static paths to full URLs
      const imageSrc = src?.startsWith('/static/') ? getStaticFileUrl(src.slice(8)) : src;
      
      // Return image with optional caption as a fragment
      // The parent component will handle proper wrapping
      return (
        <>
          <img 
            {...props} 
            src={imageSrc} 
            alt={alt}
            className="markdown-image"
            loading="lazy"
            style={{ 
              maxWidth: '90%', 
              height: 'auto',
              display: 'block',
              margin: '0 auto'
            }}
          />
          {alt && <span className="markdown-image-caption" style={{ display: 'block', textAlign: 'center', fontSize: '0.9em', marginTop: '0.5em' }}>{processWithMathAndFormatting(alt)}</span>}
        </>
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
      <div className="markdown-table-container" style={{ 
        display: 'flex', 
        justifyContent: 'center',
        width: '100%'
      }}>
        <table {...props} className="markdown-table" style={{
          margin: '0 auto'
        }}>
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
    ),
    
    // Custom link renderer for URLs and emails
    a: ({ href, children, ...props }: any) => {
      // Determine if it's an email link
      const isEmail = href?.startsWith('mailto:');
      
      return (
        <a 
          {...props}
          href={href}
          target={!isEmail ? "_blank" : undefined}
          rel={!isEmail ? "noopener noreferrer" : undefined}
          className="markdown-link"
          style={{
            color: 'hsl(var(--primary))',
            textDecoration: 'underline',
            textUnderlineOffset: '2px',
            transition: 'opacity 0.2s',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.8';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          {children}
        </a>
      );
    }
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
});

export default BlockMarkdownViewer;