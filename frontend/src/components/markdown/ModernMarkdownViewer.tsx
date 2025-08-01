import React, { useRef, useMemo } from 'react';
import MarkdownPreview from '@uiw/react-markdown-preview';
import '@uiw/react-markdown-preview/markdown.css';
import 'katex/dist/katex.min.css';
import './markdown-styles.css';
import { getStaticFileUrl } from '../../config';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import katex from 'katex';

interface ModernMarkdownViewerProps {
  content: string;
  className?: string;
  fontSize?: number; // 字号百分比
}

// Rehype plugin to handle table math expressions
function rehypeTableMath() {
  return (tree: any) => {
    visit(tree, 'element', (node: any) => {
      if (node.tagName === 'td' || node.tagName === 'th') {
        visit(node, 'text', (textNode: any) => {
          if (typeof textNode.value === 'string') {
            const text = textNode.value;
            
            // Handle inline math expressions $...$
            if (text.includes('$') && text.match(/\$[^$]+\$/)) {
              const parts = text.split(/(\$[^$]+\$)/);
              const newChildren: any[] = [];
              
              parts.forEach((part: string) => {
                if (part.match(/^\$[^$]+\$$/)) {
                  // This is a math expression
                  const mathContent = part.slice(1, -1); // Remove $ delimiters
                  try {
                    const html = katex.renderToString(mathContent, {
                      throwOnError: false,
                      displayMode: false,
                      output: 'html',
                      strict: false,
                    });
                    newChildren.push({
                      type: 'element',
                      tagName: 'span',
                      properties: {
                        className: ['katex-rendered'],
                        dangerouslySetInnerHTML: { __html: html }
                      },
                      children: []
                    });
                  } catch (error) {
                    // Fallback to original text if rendering fails
                    newChildren.push({
                      type: 'text',
                      value: part
                    });
                  }
                } else if (part) {
                  // Regular text
                  newChildren.push({
                    type: 'text',
                    value: part
                  });
                }
              });
              
              if (newChildren.length > 1) {
                // Replace the text node with the new structure
                const parent = textNode.parent;
                if (parent && parent.children) {
                  const nodeIndex = parent.children.indexOf(textNode);
                  if (nodeIndex !== -1) {
                    parent.children.splice(nodeIndex, 1, ...newChildren);
                  }
                }
              }
            }
            
            // Handle display math expressions $$...$$
            if (text.includes('$$') && text.match(/\$\$[^$]+\$\$/)) {
              const parts = text.split(/(\$\$[^$]+\$\$)/);
              const newChildren: any[] = [];
              
              parts.forEach((part: string) => {
                if (part.match(/^\$\$[^$]+\$\$$/)) {
                  // This is a display math expression
                  const mathContent = part.slice(2, -2); // Remove $$ delimiters
                  try {
                    const html = katex.renderToString(mathContent, {
                      throwOnError: false,
                      displayMode: true,
                      output: 'html',
                      strict: false,
                    });
                    newChildren.push({
                      type: 'element',
                      tagName: 'div',
                      properties: {
                        className: ['katex-rendered', 'katex-display'],
                        dangerouslySetInnerHTML: { __html: html }
                      },
                      children: []
                    });
                  } catch (error) {
                    // Fallback to original text if rendering fails
                    newChildren.push({
                      type: 'text',
                      value: part
                    });
                  }
                } else if (part) {
                  // Regular text
                  newChildren.push({
                    type: 'text',
                    value: part
                  });
                }
              });
              
              if (newChildren.length > 1) {
                // Replace the text node with the new structure
                const parent = textNode.parent;
                if (parent && parent.children) {
                  const nodeIndex = parent.children.indexOf(textNode);
                  if (nodeIndex !== -1) {
                    parent.children.splice(nodeIndex, 1, ...newChildren);
                  }
                }
              }
            }
          }
        });
      }
    });
  };
}

// 处理表格单元格内的数学公式
function processTableCellMath(text: string): React.ReactNode {
  if (!text || typeof text !== 'string') return text;
  
  // 同时处理内联 $...$ 和块级 $$...$$ 数学公式
  const mathRegex = /(\$\$[^$]+\$\$|\$[^$]+\$)/g;
  const parts = text.split(mathRegex);
  
  if (parts.length === 1) {
    return text; // 没有数学公式
  }
  
  return parts.map((part, index) => {
    if (part.match(/^\$\$[^$]+\$\$$/)) {
      // 块级数学公式
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
    } else if (part.match(/^\$[^$]+\$$/)) {
      // 内联数学公式
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
    } else {
      // 普通文本
      return part ? <span key={index}>{part}</span> : null;
    }
  }).filter(Boolean);
}

// 简化的复制功能 hook
function useCopyCodeBlock(containerRef: React.RefObject<HTMLDivElement>) {
  const handleClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target) return;

    // 查找包含复制按钮的父元素
    const copyButton = target.closest('.copied') as HTMLElement;
    if (!copyButton) return;

    const code = copyButton.dataset.code;
    if (!code) return;

    // 复制到剪贴板
    const copyToClipboard = async (text: string) => {
      try {
        // 首先尝试使用现代的 Clipboard API
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          return true;
        } else {
          // 降级处理：使用旧的复制方法
          const textArea = document.createElement('textarea');
          textArea.value = text;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          textArea.style.top = '-999999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          
          try {
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            return successful;
          } catch (err) {
            document.body.removeChild(textArea);
            return false;
          }
        }
      } catch (err) {
        console.error('Failed to copy text:', err);
        return false;
      }
    };

    copyToClipboard(code).then((success) => {
      if (success) {
        // 添加active状态显示复制成功
        copyButton.classList.add('active');
        setTimeout(() => {
          copyButton.classList.remove('active');
        }, 2000);
      } else {
        console.error('Failed to copy code to clipboard');
      }
    });
  };

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('click', handleClick);
    
    return () => {
      container.removeEventListener('click', handleClick);
    };
  }, [containerRef]);
}

export function ModernMarkdownViewer({ content, className = '', fontSize = 100 }: ModernMarkdownViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 启用代码块复制功能
  useCopyCodeBlock(containerRef);
  
  const processedContent = useMemo(() => {
    if (!content) return '';

    // 只替换图片路径，LaTeX处理交给remarkMath和rehypeKatex
    let processed = content.replace(
      /!\[([^\]]*)\]\(\/static\/([^)]+)\)/g,
      (_, alt, path) => `![${alt}](${getStaticFileUrl(path)})`
    );

    // Debug: 检查LaTeX公式
    if (processed.includes('uparrow') || processed.includes('downarrow')) {
      console.log('🔬 找到LaTeX箭头符号:', processed.match(/\$[^$]*(?:uparrow|downarrow)[^$]*\$/g));
    }

    return processed;
  }, [content]);

  return (
    <div 
      ref={containerRef}
      className={`markdown-viewer w-full ${className}`} 
    >
      <MarkdownPreview
        source={processedContent}
        style={{
          backgroundColor: 'transparent',
          color: 'inherit',
          fontFamily: 'inherit',
          fontSize: `${fontSize}%`,
        }}
        rehypePlugins={[
          rehypeRaw, // 处理HTML表格中的原始HTML
          rehypeTableMath, // 处理表格内的数学公式
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
                return <span dangerouslySetInnerHTML={{ __html: html }} style={{ background: 'transparent' }} />;
              } catch (error) {
                console.error('KaTeX render error:', error);
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
                return <div dangerouslySetInnerHTML={{ __html: html }} style={{ background: 'transparent', textAlign: 'center', margin: '1em 0' }} />;
              } catch (error) {
                console.error('KaTeX render error:', error);
                return <code {...props}>{children}</code>;
              }
            }
            
            // 其他代码块正常处理
            return <code className={className} {...props}>{children}</code>;
          }
        }}
        wrapperElement={{ 'data-color-mode': 'light' }}
        data-color-mode="light"
      />
    </div>
  );
}