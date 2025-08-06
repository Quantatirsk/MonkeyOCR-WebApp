/**
 * Translation-Enhanced Markdown Viewer
 * Extends ModernMarkdownViewer with translation hover functionality
 */
import React, { useRef, useMemo, useState, useCallback } from 'react';
import MarkdownPreview from '@uiw/react-markdown-preview';
import '@uiw/react-markdown-preview/markdown.css';
import 'katex/dist/katex.min.css';
import '../markdown/markdown-styles.css';
import { getStaticFileUrl } from '../../config';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import katex from 'katex';

import { HoverToolsMenu } from './HoverToolsMenu';
import { TranslationResult, ExplanationResult } from './TranslationResult';
import { useTranslationStore } from '../../store/translationStore';
import { toast } from '../../hooks/use-toast';

interface TranslationEnhancedMarkdownViewerProps {
  content: string;
  taskId: string;
  className?: string;
  fontSize?: number;
}

interface BlockTranslationState {
  [blockId: string]: {
    status: 'pending' | 'completed' | 'error';
    translation?: string;
    explanation?: string;
    error?: string;
  };
}

// Rehype plugin to add block IDs and hover functionality
function rehypeAddBlockIds() {
  let blockCounter = 0;

  return (tree: any) => {
    visit(tree, 'element', (node: any) => {
      // Add IDs to block elements (excluding images as specified)
      if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'li', 'div', 'pre', 'table'].includes(node.tagName)) {
        blockCounter++;
        const blockId = `translation-block-${blockCounter}`;
        
        // Add data attributes for hover detection
        node.properties = node.properties || {};
        node.properties.id = blockId;
        node.properties['data-translation-block'] = true;
        node.properties['data-block-id'] = blockId;
        node.properties.className = [
          ...(node.properties.className || []),
          'translation-hoverable'
        ];
      }
    });
  };
}

// Rehype plugin to handle table math expressions (same as original)
function rehypeTableMath() {
  return (tree: any) => {
    visit(tree, 'element', (node: any) => {
      if (node.tagName === 'td' || node.tagName === 'th') {
        visit(node, 'text', (textNode: any) => {
          if (typeof textNode.value === 'string') {
            const text = textNode.value;
            
            if (text.includes('$') && text.match(/\$[^$]+\$/)) {
              const parts = text.split(/(\$[^$]+\$)/);
              const newChildren: any[] = [];
              
              parts.forEach((part: string) => {
                if (part.match(/^\$[^$]+\$$/)) {
                  const mathContent = part.slice(1, -1);
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
                    });
                  } catch (error) {
                    console.warn('KaTeX math rendering error:', error);
                    newChildren.push({
                      type: 'text',
                      value: part
                    });
                  }
                } else if (part.trim()) {
                  newChildren.push({
                    type: 'text',
                    value: part
                  });
                }
              });
              
              if (newChildren.length > 0) {
                const parent = textNode.parent;
                const index = parent.children.indexOf(textNode);
                parent.children.splice(index, 1, ...newChildren);
              }
            }
          }
        });
      }
    });
  };
}

export const TranslationEnhancedMarkdownViewer: React.FC<TranslationEnhancedMarkdownViewerProps> = ({
  content,
  taskId,
  className = '',
  fontSize = 100
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Translation store
  const {
    selectedSourceLanguage,
    selectedTargetLanguage,
    translationStyle,
    hoveredBlockId,
    hoverMenuVisible,
    hoverMenuPosition,
    setHoverState,
    translateBlock,
    explainBlock
  } = useTranslationStore();

  // Local state for block translations
  const [blockTranslations, setBlockTranslations] = useState<BlockTranslationState>({});
  
  // Hover timeout ref
  const hoverTimeoutRef = useRef<NodeJS.Timeout>();

  // Handle mouse enter on translatable blocks
  const handleBlockMouseEnter = useCallback((event: React.MouseEvent) => {
    const target = event.currentTarget as HTMLElement;
    const blockId = target.getAttribute('data-block-id');
    
    if (!blockId) return;

    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    // Set a small delay to prevent menu flashing
    hoverTimeoutRef.current = setTimeout(() => {
      const rect = target.getBoundingClientRect();
      setHoverState(blockId, true, {
        x: rect.right + 10,
        y: rect.top
      });
    }, 300);
  }, [setHoverState]);

  // Handle mouse leave
  const handleBlockMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    // Delay hiding the menu to allow moving to it
    hoverTimeoutRef.current = setTimeout(() => {
      setHoverState(null, false);
    }, 100);
  }, [setHoverState]);

  // Get block content for translation
  const getBlockContent = useCallback((blockId: string): string => {
    const element = document.getElementById(blockId);
    if (!element) return '';
    
    // Extract text content, skipping images
    return element.innerText || element.textContent || '';
  }, []);

  // Handle translation request
  const handleTranslate = useCallback(async (blockId: string, content: string) => {
    if (!content.trim()) {
      toast({
        title: "No Content",
        description: "No text content found to translate",
        variant: "destructive",
        duration: 3000
      });
      return;
    }

    // Set pending state
    setBlockTranslations(prev => ({
      ...prev,
      [blockId]: { status: 'pending' }
    }));

    try {
      const translation = await translateBlock(
        taskId,
        blockId,
        content,
        {
          source_language: selectedSourceLanguage,
          target_language: selectedTargetLanguage,
          preserve_formatting: true,
          translation_style: translationStyle
        }
      );

      setBlockTranslations(prev => ({
        ...prev,
        [blockId]: {
          status: 'completed',
          translation
        }
      }));

      toast({
        title: "Translation Complete",
        description: "Block has been translated successfully",
        duration: 2000
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      setBlockTranslations(prev => ({
        ...prev,
        [blockId]: {
          status: 'error',
          error: errorMessage
        }
      }));

      toast({
        title: "Translation Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 5000
      });
    }
  }, [taskId, selectedSourceLanguage, selectedTargetLanguage, translationStyle, translateBlock]);

  // Handle explanation request
  const handleExplain = useCallback(async (blockId: string, content: string) => {
    if (!content.trim()) {
      toast({
        title: "No Content",
        description: "No text content found to explain",
        variant: "destructive",
        duration: 3000
      });
      return;
    }

    // Set pending state
    setBlockTranslations(prev => ({
      ...prev,
      [blockId]: { status: 'pending' }
    }));

    try {
      const explanation = await explainBlock(taskId, blockId, content, selectedTargetLanguage);

      setBlockTranslations(prev => ({
        ...prev,
        [blockId]: {
          status: 'completed',
          explanation
        }
      }));

      toast({
        title: "Explanation Complete",
        description: "Block explanation generated successfully",
        duration: 2000
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      setBlockTranslations(prev => ({
        ...prev,
        [blockId]: {
          status: 'error',
          error: errorMessage
        }
      }));

      toast({
        title: "Explanation Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 5000
      });
    }
  }, [taskId, selectedTargetLanguage, explainBlock]);

  // Process content to fix image URLs (same as original)
  const processedContent = useMemo(() => {
    if (!content) return '';
    
    return content.replace(
      /!\[([^\]]*)\]\((?!http)([^)]+)\)/g, 
      (match, alt, src) => {
        if (src.startsWith('/static/')) {
          const staticUrl = getStaticFileUrl(src.replace('/static/', ''));
          return `![${alt}](${staticUrl})`;
        }
        return match;
      }
    );
  }, [content]);

  // Setup rehype plugins
  const rehypePlugins = useMemo(() => [
    rehypeRaw,
    rehypeKatex,
    rehypeTableMath,
    rehypeAddBlockIds,
  ], []);

  const remarkPlugins = useMemo(() => [
    remarkGfm,
    remarkMath,
  ], []);

  // Add event listeners after component mounts
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseEnter = (e: Event) => {
      if ((e.target as HTMLElement).hasAttribute('data-translation-block')) {
        handleBlockMouseEnter(e as any);
      }
    };

    const handleMouseLeave = (e: Event) => {
      if ((e.target as HTMLElement).hasAttribute('data-translation-block')) {
        handleBlockMouseLeave();
      }
    };

    container.addEventListener('mouseenter', handleMouseEnter, { capture: true });
    container.addEventListener('mouseleave', handleMouseLeave, { capture: true });

    return () => {
      container.removeEventListener('mouseenter', handleMouseEnter, { capture: true });
      container.removeEventListener('mouseleave', handleMouseLeave, { capture: true });
    };
  }, [handleBlockMouseEnter, handleBlockMouseLeave]);

  return (
    <div 
      ref={containerRef}
      className={`modern-markdown-viewer translation-enhanced ${className}`}
      style={{ fontSize: `${fontSize}%` }}
    >
      <style jsx>{`
        .translation-hoverable {
          position: relative;
          transition: background-color 0.2s ease;
        }
        
        .translation-hoverable:hover {
          background-color: rgba(59, 130, 246, 0.05);
          border-radius: 4px;
          cursor: pointer;
        }
        
        .translation-enhanced .katex {
          font-size: 1.1em;
        }
        
        .translation-enhanced .search-highlight {
          background-color: #fef08a;
          color: #854d0e;
          padding: 0.1em 0.2em;
          border-radius: 0.2em;
        }
      `}</style>

      <MarkdownPreview
        source={processedContent}
        rehypePlugins={rehypePlugins}
        remarkPlugins={remarkPlugins}
        style={{
          backgroundColor: 'transparent',
          color: 'inherit',
        }}
      />

      {/* Render translation results after each block */}
      {Object.entries(blockTranslations).map(([blockId, translation]) => {
        const blockElement = document.getElementById(blockId);
        if (!blockElement || !translation) return null;

        // Create a portal-like effect by rendering after the block
        return (
          <div key={blockId}>
            {translation.translation && (
              <TranslationResult
                blockId={blockId}
                result={{
                  block_id: blockId,
                  original_content: getBlockContent(blockId),
                  translated_content: translation.translation,
                  status: translation.status as any,
                  error_message: translation.error
                }}
                sourceLanguage={selectedSourceLanguage}
                targetLanguage={selectedTargetLanguage}
                onCopy={(content) => {
                  toast({
                    title: "Copied",
                    description: "Translation copied to clipboard",
                    duration: 2000
                  });
                }}
              />
            )}
            
            {translation.explanation && (
              <ExplanationResult
                blockId={blockId}
                content={getBlockContent(blockId)}
                explanation={translation.explanation}
                status={translation.status as any}
                error={translation.error}
                onCopy={(content) => {
                  toast({
                    title: "Copied",
                    description: "Explanation copied to clipboard",
                    duration: 2000
                  });
                }}
              />
            )}
          </div>
        );
      })}

      {/* Hover tools menu */}
      <HoverToolsMenu
        blockId={hoveredBlockId || ''}
        content={hoveredBlockId ? getBlockContent(hoveredBlockId) : ''}
        visible={hoverMenuVisible}
        position={hoverMenuPosition}
        onTranslate={handleTranslate}
        onExplain={handleExplain}
        onClose={() => setHoverState(null, false)}
      />
    </div>
  );
};