/**
 * InlineBlockContainer Component
 * 用于翻译tab的内联翻译显示容器
 * 将翻译内容直接追加在原内容后面，而不是使用覆盖层
 */

import React, { useMemo, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import katex from 'katex';
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
import { BlockData } from '../../types';
import { BlockProcessor } from '../../utils/blockProcessor';
import { getMediaFileUrl } from '../../config';
import { toast } from 'sonner';
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

interface InlineBlockContainerProps {
  blockIndex: number;
  blockData: BlockData[];
  translations: Map<number, string> | undefined;
  streamingTranslation: {
    blockIndex: number;
    content: string;
    isStreaming: boolean;
    type?: 'translate' | 'explain';
  } | undefined;
  onTranslateBlock?: (blockIndex: number) => void;
  onExplainBlock?: (blockIndex: number) => void;
  onMarkBlock?: (blockIndex: number) => void;
  onRefreshTranslation?: (blockIndex: number) => void;
  onRefreshExplanation?: (blockIndex: number) => void;
  explanations?: Map<number, string> | undefined;
  children: React.ReactNode;
  [key: string]: any;
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

export const InlineBlockContainer: React.FC<InlineBlockContainerProps> = React.memo(({
  blockIndex,
  blockData,
  translations,
  streamingTranslation,
  onTranslateBlock,
  onExplainBlock,
  onMarkBlock,
  onRefreshTranslation,
  onRefreshExplanation,
  explanations,
  children,
  ...props
}) => {
  // Create a clean props object without non-HTML attributes
  const cleanProps = { ...props };
  // Remove any remaining function props that shouldn't be on DOM elements
  delete cleanProps.onTranslateBlock;
  delete cleanProps.onExplainBlock;
  delete cleanProps.onMarkBlock;
  delete cleanProps.onRefreshTranslation;
  delete cleanProps.onRefreshExplanation;
  delete cleanProps.explanations;
  const [isSelected, setIsSelected] = useState(false);
  
  const currentBlockData = useMemo(() => 
    blockIndex >= 0 ? BlockProcessor.findBlockByIndex(blockData || [], blockIndex) : null,
    [blockIndex, blockData]
  );
  
  // 获取翻译内容
  const translationContent = useMemo(() => 
    translations?.get(blockIndex) || null,
    [translations, blockIndex]
  );
  
  // 检查是否正在流式传输
  const isStreamingForThisBlock = streamingTranslation?.blockIndex === blockIndex;
  const streamContent = isStreamingForThisBlock ? streamingTranslation?.content || '' : '';
  const streamType = isStreamingForThisBlock ? streamingTranslation?.type : null;
  
  // 决定显示的内容
  const displayContent = useMemo(() => {
    if (isStreamingForThisBlock && streamType === 'translate') {
      return streamContent || '正在翻译...';
    }
    return translationContent;
  }, [isStreamingForThisBlock, streamType, streamContent, translationContent]);
  
  const shouldShowTranslation = !!(displayContent);
  
  // Helper function to process LaTeX in HTML content
  const processLatexInHTML = (html: string): string => {
    if (!katex) {
      console.warn('KaTeX not available for HTML LaTeX rendering');
      return html;
    }
    
    // Process LaTeX expressions in the HTML
    const latexRegex = /\$([^$]+)\$/g;
    
    return html.replace(latexRegex, (match, latex) => {
      // Check if this looks like LaTeX
      const isLikelyLatex = 
        latex.includes('\\') || // Has backslash command
        latex.includes('^') ||   // Has superscript
        latex.includes('_') ||   // Has subscript  
        latex.includes('{') ||   // Has grouping
        /\b(alpha|beta|gamma|tau|pi|sigma|theta|checkmark|times|uparrow|downarrow)\b/.test(latex); // Common math terms
      
      if (!isLikelyLatex) {
        // Probably not LaTeX, return as-is
        return match;
      }
      
      try {
        // Render the LaTeX to HTML
        const rendered = katex.renderToString(latex, {
          throwOnError: false,
          displayMode: false,
        });
        return rendered;
      } catch (error) {
        console.warn('Failed to render LaTeX:', latex, error);
        return match;
      }
    });
  };

  // 处理翻译内容的markdown渲染
  const processedTranslation = useMemo(() => {
    if (!displayContent) return '';
    
    let processed = displayContent;
    
    // 特殊处理title类型区块：如果是title区块且内容不以##开头，自动添加
    if (currentBlockData?.type === 'title') {
      // 检查是否已经有markdown标题标记
      const hasHeadingMarker = /^#{1,6}\s/.test(processed.trim());
      if (!hasHeadingMarker) {
        // 如果没有标题标记，添加二级标题标记
        processed = `## ${processed.trim()}`;
      }
    }
    
    // 处理图片路径
    processed = processed.replace(
      /!\[([^\]]*)\]\(\/media\/([^)]+)\)/g,
      (_, alt, path) => `![${alt}](${getMediaFileUrl(path)})`
    );
    
    // Check if it's pure HTML table content
    const isHTMLTable = processed.trim().startsWith('<table') && processed.trim().endsWith('</table>');
    if (isHTMLTable) {
      // Process LaTeX in the HTML table
      processed = processLatexInHTML(processed);
    }
    
    return processed;
  }, [displayContent, currentBlockData]);
  
  // 处理区块点击
  const handleBlockClick = useCallback(() => {
    if (shouldShowTranslation) {
      setIsSelected(prev => !prev);
    }
  }, [shouldShowTranslation]);
  
  // 复制译文
  const handleCopyTranslation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止触发区块点击
    
    if (!displayContent) return;
    
    // 对于title类型，确保复制的内容有正确的markdown格式
    let contentToCopy = displayContent;
    if (currentBlockData?.type === 'title') {
      const hasHeadingMarker = /^#{1,6}\s/.test(contentToCopy.trim());
      if (!hasHeadingMarker) {
        contentToCopy = `## ${contentToCopy.trim()}`;
      }
    }
    
    navigator.clipboard.writeText(contentToCopy)
      .then(() => {
        toast.success('译文已复制');
        setIsSelected(false); // 复制后取消选中
      })
      .catch(() => {
        toast.error('复制失败');
      });
  }, [displayContent, currentBlockData]);
  
  // 如果有翻译，显示原文和译文
  if (shouldShowTranslation) {
    return (
      <div 
        {...cleanProps} 
        className={`block-container inline-translation-container with-translation ${isSelected ? 'selected' : ''}`}
        onClick={handleBlockClick}
      >
        {/* 复制按钮 - 选中时显示 */}
        {isSelected && (
          <button
            onClick={handleCopyTranslation}
            className="absolute top-2 right-2 p-1.5 bg-white rounded-md shadow-md hover:bg-gray-50 transition-colors z-10"
            title="复制译文"
          >
            <Copy className="w-4 h-4 text-gray-600" />
          </button>
        )}
        
        {/* 原始内容 */}
        <div className="original-section">
          {children}
        </div>
        
        {/* 译文部分 - 直接显示内容，无需标记 */}
        <div className="translation-section">
          <div className="translation-content-wrapper">
            <ReactMarkdown
              remarkPlugins={[
                remarkGfm,
                remarkMath  // remark-math v6 handles $ automatically
              ]}
              rehypePlugins={[
                rehypeRaw,
                [rehypeKatex, { throwOnError: false }]
              ]}
              className="markdown-content translation-markdown"
              components={{
                // 复用 BlockMarkdownViewer 的完整组件配置
                p: ({ children, ...props }: any) => (
                  <p {...props} className="markdown-paragraph">
                    {children}
                  </p>
                ),
                h1: ({ children, ...props }: any) => (
                  <h1 {...props} className="markdown-heading markdown-h1">{children}</h1>
                ),
                h2: ({ children, ...props }: any) => (
                  <h2 {...props} className="markdown-heading markdown-h2">{children}</h2>
                ),
                h3: ({ children, ...props }: any) => (
                  <h3 {...props} className="markdown-heading markdown-h3">{children}</h3>
                ),
                h4: ({ children, ...props }: any) => (
                  <h4 {...props} className="markdown-heading markdown-h4">{children}</h4>
                ),
                h5: ({ children, ...props }: any) => (
                  <h5 {...props} className="markdown-heading markdown-h5">{children}</h5>
                ),
                h6: ({ children, ...props }: any) => (
                  <h6 {...props} className="markdown-heading markdown-h6">{children}</h6>
                ),
                // 图片
                img: ({ src, alt, ...props }: any) => {
                  const imageSrc = src?.startsWith('/media/') ? getMediaFileUrl(src.slice(7)) : src;
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
                      {alt && <span className="markdown-image-caption">{alt}</span>}
                    </>
                  );
                },
                // 表格 - 完整配置
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
                // 列表
                ul: ({ children, ...props }: any) => (
                  <ul {...props} className="markdown-unordered-list">
                    {children}
                  </ul>
                ),
                ol: ({ children, ...props }: any) => (
                  <ol {...props} className="markdown-ordered-list">
                    {children}
                  </ol>
                ),
                li: ({ children, ...props }: any) => (
                  <li {...props} className="markdown-list-item">
                    {children}
                  </li>
                ),
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
                // 引用
                blockquote: ({ children, ...props }: any) => (
                  <blockquote {...props} className="markdown-blockquote">
                    {children}
                  </blockquote>
                ),
                // 链接
                a: ({ href, children, ...props }: any) => {
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
                    >
                      {children}
                    </a>
                  );
                }
              }}
            >
              {processedTranslation}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }
  
  // 没有翻译时，使用普通容器
  return (
    <div {...cleanProps} className="block-container inline-translation-container">
      <div className="block-content-wrapper original-content">
        {children}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数，优化重新渲染
  return (
    prevProps.blockIndex === nextProps.blockIndex &&
    prevProps.blockData === nextProps.blockData &&
    prevProps.translations === nextProps.translations &&
    prevProps.streamingTranslation?.blockIndex === nextProps.streamingTranslation?.blockIndex &&
    prevProps.streamingTranslation?.isStreaming === nextProps.streamingTranslation?.isStreaming &&
    prevProps.streamingTranslation?.content === nextProps.streamingTranslation?.content &&
    prevProps.streamingTranslation?.type === nextProps.streamingTranslation?.type &&
    prevProps.children === nextProps.children
  );
});

InlineBlockContainer.displayName = 'InlineBlockContainer';