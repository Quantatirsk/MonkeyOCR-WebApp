/**
 * CompactMarkdownViewer Component
 * 专门用于ContentEnhancementOverlay的紧凑型Markdown渲染器
 * 特点：极小字号、紧凑间距、保持表格和公式渲染正确性
 */

import React, { useRef, useMemo } from 'react';
import MarkdownPreview from '@uiw/react-markdown-preview';
import '@uiw/react-markdown-preview/markdown.css';
import 'katex/dist/katex.min.css';
import { getStaticFileUrl } from '../../config';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import katex from 'katex';

interface CompactMarkdownViewerProps {
  content: string;
  className?: string;
  overlayType?: 'translate' | 'explain';
}

// 处理表格内的数学公式
function processTableCellMath(text: string): React.ReactNode[] {
  if (!text.includes('$')) {
    return [text];
  }

  // Split by math expressions and process each part
  const parts = text.split(/(\$\$?[^$]*?\$\$?)/);
  
  return parts.map((part, index) => {
    // Handle display math $$...$$
    if (part.match(/^\$\$[^$]*?\$\$$/)) {
      const mathContent = part.slice(2, -2);
      try {
        const html = katex.renderToString(mathContent, {
          throwOnError: false,
          displayMode: true,
          output: 'html',
          strict: false,
        });
        return <div key={index} dangerouslySetInnerHTML={{ __html: html }} style={{ margin: '0.2em 0', textAlign: 'center', whiteSpace: 'nowrap', wordBreak: 'normal', overflowWrap: 'normal' }} />;
      } catch (error) {
        return <span key={index}>{part}</span>;
      }
    }
    
    // Handle inline math $...$  
    if (part.match(/^\$[^$]*?\$$/)) {
      const mathContent = part.slice(1, -1);
      try {
        const html = katex.renderToString(mathContent, {
          throwOnError: false,
          displayMode: false,
          output: 'html',
          strict: false,
        });
        return <span key={index} dangerouslySetInnerHTML={{ __html: html }} style={{ whiteSpace: 'nowrap', wordBreak: 'normal', overflowWrap: 'normal' }} />;
      } catch (error) {
        return <span key={index}>{part}</span>;
      }
    } else {
      // 普通文本
      return part ? <span key={index}>{part}</span> : null;
    }
  }).filter(Boolean);
}

export function CompactMarkdownViewer({ content, className = '', overlayType = 'translate' }: CompactMarkdownViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 根据覆盖层类型设置主题色
  const isExplain = overlayType === 'explain';
  const themeColorClass = isExplain ? 'compact-markdown-explain' : 'compact-markdown-translate';
  
  // 检测内容是否为HTML表格
  const isHTMLTable = content.trim().startsWith('<table') && content.trim().endsWith('</table>');

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
        font-size: 11px !important;
        line-height: 1.3 !important;
        color: #374151 !important;
      }
      
      .compact-markdown-translate .wmde-markdown,
      .compact-markdown-translate .w-md-editor-preview {
        font-size: 11px !important;
        line-height: 1.3 !important;
      }

      /* 紧凑型Markdown样式 - 解释模式 */
      .compact-markdown-explain {
        font-size: 11px !important;
        line-height: 1.3 !important;
        color: #166534 !important;
      }
      
      .compact-markdown-explain .wmde-markdown,
      .compact-markdown-explain .w-md-editor-preview {
        font-size: 11px !important;
        line-height: 1.3 !important;
      }

      /* 标题样式 - 极小间距 */
      .compact-markdown-translate h1, .compact-markdown-explain h1,
      .compact-markdown-translate .wmde-markdown h1, .compact-markdown-explain .wmde-markdown h1 {
        font-size: 14px !important;
        font-weight: 600 !important;
        margin: 4px 0 2px 0 !important;
        color: #1f2937 !important;
      }
      
      .compact-markdown-translate h2, .compact-markdown-explain h2,
      .compact-markdown-translate .wmde-markdown h2, .compact-markdown-explain .wmde-markdown h2 {
        font-size: 13px !important;
        font-weight: 600 !important;
        margin: 3px 0 2px 0 !important;
        color: #374151 !important;
      }
      
      .compact-markdown-translate h3, .compact-markdown-explain h3,
      .compact-markdown-translate .wmde-markdown h3, .compact-markdown-explain .wmde-markdown h3 {
        font-size: 12px !important;
        font-weight: 600 !important;
        margin: 2px 0 1px 0 !important;
        color: #4b5563 !important;
      }

      .compact-markdown-translate h4, .compact-markdown-translate h5, .compact-markdown-translate h6,
      .compact-markdown-explain h4, .compact-markdown-explain h5, .compact-markdown-explain h6,
      .compact-markdown-translate .wmde-markdown h4, .compact-markdown-translate .wmde-markdown h5, .compact-markdown-translate .wmde-markdown h6,
      .compact-markdown-explain .wmde-markdown h4, .compact-markdown-explain .wmde-markdown h5, .compact-markdown-explain .wmde-markdown h6 {
        font-size: 11px !important;
        font-weight: 600 !important;
        margin: 2px 0 1px 0 !important;
        color: #6b7280 !important;
      }

      /* 段落和文本 - 极小间距 */
      .compact-markdown-translate p, .compact-markdown-explain p,
      .compact-markdown-translate .wmde-markdown p, .compact-markdown-explain .wmde-markdown p {
        margin: 2px 0 !important;
        font-size: 11px !important;
        line-height: 1.3 !important;
      }

      /* 列表 - 极小缩进和间距 */
      .compact-markdown-translate ul, .compact-markdown-translate ol,
      .compact-markdown-explain ul, .compact-markdown-explain ol,
      .compact-markdown-translate .wmde-markdown ul, .compact-markdown-translate .wmde-markdown ol,
      .compact-markdown-explain .wmde-markdown ul, .compact-markdown-explain .wmde-markdown ol {
        margin: 2px 0 2px 12px !important;
        padding-left: 8px !important;
        font-size: 11px !important;
      }

      .compact-markdown-translate li, .compact-markdown-explain li,
      .compact-markdown-translate .wmde-markdown li, .compact-markdown-explain .wmde-markdown li {
        margin: 1px 0 !important;
        font-size: 11px !important;
        line-height: 1.3 !important;
      }

      /* 表格样式 - 保持功能性但缩小尺寸 */
      .compact-markdown-translate table, .compact-markdown-explain table,
      .compact-markdown-translate .wmde-markdown table, .compact-markdown-explain .wmde-markdown table {
        font-size: 10px !important;
        line-height: 1.2 !important;
        margin: 4px 0 !important;
        border-collapse: collapse !important;
        width: 100% !important;
        max-width: 100% !important;
        word-break: break-all !important;
        table-layout: auto !important;
        overflow: visible !important;
      }

      .compact-markdown-translate th, .compact-markdown-translate td,
      .compact-markdown-explain th, .compact-markdown-explain td,
      .compact-markdown-translate .wmde-markdown th, .compact-markdown-translate .wmde-markdown td,
      .compact-markdown-explain .wmde-markdown th, .compact-markdown-explain .wmde-markdown td {
        padding: 2px 4px !important;
        border: 1px solid #e5e7eb !important;
        font-size: 10px !important;
        line-height: 1.2 !important;
        word-break: break-all !important;
        overflow-wrap: anywhere !important;
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
        margin: 0.3em 0 !important;
        white-space: nowrap !important;
        word-break: normal !important;
        overflow-wrap: normal !important;
        display: block !important;
        text-align: center !important;
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

      /* 强制文本换行 - 但排除KaTeX元素 */
      .compact-markdown-translate *:not(.katex):not(.katex *),
      .compact-markdown-explain *:not(.katex):not(.katex *),
      .compact-markdown-translate .wmde-markdown *:not(.katex):not(.katex *),
      .compact-markdown-explain .wmde-markdown *:not(.katex):not(.katex *) {
        word-break: break-all !important;
        overflow-wrap: anywhere !important;
        word-wrap: break-word !important;
        max-width: 100% !important;
        min-width: 0 !important;
        white-space: normal !important;
        box-sizing: border-box !important;
      }

      /* 解释模式的特殊颜色 */
      .compact-markdown-explain h1, .compact-markdown-explain h2, .compact-markdown-explain h3 {
        color: #14532d !important;
      }
      
      .compact-markdown-explain p {
        color: #166534 !important;
      }

      /* HTML表格样式 */
      .compact-markdown-translate table, .compact-markdown-explain table {
        font-size: 11px !important;
        line-height: 1.3 !important;
        border-collapse: collapse !important;
        margin: 4px 0 !important;
        width: 100% !important;
      }
      
      .compact-markdown-translate th, .compact-markdown-explain th {
        font-size: 10px !important;
        font-weight: 600 !important;
        padding: 3px 6px !important;
        border: 1px solid #e5e7eb !important;
        background-color: #f9fafb !important;
      }
      
      .compact-markdown-translate td, .compact-markdown-explain td {
        font-size: 11px !important;
        padding: 3px 6px !important;
        border: 1px solid #e5e7eb !important;
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

    // 处理图片路径
    let processed = content.replace(
      /!\[([^\]]*)\]\(\/static\/([^)]+)\)/g,
      (_, alt, path) => `![${alt}](${getStaticFileUrl(path)})`
    );

    return processed;
  }, [content]);

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
      {isHTMLTable ? (
        // 直接渲染HTML表格，避免Markdown解析器破坏HTML结构
        <div 
          dangerouslySetInnerHTML={{ __html: processedContent }}
          style={{
            fontSize: '11px',
            lineHeight: '1.3',
          }}
        />
      ) : (
        // 使用Markdown渲染器处理其他内容
        <MarkdownPreview
          source={processedContent}
          style={{
            backgroundColor: 'transparent',
            color: 'inherit',
            fontFamily: 'inherit',
            fontSize: '11px',
            lineHeight: '1.3',
          }}
          wrapperElement={{
            'data-color-mode': 'light'
          }}
        rehypePlugins={[
          rehypeRaw,
          [rehypeKatex, {
            strict: false,
            throwOnError: false,
            errorColor: '#cc0000',
            output: 'html',
            displayMode: false,
            trust: (context: any) => ['htmlId', 'htmlClass', 'htmlStyle', 'htmlData'].includes(context.command),
          }]
        ]}
        remarkPlugins={[
          remarkGfm,
          [remarkMath, {
            singleDollarTextMath: true,
            inlineMathDouble: false,
          }]
        ]}
        components={{
          // 自定义表格单元格渲染器，处理数学公式
          td: ({ children, ...props }: any) => {
            const processChildren = (children: any): any => {
              if (typeof children === 'string') {
                return processTableCellMath(children);
              }
              if (Array.isArray(children)) {
                return children.map((child, index) => {
                  if (typeof child === 'string') {
                    return <span key={index}>{processTableCellMath(child)}</span>;
                  }
                  return child;
                });
              }
              return children;
            };
            
            return <td {...props}>{processChildren(children)}</td>;
          },
          
          th: ({ children, ...props }: any) => {
            const processChildren = (children: any): any => {
              if (typeof children === 'string') {
                return processTableCellMath(children);
              }
              if (Array.isArray(children)) {
                return children.map((child, index) => {
                  if (typeof child === 'string') {
                    return <span key={index}>{processTableCellMath(child)}</span>;
                  }
                  return child;
                });
              }
              return children;
            };
            
            return <th {...props}>{processChildren(children)}</th>;
          },
          
          // 自定义渲染器来处理内联数学公式
          code: ({ children = [], className, ...props }: any) => {
            const text = String(children);
            
            // 处理内联数学公式 $...$
            if (typeof text === 'string' && /^\$([^$]+)\$$/.test(text)) {
              const mathContent = text.replace(/^\$([^$]+)\$$/, '$1');
              try {
                const html = katex.renderToString(mathContent, {
                  throwOnError: false,
                  displayMode: false,
                  output: 'html',
                  strict: false,
                });
                return <span dangerouslySetInnerHTML={{ __html: html }} style={{ background: 'transparent', whiteSpace: 'nowrap', wordBreak: 'normal', overflowWrap: 'normal' }} />;
              } catch (error) {
                return <code {...props}>{children}</code>;
              }
            }
            
            // 处理块级数学公式 $$...$$
            if (typeof text === 'string' && /^\$\$([^$]+)\$\$$/.test(text)) {
              const mathContent = text.replace(/^\$\$([^$]+)\$\$$/, '$1');
              try {
                const html = katex.renderToString(mathContent, {
                  throwOnError: false,
                  displayMode: true,
                  output: 'html',
                  strict: false,
                });
                return <div dangerouslySetInnerHTML={{ __html: html }} style={{ background: 'transparent', textAlign: 'center', margin: '0.3em 0', whiteSpace: 'nowrap', wordBreak: 'normal', overflowWrap: 'normal' }} />;
              } catch (error) {
                return <code {...props}>{children}</code>;
              }
            }
            
            // 其他代码块正常处理
            return <code className={className} {...props}>{children}</code>;
          }
        }}
      />
      )}
    </div>
  );
}