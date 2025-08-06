import React, { useRef, useMemo, useState, useCallback } from 'react';
import MarkdownPreview from '@uiw/react-markdown-preview';
import '@uiw/react-markdown-preview/markdown.css';
import 'katex/dist/katex.min.css';
import './markdown-styles.css';
import '../translation/translation-styles.css';
import { getStaticFileUrl } from '../../config';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import katex from 'katex';
import { TranslationBlock } from '../translation/TranslatedContent';
import { useTranslationActions, useTranslationState } from '../../store/appStore';

interface ModernMarkdownViewerProps {
  content: string;
  className?: string;
  fontSize?: number; // 字号百分比
  enableTranslation?: boolean; // Enable translation features
  taskId?: string; // Task ID for translation context
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

// 强制文本换行 hook - 优化版本
function useForceTextWrap(containerRef: React.RefObject<HTMLDivElement>) {
  const appliedElementsRef = React.useRef(new WeakSet());
  const lastApplyTimeRef = React.useRef(0);
  
  React.useEffect(() => {
    const forceWrapStyles = () => {
      const container = containerRef.current;
      if (!container) return;

      const now = Date.now();
      // 防抖：限制应用频率，避免无限循环
      if (now - lastApplyTimeRef.current < 200) return;
      lastApplyTimeRef.current = now;

      // 获取所有可能包含文本的元素
      const allElements = container.querySelectorAll('*');
      let appliedCount = 0;
      
      allElements.forEach((element: Element) => {
        const htmlElement = element as HTMLElement;
        
        // 跳过已经处理过的元素，避免重复处理
        if (appliedElementsRef.current.has(htmlElement)) return;
        
        // 强制应用样式，覆盖任何现有样式
        htmlElement.style.setProperty('word-break', 'break-all', 'important');
        htmlElement.style.setProperty('overflow-wrap', 'anywhere', 'important');
        htmlElement.style.setProperty('word-wrap', 'break-word', 'important');
        htmlElement.style.setProperty('max-width', '100%', 'important');
        htmlElement.style.setProperty('width', 'auto', 'important');
        htmlElement.style.setProperty('min-width', '0', 'important');
        htmlElement.style.setProperty('white-space', 'normal', 'important');
        htmlElement.style.setProperty('overflow', 'visible', 'important');
        htmlElement.style.setProperty('box-sizing', 'border-box', 'important');
        htmlElement.style.setProperty('flex-shrink', '1', 'important');
        
        // 特殊处理可能有固定宽度的元素
        if (htmlElement.tagName === 'TABLE') {
          // 表格完全禁用滚动
          htmlElement.style.setProperty('overflow', 'visible', 'important');
          htmlElement.style.setProperty('overflow-x', 'visible', 'important');
          htmlElement.style.setProperty('overflow-y', 'visible', 'important');
          htmlElement.style.setProperty('max-width', '100%', 'important');
          htmlElement.style.setProperty('table-layout', 'fixed', 'important');
        } else if (htmlElement.tagName === 'PRE' || htmlElement.tagName === 'CODE') {
          // 代码块保留滚动
          htmlElement.style.setProperty('overflow-x', 'auto', 'important');
          htmlElement.style.setProperty('max-width', '100%', 'important');
        }
        
        // 特殊处理包含表格的容器
        if (htmlElement.querySelector && htmlElement.querySelector('table')) {
          htmlElement.style.setProperty('overflow', 'visible', 'important');
          htmlElement.style.setProperty('overflow-x', 'visible', 'important');
          htmlElement.style.setProperty('overflow-y', 'visible', 'important');
        }
        
        // 标记为已处理
        appliedElementsRef.current.add(htmlElement);
        appliedCount++;
      });
      
      if (appliedCount > 0) {
        console.log(`✅ 新应用样式到 ${appliedCount} 个元素`);
      }
    };

    // 初始应用
    setTimeout(forceWrapStyles, 100);

    // 使用 MutationObserver 监听DOM变化，但限制频率
    let mutationTimeout: NodeJS.Timeout;
    const observer = new MutationObserver(() => {
      clearTimeout(mutationTimeout);
      mutationTimeout = setTimeout(forceWrapStyles, 150);
    });

    if (containerRef.current) {
      observer.observe(containerRef.current, {
        childList: true,
        subtree: true
      });
    }

    return () => {
      observer.disconnect();
      clearTimeout(mutationTimeout);
    };
  }, [containerRef]);
}

// Translation helper functions
function extractTranslatableBlocks(content: string): Array<{
  id: string;
  text: string;
  type: 'paragraph' | 'heading' | 'list' | 'blockquote';
  startIndex: number;
  endIndex: number;
}> {
  const blocks: Array<{
    id: string;
    text: string;
    type: 'paragraph' | 'heading' | 'list' | 'blockquote';
    startIndex: number;
    endIndex: number;
  }> = [];

  // Split content into blocks (paragraphs, headings, lists, etc.)
  const lines = content.split('\n');
  let currentBlock = '';
  let blockType: 'paragraph' | 'heading' | 'list' | 'blockquote' = 'paragraph';
  let blockStartIndex = 0;
  let lineIndex = 0;

  const processCurrentBlock = () => {
    const trimmedBlock = currentBlock.trim();
    if (trimmedBlock && 
        !trimmedBlock.startsWith('![') && // Skip images
        !trimmedBlock.startsWith('```') && // Skip code blocks
        !trimmedBlock.includes('$$') && // Skip math blocks
        trimmedBlock.length > 10 // Only translate substantial content
    ) {
      const blockId = `block-${blocks.length}-${Date.now()}`;
      blocks.push({
        id: blockId,
        text: trimmedBlock,
        type: blockType,
        startIndex: blockStartIndex,
        endIndex: lineIndex
      });
    }
  };

  for (lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex].trim();
    
    if (!line) {
      // Empty line - end current block
      if (currentBlock.trim()) {
        processCurrentBlock();
        currentBlock = '';
        blockStartIndex = lineIndex + 1;
      }
      continue;
    }
    
    // Determine block type
    let newBlockType: 'paragraph' | 'heading' | 'list' | 'blockquote' = 'paragraph';
    if (line.startsWith('#')) newBlockType = 'heading';
    else if (line.startsWith('- ') || line.startsWith('* ') || line.match(/^\d+\./)) newBlockType = 'list';
    else if (line.startsWith('>')) newBlockType = 'blockquote';
    
    // If block type changed, process current block first
    if (currentBlock && newBlockType !== blockType) {
      processCurrentBlock();
      currentBlock = '';
      blockStartIndex = lineIndex;
    }
    
    blockType = newBlockType;
    currentBlock += (currentBlock ? '\n' : '') + lines[lineIndex];
  }
  
  // Process final block
  if (currentBlock.trim()) {
    processCurrentBlock();
  }
  
  return blocks;
}

function generateBlockId(taskId: string, blockIndex: number): string {
  return `${taskId}-block-${blockIndex}`;
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

export function ModernMarkdownViewer({ 
  content, 
  className = '', 
  fontSize = 100, 
  enableTranslation = false,
  taskId = 'default'
}: ModernMarkdownViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [translatableBlocks, setTranslatableBlocks] = useState<Array<{
    id: string;
    text: string;
    type: 'paragraph' | 'heading' | 'list' | 'blockquote';
    startIndex: number;
    endIndex: number;
  }>>([]);
  
  // Translation hooks
  const { translateBlock } = useTranslationActions();
  const { 
    translations, 
    currentTranslationTask, 
    translationSettings,
    isTranslating 
  } = useTranslationState();
  
  // 启用强制文本换行
  useForceTextWrap(containerRef);
  
  // 启用代码块复制功能
  useCopyCodeBlock(containerRef);
  
  // Extract translatable blocks when content changes
  const blocks = useMemo(() => {
    if (!enableTranslation || !content) return [];
    return extractTranslatableBlocks(content);
  }, [content, enableTranslation]);
  
  // Update translatable blocks state
  React.useEffect(() => {
    setTranslatableBlocks(blocks);
  }, [blocks]);
  
  // Translation handlers
  const handleTranslateBlock = useCallback(async (blockIndex: number) => {
    const block = translatableBlocks[blockIndex];
    if (!block) return;
    
    const blockId = generateBlockId(taskId, blockIndex);
    try {
      await translateBlock(blockId, block.text);
    } catch (error) {
      console.error('Failed to translate block:', error);
    }
  }, [translatableBlocks, taskId, translateBlock]);
  
  const handleRetranslateBlock = useCallback(async (blockIndex: number) => {
    const block = translatableBlocks[blockIndex];
    if (!block) return;
    
    const blockId = generateBlockId(taskId, blockIndex);
    try {
      await translateBlock(blockId, block.text);
    } catch (error) {
      console.error('Failed to retranslate block:', error);
    }
  }, [translatableBlocks, taskId, translateBlock]);
  
  // Translation actions outside of render
  const { removeTranslation } = useTranslationActions();
  
  // 动态注入最强CSS规则 - 一次性注入
  React.useEffect(() => {
    const styleId = 'force-markdown-wrap-styles';
    
    // 检查是否已经注入过
    if (document.getElementById(styleId)) return;
    
    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    
    // 注入最激进的CSS规则
    styleElement.textContent = `
      /* 最高优先级的强制换行规则 */
      .markdown-viewer *,
      .markdown-viewer *::before,
      .markdown-viewer *::after,
      .w-md-editor-preview *,
      .wmde-markdown *,
      .wmde-markdown-color *,
      [class*="wmde-"] *,
      [class*="w-md-editor"] * {
        word-break: break-all !important;
        overflow-wrap: anywhere !important;
        word-wrap: break-word !important;
        max-width: 100% !important;
        width: auto !important;
        min-width: 0 !important;
        white-space: normal !important;
        overflow: visible !important;
        box-sizing: border-box !important;
        flex-shrink: 1 !important;
        text-overflow: clip !important;
      }
      
      /* 表格和代码块特殊处理 - 完全禁用表格滚动 */
      .markdown-viewer table,
      .w-md-editor-preview table {
        overflow: visible !important;
        overflow-x: visible !important;
        overflow-y: visible !important;
        max-width: 100% !important;
        word-break: break-all !important;
        table-layout: fixed !important;
      }
      
      .markdown-viewer pre,
      .markdown-viewer code,
      .w-md-editor-preview pre,
      .w-md-editor-preview code {
        overflow-x: auto !important;
        max-width: 100% !important;
        word-break: break-all !important;
      }
      
      /* 禁用所有表格相关容器的滚动 - 更全面的规则 */
      .markdown-viewer .table-wrapper,
      .markdown-viewer [class*="table"],
      .w-md-editor-preview .table-wrapper,
      .w-md-editor-preview [class*="table"],
      .markdown-viewer div:has(table),
      .w-md-editor-preview div:has(table),
      .wmde-markdown div:has(table),
      .wmde-markdown-color div:has(table) {
        overflow: visible !important;
        overflow-x: visible !important;
        overflow-y: visible !important;
        max-width: 100% !important;
      }
      
      /* 强制禁用任何可能的表格滚动容器 */
      .markdown-viewer *:has(table),
      .w-md-editor-preview *:has(table) {
        overflow: visible !important;
        overflow-x: visible !important;
        overflow-y: visible !important;
      }
      
      /* 覆盖任何可能的内联样式 */
      .markdown-viewer [style],
      .w-md-editor-preview [style] {
        max-width: 100% !important;
        min-width: 0 !important;
        word-break: break-all !important;
        overflow-wrap: anywhere !important;
      }
      
      /* 强制所有文本元素都换行 */
      .markdown-viewer p,
      .markdown-viewer div,
      .markdown-viewer span,
      .markdown-viewer h1, .markdown-viewer h2, .markdown-viewer h3,
      .markdown-viewer h4, .markdown-viewer h5, .markdown-viewer h6,
      .markdown-viewer li, .markdown-viewer td, .markdown-viewer th {
        word-break: break-all !important;
        overflow-wrap: anywhere !important;
        max-width: 100% !important;
        min-width: 0 !important;
        white-space: normal !important;
      }
    `;
    
    document.head.appendChild(styleElement);
    console.log('🎨 已注入强制CSS换行规则');
    
    return () => {
      const element = document.getElementById(styleId);
      if (element) {
        element.remove();
      }
    };
  }, []);
  
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
  
  // Split content into paragraphs for translation
  const contentParts = useMemo(() => {
    if (!enableTranslation || !content) {
      return [{ type: 'markdown' as const, content: processedContent }];
    }
    
    const parts: Array<{ type: 'markdown' | 'translation', content: string, blockIndex?: number }> = [];
    const lines = content.split('\n');
    let currentContent = '';
    let lineIndex = 0;
    
    for (const block of translatableBlocks) {
      // Add content before this block
      while (lineIndex < block.startIndex && lineIndex < lines.length) {
        currentContent += (currentContent ? '\n' : '') + lines[lineIndex];
        lineIndex++;
      }
      
      if (currentContent.trim()) {
        parts.push({ 
          type: 'markdown', 
          content: currentContent.replace(
            /!\[([^\]]*)\]\(\/static\/([^)]+)\)/g,
            (_, alt, path) => `![${alt}](${getStaticFileUrl(path)})`
          ) 
        });
        currentContent = '';
      }
      
      // Add the translatable block content
      let blockContent = '';
      for (let i = block.startIndex; i <= block.endIndex && i < lines.length; i++) {
        blockContent += (blockContent ? '\n' : '') + lines[i];
        lineIndex = Math.max(lineIndex, i + 1);
      }
      
      if (blockContent.trim()) {
        parts.push({ 
          type: 'markdown', 
          content: blockContent.replace(
            /!\[([^\]]*)\]\(\/static\/([^)]+)\)/g,
            (_, alt, path) => `![${alt}](${getStaticFileUrl(path)})`
          ) 
        });
        parts.push({ 
          type: 'translation', 
          content: block.text, 
          blockIndex: translatableBlocks.indexOf(block) 
        });
      }
    }
    
    // Add remaining content
    while (lineIndex < lines.length) {
      currentContent += (currentContent ? '\n' : '') + lines[lineIndex];
      lineIndex++;
    }
    
    if (currentContent.trim()) {
      parts.push({ 
        type: 'markdown', 
        content: currentContent.replace(
          /!\[([^\]]*)\]\(\/static\/([^)]+)\)/g,
          (_, alt, path) => `![${alt}](${getStaticFileUrl(path)})`
        ) 
      });
    }
    
    return parts;
  }, [content, processedContent, translatableBlocks, enableTranslation]);

  // Create common markdown props
  const markdownProps = {
    style: {
      backgroundColor: 'transparent',
      color: 'inherit',
      fontFamily: 'inherit',
      fontSize: `${fontSize}%`,
    },
    wrapperElement: {
      'data-color-mode': 'light'
    },
    rehypePlugins: [
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
    ],
    remarkPlugins: [
      remarkGfm,
      [remarkMath, {
        singleDollarTextMath: true,
        inlineMathDouble: false,
      }]
    ],
    components: {
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
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`markdown-viewer w-full ${className}`} 
      data-force-wrap="true"
      style={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        overflowX: 'auto',
        overflowY: 'visible',
      }}
    >
      {/* Render content parts with translation blocks */}
      {contentParts.map((part, index) => {
        if (part.type === 'markdown') {
          return (
            <MarkdownPreview
              key={index}
              source={part.content}
              {...markdownProps}
            />
          );
        } else if (part.type === 'translation' && typeof part.blockIndex === 'number') {
          const blockId = generateBlockId(taskId, part.blockIndex);
          const translation = translations.get(blockId);
          const isBlockTranslating = currentTranslationTask === blockId && isTranslating;
          
          return (
            <TranslationBlock
              key={`translation-${index}`}
              blockId={blockId}
              originalText={part.content}
              translation={translation}
              isTranslating={isBlockTranslating}
              onTranslate={() => handleTranslateBlock(part.blockIndex!)}
              onRetranslate={() => handleRetranslateBlock(part.blockIndex!)}
              onRemoveTranslation={() => removeTranslation(blockId)}
              showOriginal={translationSettings.showOriginal}
              className="my-4"
            />
          );
        }
        return null;
      })}
      
      {/* Fallback: render original content if no translation parts */}
      {!enableTranslation && (
        <MarkdownPreview
          source={processedContent}
          {...markdownProps}
        />
      )}
    </div>
  );
}