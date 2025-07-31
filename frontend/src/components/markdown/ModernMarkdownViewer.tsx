import React, { useRef, useMemo } from 'react';
import MarkdownPreview from '@uiw/react-markdown-preview';
import '@uiw/react-markdown-preview/markdown.css';
import './markdown-styles.css';

// Get API base URL for constructing full image URLs
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';

interface ModernMarkdownViewerProps {
  content: string;
  className?: string;
  fontSize?: number; // 字号百分比
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
  
  // Process content to fix image URLs
  const processedContent = useMemo(() => {
    if (!content) return '';
    
    // Replace relative /static/ paths with full URLs
    return content.replace(
      /!\[([^\]]*)\]\(\/static\/([^)]+)\)/g,
      `![$1](${API_BASE_URL}/static/$2)`
    );
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
        rehypePlugins={[]}
        remarkPlugins={[]}
        wrapperElement={{ 'data-color-mode': 'light' }}
        data-color-mode="light"
      />
    </div>
  );
}