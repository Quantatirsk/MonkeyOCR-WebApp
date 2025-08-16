/**
 * BlockMarkdownViewer Component
 * Enhanced Markdown renderer with block marking and sync capabilities
 */

import React, { useMemo, useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism';
// Import specific languages for better performance
import typescript from 'react-syntax-highlighter/dist/cjs/languages/prism/typescript';
import javascript from 'react-syntax-highlighter/dist/cjs/languages/prism/javascript';
import python from 'react-syntax-highlighter/dist/cjs/languages/prism/python';
import bash from 'react-syntax-highlighter/dist/cjs/languages/prism/bash';
import json from 'react-syntax-highlighter/dist/cjs/languages/prism/json';
import markdown from 'react-syntax-highlighter/dist/cjs/languages/prism/markdown';
import css from 'react-syntax-highlighter/dist/cjs/languages/prism/css';
import sql from 'react-syntax-highlighter/dist/cjs/languages/prism/sql';
import yaml from 'react-syntax-highlighter/dist/cjs/languages/prism/yaml';
import { Copy, Check } from 'lucide-react';
import { BlockData, BlockSelection } from '../../types';
import { ContentMatcher, BlockProcessor } from '../../utils/blockProcessor';
import { getMediaFileUrl } from '../../config';
import { TooltipProvider } from '../ui/tooltip';
import { BlockContainer } from './BlockContainer';
import { InlineBlockContainer } from './InlineBlockContainer';
import './block-styles.css';
import './code-block-styles.css';

// Register languages
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('ts', typescript);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('js', javascript);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('py', python);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('sh', bash);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('markdown', markdown);
SyntaxHighlighter.registerLanguage('md', markdown);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('yaml', yaml);
SyntaxHighlighter.registerLanguage('yml', yaml);

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

// Code block component with copy functionality
const CodeBlock: React.FC<{
  language?: string;
  value: string;
  inline?: boolean;
}> = ({ language, value, inline }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  if (inline) {
    return (
      <code className="markdown-inline-code">
        {value}
      </code>
    );
  }

  return (
    <div className="markdown-code-block-container">
      <div className="markdown-code-header">
        <span className="markdown-code-language">
          {language || 'plaintext'}
        </span>
        <button
          onClick={handleCopy}
          className="markdown-code-copy-button"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          <span className="markdown-code-copy-text">
            {copied ? 'Copied!' : 'Copy'}
          </span>
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'plaintext'}
        style={oneLight}
        customStyle={{
          margin: 0,
          borderRadius: '0 0 0.375rem 0.375rem',
          fontSize: '0.75rem',
          padding: '0.75rem',
          lineHeight: '1.4',
        }}
        showLineNumbers={true}
        wrapLines={false}
        wrapLongLines={false}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};



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
    // First, let's identify and protect code blocks
    const codeBlockRegex = /```[\s\S]*?```/g;
    const inlineCodeRegex = /`[^`]+`/g;
    
    // Store code blocks and replace them with placeholders
    const codeBlocks: string[] = [];
    let tempContent = content;
    
    // Replace code blocks with placeholders
    tempContent = tempContent.replace(codeBlockRegex, (match) => {
      const index = codeBlocks.length;
      codeBlocks.push(match);
      return `__CODE_BLOCK_${index}__`;
    });
    
    // Replace inline code with placeholders
    tempContent = tempContent.replace(inlineCodeRegex, (match) => {
      const index = codeBlocks.length;
      codeBlocks.push(match);
      return `__CODE_BLOCK_${index}__`;
    });
    
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
    while ((match = regex.exec(tempContent)) !== null) {
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
      const textBefore = tempContent.substring(lastIndex, htmlMatch.start);
      // Escape angle brackets in non-HTML text
      const escapedText = textBefore.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      processedResult += escapedText;
      
      // Add the HTML tag as-is
      processedResult += htmlMatch.content;
      
      lastIndex = htmlMatch.end;
    }
    
    // Process any remaining text after the last HTML tag
    const remainingText = tempContent.substring(lastIndex);
    const escapedRemaining = remainingText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    processedResult += escapedRemaining;
    
    // Restore code blocks
    codeBlocks.forEach((block, index) => {
      processedResult = processedResult.replace(`__CODE_BLOCK_${index}__`, block);
    });
    
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
      
      // Let rehype-katex handle LaTeX processing
      const processedChildren = children;
      
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
      const imageSrc = src?.startsWith('/media/') ? getMediaFileUrl(src.slice(7)) : src;
      
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
          {alt && <span className="markdown-image-caption" style={{ display: 'block', textAlign: 'center', fontSize: '0.9em', marginTop: '0.5em' }}>{alt}</span>}
        </>
      );
    },

    // Custom code block renderer with syntax highlighting
    pre: ({ children, ...props }: any) => {
      // Extract the code element from pre
      if (children?.props?.children) {
        const className = children.props.className || '';
        const match = /language-(\w+)/.exec(className);
        const language = match ? match[1] : undefined;
        const codeString = String(children.props.children).replace(/\n$/, '');
        
        return (
          <CodeBlock
            language={language}
            value={codeString}
            inline={false}
          />
        );
      }
      
      // Fallback for non-standard code blocks
      return (
        <pre {...props} className="markdown-code-block">
          {children}
        </pre>
      );
    },

    // Custom inline code renderer
    code: ({ inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : undefined;
      
      // For inline code, just render as simple code element
      if (inline !== false) {
        return (
          <code className="markdown-inline-code" {...props}>
            {children}
          </code>
        );
      }
      
      // For block code (when used without pre), use CodeBlock
      const codeString = String(children).replace(/\n$/, '');
      return (
        <CodeBlock
          language={language}
          value={codeString}
          inline={false}
        />
      );
    },

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
        {children}
      </th>
    ),
    td: ({ children, ...props }: any) => (
      <td {...props} className="markdown-table-cell">
        {children}
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
        {children}
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
            remarkMath  // remark-math v6 handles $ automatically
          ]}
          rehypePlugins={[
            rehypeRaw,
            [rehypeKatex, {
              throwOnError: false  // Only keep essential config
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