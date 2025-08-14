/**
 * CompactMarkdownViewer Component
 * 专门用于ContentEnhancementOverlay的紧凑型Markdown渲染器
 * 特点：极小字号、紧凑间距、保持表格和公式渲染正确性
 */

import React, { useRef, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import 'katex/dist/katex.min.css';
import { getStaticFileUrl } from '../../config';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import katex from 'katex';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
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
import '../markdown/code-block-styles.css';

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

interface CompactMarkdownViewerProps {
  content: string;
  className?: string;
  overlayType?: 'translate' | 'explain';
  useCompactStyle?: boolean; // 是否使用紧凑样式，默认为true
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
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: '0 0 0.375rem 0.375rem',
          fontSize: '0.875rem',
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

// 处理数学公式和格式标记 - 与 BlockMarkdownViewer 保持一致
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
          macros: {
            "\\RR": "\\mathbb{R}",
            "\\NN": "\\mathbb{N}",
            "\\ZZ": "\\mathbb{Z}",
            "\\QQ": "\\mathbb{Q}",
            "\\CC": "\\mathbb{C}",
          }
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
          macros: {
            "\\RR": "\\mathbb{R}",
            "\\NN": "\\mathbb{N}",
            "\\ZZ": "\\mathbb{Z}",
            "\\QQ": "\\mathbb{Q}",
            "\\CC": "\\mathbb{C}",
          }
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
          macros: {
            "\\RR": "\\mathbb{R}",
            "\\NN": "\\mathbb{N}",
            "\\ZZ": "\\mathbb{Z}",
            "\\QQ": "\\mathbb{Q}",
            "\\CC": "\\mathbb{C}",
          }
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

export function CompactMarkdownViewer({ content, className = '', overlayType = 'translate', useCompactStyle = true }: CompactMarkdownViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 根据覆盖层类型设置主题色
  const isExplain = overlayType === 'explain';
  const themeColorClass = isExplain ? 'compact-markdown-explain' : 'compact-markdown-translate';

  // 动态注入紧凑型样式
  React.useEffect(() => {
    const styleId = 'compact-markdown-styles';
    
    if (document.getElementById(styleId)) return;
    
    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    
    // 紧凑型Markdown样式
    styleElement.textContent = `
      /* 紧凑型Markdown样式 - 翻译模式 */
      .compact-markdown-translate {
        font-size: 12px !important;
        line-height: 1.4 !important;
        color: #1f2937 !important;
      }
      
      .compact-markdown-translate .wmde-markdown,
      .compact-markdown-translate .w-md-editor-preview {
        font-size: 12px !important;
        line-height: 1.4 !important;
        color: #1f2937 !important;
      }

      /* 紧凑型Markdown样式 - 解释模式 */
      .compact-markdown-explain {
        font-size: 12px !important;
        line-height: 1.4 !important;
        color: #1f2937 !important;
      }
      
      .compact-markdown-explain .wmde-markdown,
      .compact-markdown-explain .w-md-editor-preview {
        font-size: 12px !important;
        line-height: 1.4 !important;
        color: #1f2937 !important;
      }

      /* 标题样式 - 极小间距，使用主题蓝色系 CSS 变量 */
      .compact-markdown-translate h1, .compact-markdown-explain h1,
      .compact-markdown-translate .wmde-markdown h1, .compact-markdown-explain .wmde-markdown h1 {
        font-size: 15px !important;
        font-weight: 600 !important;
        margin: 4px 0 2px 0 !important;
        color: hsl(var(--primary)) !important;
      }
      
      .compact-markdown-translate h2, .compact-markdown-explain h2,
      .compact-markdown-translate .wmde-markdown h2, .compact-markdown-explain .wmde-markdown h2 {
        font-size: 14px !important;
        font-weight: 600 !important;
        margin: 3px 0 2px 0 !important;
        color: hsl(var(--primary)) !important;
      }
      
      .compact-markdown-translate h3, .compact-markdown-explain h3,
      .compact-markdown-translate .wmde-markdown h3, .compact-markdown-explain .wmde-markdown h3 {
        font-size: 13px !important;
        font-weight: 600 !important;
        margin: 2px 0 1px 0 !important;
        color: hsl(var(--secondary)) !important;
      }

      .compact-markdown-translate h4, .compact-markdown-translate h5, .compact-markdown-translate h6,
      .compact-markdown-explain h4, .compact-markdown-explain h5, .compact-markdown-explain h6,
      .compact-markdown-translate .wmde-markdown h4, .compact-markdown-translate .wmde-markdown h5, .compact-markdown-translate .wmde-markdown h6,
      .compact-markdown-explain .wmde-markdown h4, .compact-markdown-explain .wmde-markdown h5, .compact-markdown-explain .wmde-markdown h6 {
        font-size: 12px !important;
        font-weight: 600 !important;
        margin: 2px 0 1px 0 !important;
        color: hsl(var(--secondary)) !important;
      }

      /* 段落和文本 - 极小间距，黑色文字 */
      .compact-markdown-translate p, .compact-markdown-explain p,
      .compact-markdown-translate .wmde-markdown p, .compact-markdown-explain .wmde-markdown p {
        margin: 2px 0 !important;
        font-size: 12px !important;
        line-height: 1.4 !important;
        color: #1f2937 !important;
      }

      /* 列表 - 极小缩进和间距 */
      .compact-markdown-translate ul, .compact-markdown-explain ul,
      .compact-markdown-translate .wmde-markdown ul, .compact-markdown-explain .wmde-markdown ul {
        margin: 2px 0 2px 12px !important;
        padding-left: 8px !important;
        font-size: 11px !important;
        list-style-type: disc !important;
        list-style-position: outside !important;
      }
      
      .compact-markdown-translate ol, .compact-markdown-explain ol,
      .compact-markdown-translate .wmde-markdown ol, .compact-markdown-explain .wmde-markdown ol {
        margin: 2px 0 2px 12px !important;
        padding-left: 8px !important;
        font-size: 11px !important;
        list-style-type: decimal !important;
        list-style-position: outside !important;
      }

      .compact-markdown-translate li, .compact-markdown-explain li,
      .compact-markdown-translate .wmde-markdown li, .compact-markdown-explain .wmde-markdown li {
        margin: 1px 0 !important;
        font-size: 12px !important;
        line-height: 1.4 !important;
        color: #1f2937 !important;
        display: list-item !important;
      }

      /* 表格样式 - 保持功能性但缩小尺寸 */
      .compact-markdown-translate table, .compact-markdown-explain table,
      .compact-markdown-translate .wmde-markdown table, .compact-markdown-explain .wmde-markdown table {
        font-size: 10px !important;
        line-height: 1.2 !important;
        margin: 4px auto !important; /* Center the table with auto margins */
        border-collapse: collapse !important;
        width: auto !important; /* Changed from 100% to auto - same as BlockMarkdownViewer */
        max-width: 100% !important;
        word-break: normal !important;
        table-layout: auto !important;
        overflow: visible !important;
        /* Add outer border to table element itself - same as BlockMarkdownViewer */
        border: 1px solid #6b7280 !important;
        border-radius: 0.375rem !important; /* Subtle rounded corners */
        display: table !important; /* Ensure table display */
      }

      .compact-markdown-translate th, .compact-markdown-translate td,
      .compact-markdown-explain th, .compact-markdown-explain td,
      .compact-markdown-translate .wmde-markdown th, .compact-markdown-translate .wmde-markdown td,
      .compact-markdown-explain .wmde-markdown th, .compact-markdown-explain .wmde-markdown td {
        padding: 2px 4px !important;
        border: 1px solid #6b7280 !important;
        font-size: 10px !important;
        line-height: 1.2 !important;
        word-break: break-word !important;
        overflow-wrap: break-word !important;
        vertical-align: top !important;
      }

      .compact-markdown-translate th, .compact-markdown-explain th,
      .compact-markdown-translate .wmde-markdown th, .compact-markdown-explain .wmde-markdown th {
        background-color: #f9fafb !important;
        font-weight: 600 !important;
        color: #374151 !important;
      }

      /* 代码样式 - 保持可读性 */
      .compact-markdown-translate code, .compact-markdown-explain code,
      .compact-markdown-translate .wmde-markdown code, .compact-markdown-explain .wmde-markdown code {
        font-size: 10px !important;
        padding: 1px 3px !important;
        background-color: #f3f4f6 !important;
        border-radius: 2px !important;
        font-family: 'Monaco', 'Consolas', monospace !important;
      }

      .compact-markdown-translate pre, .compact-markdown-explain pre,
      .compact-markdown-translate .wmde-markdown pre, .compact-markdown-explain .wmde-markdown pre {
        font-size: 10px !important;
        line-height: 1.3 !important;
        padding: 6px 8px !important;
        margin: 3px 0 !important;
        background-color: #f3f4f6 !important;
        border-radius: 3px !important;
        overflow-x: auto !important;
        max-width: 100% !important;
      }

      /* 数学公式样式 - 确保KaTeX正确渲染 */
      .compact-markdown-translate .katex, .compact-markdown-explain .katex {
        font-size: 0.9em !important;
        white-space: nowrap !important;
        word-break: normal !important;
        overflow-wrap: normal !important;
        display: inline !important;
      }

      .compact-markdown-translate .katex-display, .compact-markdown-explain .katex-display {
        margin: 0.3em auto !important;
        white-space: nowrap !important;
        word-break: normal !important;
        overflow-wrap: normal !important;
        display: block !important;
        text-align: center !important;
      }
      
      /* 居中显示图片 */
      .compact-markdown-translate img, .compact-markdown-explain img {
        display: block !important;
        margin: 0.5em auto !important;
        max-width: 100% !important;
        height: auto !important;
      }
      
      /* 居中显示表格容器，但保持单元格内容正常对齐 */
      .compact-markdown-translate .markdown-table-container,
      .compact-markdown-explain .markdown-table-container {
        display: flex !important;
        justify-content: center !important;
        width: 100% !important;
        overflow-x: auto !important;
      }
      
      /* 确保表格容器内的表格居中 */
      .compact-markdown-translate .markdown-table-container table,
      .compact-markdown-explain .markdown-table-container table {
        margin: 0 auto !important;
        width: auto !important;
      }
      
      /* 居中显示数学公式块 */
      .compact-markdown-translate .katex-display,
      .compact-markdown-explain .katex-display,
      .compact-markdown-translate .block-container[data-block-type="interline_equation"],
      .compact-markdown-explain .block-container[data-block-type="interline_equation"] {
        display: block !important;
        text-align: center !important;
        margin: 0.5em auto !important;
      }

      /* KaTeX内部元素不应该被强制换行 */
      .compact-markdown-translate .katex *,
      .compact-markdown-explain .katex * {
        white-space: nowrap !important;
        word-break: normal !important;
        overflow-wrap: normal !important;
        word-wrap: normal !important;
      }

      /* KaTeX HTML渲染器特殊处理 */
      .compact-markdown-translate .katex-html,
      .compact-markdown-explain .katex-html {
        white-space: nowrap !important;
        word-break: normal !important;
        overflow-wrap: normal !important;
      }

      /* 引用块 */
      .compact-markdown-translate blockquote, .compact-markdown-explain blockquote,
      .compact-markdown-translate .wmde-markdown blockquote, .compact-markdown-explain .wmde-markdown blockquote {
        margin: 3px 0 3px 8px !important;
        padding: 2px 8px !important;
        border-left: 2px solid #e5e7eb !important;
        background-color: #f9fafb !important;
        font-size: 11px !important;
        line-height: 1.3 !important;
      }

      /* 分隔线样式 - 适中间距 */
      .compact-markdown-translate hr, .compact-markdown-explain hr,
      .compact-markdown-translate .wmde-markdown hr, .compact-markdown-explain .wmde-markdown hr {
        margin: 6px 0 !important;
        padding: 0 !important;
        height: 1px !important;
        border: none !important;
        background-color: #e5e7eb !important;
      }

      /* 智能文本换行 - 优先保持单词完整性，但排除KaTeX元素 */
      .compact-markdown-translate *:not(.katex):not(.katex *),
      .compact-markdown-explain *:not(.katex):not(.katex *),
      .compact-markdown-translate .wmde-markdown *:not(.katex):not(.katex *),
      .compact-markdown-explain .wmde-markdown *:not(.katex):not(.katex *) {
        word-break: break-word !important;
        overflow-wrap: break-word !important;
        word-wrap: break-word !important;
        max-width: 100% !important;
        min-width: 0 !important;
        white-space: normal !important;
        box-sizing: border-box !important;
      }


      /* HTML表格样式 - 这个规则会被前面更具体的规则覆盖 */
      .compact-markdown-translate > table, .compact-markdown-explain > table {
        font-size: 12px !important;
        line-height: 1.4 !important;
        border-collapse: collapse !important;
        margin: 4px auto !important; /* Center with auto margins */
        width: auto !important;
        display: table !important;
      }
      
      .compact-markdown-translate th, .compact-markdown-explain th {
        font-size: 11px !important;
        font-weight: 600 !important;
        padding: 3px 6px !important;
        border: 1px solid #6b7280 !important;
        background-color: #f9fafb !important;
      }
      
      .compact-markdown-translate td, .compact-markdown-explain td {
        font-size: 12px !important;
        padding: 3px 6px !important;
        border: 1px solid #6b7280 !important;
      }
    `;
    
    document.head.appendChild(styleElement);
    
    return () => {
      const element = document.getElementById(styleId);
      if (element) {
        element.remove();
      }
    };
  }, []);

  const processedContent = useMemo(() => {
    if (!content) return '';

    // 首先，保护代码块避免被处理
    const codeBlockRegex = /```[\s\S]*?```/g;
    const inlineCodeRegex = /`[^`]+`/g;
    
    // 存储代码块并替换为占位符
    const codeBlocks: string[] = [];
    let processed = content;
    
    // 替换代码块为占位符
    processed = processed.replace(codeBlockRegex, (match) => {
      const index = codeBlocks.length;
      codeBlocks.push(match);
      return `__CODE_BLOCK_${index}__`;
    });
    
    // 替换内联代码为占位符
    processed = processed.replace(inlineCodeRegex, (match) => {
      const index = codeBlocks.length;
      codeBlocks.push(match);
      return `__CODE_BLOCK_${index}__`;
    });

    // 处理图片路径
    processed = processed.replace(
      /!\[([^\]]*)\]\(\/static\/([^)]+)\)/g,
      (_, alt, path) => `![${alt}](${getStaticFileUrl(path)})`
    );

    // 检测是否是纯HTML表格内容（不包含其他markdown语法）
    // 如果是纯HTML表格，确保它被正确处理
    const isHTMLTable = processed.trim().startsWith('<table') && processed.trim().endsWith('</table>');
    if (isHTMLTable) {
      // 对于纯HTML表格，添加一个换行确保ReactMarkdown正确处理
      // 这有助于rehypeRaw插件识别并解析HTML
      processed = '\n' + processed.trim() + '\n';
      console.log('🔍 检测到HTML表格内容，已处理:', processed.substring(0, 200));
    }

    // 恢复代码块
    codeBlocks.forEach((block, index) => {
      processed = processed.replace(`__CODE_BLOCK_${index}__`, block);
    });

    return processed;
  }, [content]);

  // 检查是否是纯HTML表格
  const isPureHTMLTable = content && content.trim().startsWith('<table') && content.trim().endsWith('</table>');

  return (
    <div 
      ref={containerRef}
      className={`${themeColorClass} w-full ${className}`}
      style={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        overflowX: 'auto',
        overflowY: 'visible',
      }}
    >
      {/* 使用 ReactMarkdown 组件，与主视图保持一致 */}
      <div className="compact-markdown-content" style={useCompactStyle ? { fontSize: '12px', lineHeight: '1.4' } : {}}>
        {isPureHTMLTable ? (
          // 对于纯HTML表格，直接渲染HTML
          <div 
            dangerouslySetInnerHTML={{ __html: content }}
            className="html-table-content"
          />
        ) : (
        <ReactMarkdown
          // 自定义组件渲染器
          components={{
            // 图片居中显示
            img: ({ src, alt, ...props }: any) => (
              <img 
                {...props}
                src={src}
                alt={alt}
                style={{
                  display: 'block',
                  margin: '0.5em auto',
                  maxWidth: '100%',
                  height: 'auto'
                }}
              />
            ),
            // 表格居中容器
            table: ({ children, ...props }: any) => (
              <div className="markdown-table-container" style={{ 
                display: 'flex', 
                justifyContent: 'center',
                width: '100%'
              }}>
                <table {...props} style={{ 
                  margin: '0 auto',
                  width: 'auto' /* Force auto width to override CSS */
                }}>
                  {children}
                </table>
              </div>
            ),
            // 表格单元格处理 LaTeX - 与 BlockMarkdownViewer 一致
            td: ({ children, ...props }: any) => (
              <td {...props} className="markdown-table-cell">
                {processChildrenWithLatex(children)}
              </td>
            ),
            th: ({ children, ...props }: any) => (
              <th {...props} className="markdown-table-header-cell">
                {processChildrenWithLatex(children)}
              </th>
            ),
            // 段落处理 LaTeX
            p: ({ children, ...props }: any) => (
              <p {...props} className="markdown-paragraph">
                {processChildrenWithLatex(children)}
              </p>
            ),
            // 无序列表
            ul: ({ children, ...props }: any) => (
              <ul {...props} style={{ 
                listStyleType: 'disc', 
                listStylePosition: 'outside',
                paddingLeft: '1.2em',
                margin: '0.2em 0'
              }}>
                {children}
              </ul>
            ),
            // 有序列表
            ol: ({ children, ...props }: any) => (
              <ol {...props} style={{ 
                listStyleType: 'decimal', 
                listStylePosition: 'outside',
                paddingLeft: '1.2em',
                margin: '0.2em 0'
              }}>
                {children}
              </ol>
            ),
            // 列表项处理 LaTeX
            li: ({ children, ...props }: any) => (
              <li {...props} className="markdown-list-item" style={{ display: 'list-item' }}>
                {processChildrenWithLatex(children)}
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
          }}
          // 重要：正确的插件顺序
          remarkPlugins={[
            remarkGfm,  // 支持 GFM 表格语法
            [remarkMath, {  // 识别数学公式
              singleDollarTextMath: true,
              inlineMathDouble: false,
            }]
          ]}
          rehypePlugins={[
            rehypeRaw,  // 处理 HTML 内容
            [rehypeKatex, {  // 处理数学公式
              strict: false,
              throwOnError: false,
              errorColor: '#cc0000',
              output: 'html',
              displayMode: false,
              trust: true,
              macros: {
                "\\RR": "\\mathbb{R}",
                "\\NN": "\\mathbb{N}",
                "\\ZZ": "\\mathbb{Z}",
                "\\QQ": "\\mathbb{Q}",
                "\\CC": "\\mathbb{C}"
              }
            }]
          ]}
        >
          {processedContent}
        </ReactMarkdown>
        )}
      </div>
    </div>
  );
}