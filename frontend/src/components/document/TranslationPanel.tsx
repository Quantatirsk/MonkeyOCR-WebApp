/**
 * TranslationPanel Component
 * 翻译tab页的主体组件
 * 自动执行快速翻译并显示内联翻译结果
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Languages, Sparkles, Copy, Download, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Progress } from '../ui/progress';
import { ScrollArea } from '../ui/scroll-area';
import { BlockMarkdownViewer } from '../markdown/BlockMarkdownViewer';
import { useBlockActions } from '../translation';
import { useUserPreferencesStore } from '../../store/userPreferencesStore';
import { BlockData } from '../../types';
import { BlockMarkdownGenerator } from '../../utils/blockMarkdownGenerator';
import { toast } from 'sonner';
import { FONT_SIZES, FONT_LABELS } from './constants';
import { getMediaFileUrl } from '../../config';

interface TranslationPanelProps {
  blockData: BlockData[];
  taskId: string;
  className?: string;
}

export const TranslationPanel: React.FC<TranslationPanelProps> = ({
  blockData,
  taskId,
  className = ''
}) => {
  // 翻译状态
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState({ current: 0, total: 0 });
  const [hasStartedTranslation, setHasStartedTranslation] = useState(false);
  const [fontSizeLevel, setFontSizeLevel] = useState(1); // 默认中等字体
  const markdownZoom = FONT_SIZES[fontSizeLevel];
  
  // 引用，防止重复翻译
  const translationStartedRef = useRef(false);
  const prevTaskIdRef = useRef<string>();
  
  // 获取用户翻译引擎偏好 (currently not used but kept for future reference)
  // const translationEngine = useUserPreferencesStore(state => state.translationEngine);
  
  // 使用翻译功能
  const blockActions = useBlockActions({
    blockData,
    enabled: true,
    targetLanguage: 'zh'
  });
  
  // 任务切换时重置状态
  useEffect(() => {
    // 如果任务ID变化，重置状态
    if (prevTaskIdRef.current !== taskId) {
      prevTaskIdRef.current = taskId;
      translationStartedRef.current = false;
      setHasStartedTranslation(false);
      blockActions.clearAllTranslations();
    }
  }, [taskId]);
  
  // 快速翻译（使用MT，图片/表格/公式自动fallback到LLM）
  const handleFullTranslate = useCallback(async () => {
    if (isTranslating || blockData.length === 0) return;
    
    setIsTranslating(true);
    setHasStartedTranslation(true);
    translationStartedRef.current = true;
    setTranslationProgress({ current: 0, total: blockData.length });
    
    // 临时设置用户偏好为MT
    const originalEngine = useUserPreferencesStore.getState().translationEngine;
    useUserPreferencesStore.getState().setTranslationEngine('mt');
    
    try {
      await blockActions.translateAllBlocks(
        (completed, total) => {
          setTranslationProgress({ current: completed, total });
        },
        10 // 并发数10个，利用并发提升速度
      );
      
      toast.success('快速翻译完成');
    } catch (error) {
      console.error('Translation error:', error);
      toast.error('翻译过程中出现错误');
    } finally {
      // 恢复原始引擎设置
      useUserPreferencesStore.getState().setTranslationEngine(originalEngine);
      setIsTranslating(false);
    }
  }, [blockData, blockActions, isTranslating]);
  
  // 精准翻译（强制使用LLM重新翻译所有区块）
  const handlePreciseTranslate = useCallback(async () => {
    if (isTranslating || blockData.length === 0) return;
    
    setIsTranslating(true);
    setHasStartedTranslation(true);
    translationStartedRef.current = true;
    setTranslationProgress({ current: 0, total: blockData.length });
    
    // 清除现有翻译
    blockActions.clearAllTranslations();
    
    // 临时设置用户偏好为LLM
    const originalEngine = useUserPreferencesStore.getState().translationEngine;
    useUserPreferencesStore.getState().setTranslationEngine('llm');
    
    try {
      await blockActions.translateAllBlocks(
        (completed, total) => {
          setTranslationProgress({ current: completed, total });
        },
        8 // LLM使用并发，提升翻译速度
      );
      
      toast.success('精准翻译完成');
    } catch (error) {
      console.error('Precise translation error:', error);
      toast.error('精准翻译过程中出现错误');
    } finally {
      // 恢复原始引擎设置
      useUserPreferencesStore.getState().setTranslationEngine(originalEngine);
      setIsTranslating(false);
    }
  }, [blockData, blockActions, isTranslating]);
  
  // 处理图片路径，转换为完整URL
  const processImagePath = useCallback((content: string) => {
    // 匹配 markdown 图片语法
    return content.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (match, alt, src) => {
        // 如果是 /media/ 开头的路径，转换为完整URL
        if (src.startsWith('/media/')) {
          const fullUrl = getMediaFileUrl(src.slice(7)); // 移除 /media/ 前缀
          return `![${alt}](${fullUrl})`;
        }
        // 其他路径保持不变
        return match;
      }
    );
  }, []);
  
  // 复制译文
  const handleCopyTranslations = useCallback(async () => {
    const translatedBlocks: string[] = [];
    
    blockData.forEach((block) => {
      const translation = blockActions.getTranslation(block.index);
      
      // 如果是图片区块，先插入原始图片，再添加译文（图像识别结果）
      if (block.type === 'image') {
        // 保留原始图片，并转换为完整URL
        const imageWithFullUrl = processImagePath(block.content);
        translatedBlocks.push(imageWithFullUrl);
        // 如果有译文（图像识别结果），添加在图片下方
        if (translation) {
          translatedBlocks.push(translation);
        }
      } else if (block.type === 'title') {
        // 对于title类型，确保有二级标题格式
        if (translation) {
          // 检查译文是否已经有标题标记
          const hasHeadingMarker = /^#{1,6}\s/.test(translation.trim());
          if (!hasHeadingMarker) {
            // 如果没有，添加二级标题标记
            translatedBlocks.push(`## ${translation.trim()}`);
          } else {
            translatedBlocks.push(translation);
          }
        } else {
          // 如果没有翻译，保留原文并确保有标题格式
          const hasHeadingMarker = /^#{1,6}\s/.test(block.content.trim());
          if (!hasHeadingMarker) {
            translatedBlocks.push(`## ${block.content.trim()}`);
          } else {
            translatedBlocks.push(block.content);
          }
        }
      } else {
        // 其他区块类型，使用译文或原文
        if (translation) {
          translatedBlocks.push(translation);
        } else {
          // 如果没有翻译，保留原文作为占位
          translatedBlocks.push(block.content);
        }
      }
    });
    
    // 直接拼接译文，不添加额外标记
    const translatedText = translatedBlocks.join('\n\n');
    
    try {
      await navigator.clipboard.writeText(translatedText);
      toast.success('已复制译文到剪贴板');
    } catch (error) {
      console.error('Copy failed:', error);
      toast.error('复制失败');
    }
  }, [blockData, blockActions, processImagePath]);
  
  // 下载译文为 Markdown 文件
  const handleDownloadTranslations = useCallback(() => {
    const translatedBlocks: string[] = [];
    
    blockData.forEach((block) => {
      const translation = blockActions.getTranslation(block.index);
      
      // 如果是图片区块，先插入原始图片，再添加译文（图像识别结果）
      if (block.type === 'image') {
        // 保留原始图片，并转换为完整URL
        const imageWithFullUrl = processImagePath(block.content);
        translatedBlocks.push(imageWithFullUrl);
        // 如果有译文（图像识别结果），添加在图片下方
        if (translation) {
          translatedBlocks.push(translation);
        }
      } else if (block.type === 'title') {
        // 对于title类型，确保有二级标题格式
        if (translation) {
          // 检查译文是否已经有标题标记
          const hasHeadingMarker = /^#{1,6}\s/.test(translation.trim());
          if (!hasHeadingMarker) {
            // 如果没有，添加二级标题标记
            translatedBlocks.push(`## ${translation.trim()}`);
          } else {
            translatedBlocks.push(translation);
          }
        } else {
          // 如果没有翻译，保留原文并确保有标题格式
          const hasHeadingMarker = /^#{1,6}\s/.test(block.content.trim());
          if (!hasHeadingMarker) {
            translatedBlocks.push(`## ${block.content.trim()}`);
          } else {
            translatedBlocks.push(block.content);
          }
        }
      } else {
        // 其他区块类型，使用译文或原文
        if (translation) {
          translatedBlocks.push(translation);
        } else {
          // 如果没有翻译，保留原文作为占位
          translatedBlocks.push(block.content);
        }
      }
    });
    
    // 直接拼接译文
    const translatedText = translatedBlocks.join('\n\n');
    
    // 创建 Blob 并下载
    const blob = new Blob([translatedText], { type: 'text/markdown;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `translation_${taskId}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    toast.success('译文已下载');
  }, [blockData, blockActions, taskId, processImagePath]);
  
  // 下载原文+译文对照为 Markdown 文件
  const handleDownloadBilingual = useCallback(() => {
    const bilingualBlocks: string[] = [];
    
    blockData.forEach((block) => {
      const translation = blockActions.getTranslation(block.index);
      
      if (block.type === 'image') {
        // 对于图片区块，保留原始图片，并转换为完整URL
        const imageWithFullUrl = processImagePath(block.content);
        bilingualBlocks.push(imageWithFullUrl);
        
        // 如果有译文（图像识别结果），以引用块格式添加
        if (translation) {
          bilingualBlocks.push(`> ${translation}`);
        }
      } else if (block.type === 'title') {
        // 对于标题类型，先添加原文标题
        const hasHeadingMarker = /^#{1,6}\s/.test(block.content.trim());
        const originalTitle = hasHeadingMarker ? block.content : `## ${block.content.trim()}`;
        bilingualBlocks.push(originalTitle);
        
        // 如果有译文，以引用块格式添加
        if (translation) {
          const translationHasHeading = /^#{1,6}\s/.test(translation.trim());
          const cleanTranslation = translationHasHeading ? translation.replace(/^#{1,6}\s/, '') : translation;
          bilingualBlocks.push(`> ${cleanTranslation.trim()}`);
        }
      } else {
        // 其他区块类型：先添加原文
        bilingualBlocks.push(block.content);
        
        // 如果有译文，以引用块格式添加
        if (translation) {
          bilingualBlocks.push(`> ${translation}`);
        }
      }
    });
    
    // 拼接内容，使用双换行符分隔
    const bilingualText = bilingualBlocks.join('\n\n');
    
    // 创建 Blob 并下载
    const blob = new Blob([bilingualText], { type: 'text/markdown;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bilingual_${taskId}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    toast.success('原文+译文已下载');
  }, [blockData, blockActions, taskId, processImagePath]);
  
  // 字体大小控制
  const handleFontSizeChange = useCallback(() => {
    setFontSizeLevel(prev => (prev + 1) % 3);
  }, []);
  
  // 计算翻译进度百分比
  const progressPercentage = translationProgress.total > 0 
    ? Math.round((translationProgress.current / translationProgress.total) * 100)
    : 0;
  
  // 生成基于区块的markdown内容（与对照tab页保持一致）
  const blockBasedContent = useMemo(() => {
    if (blockData.length > 0) {
      // 使用BlockMarkdownGenerator生成与对照tab页一致的内容
      return BlockMarkdownGenerator.generateFromBlocks(blockData, taskId);
    }
    // 如果没有blockData，返回空字符串
    return '';
  }, [blockData, taskId]);
  
  // 创建自定义的BlockMarkdownViewer，使用内联翻译模式
  const TranslationMarkdownViewer = useCallback(() => {
    return (
      <BlockMarkdownViewer
        content={blockBasedContent}
        blockData={blockData}
        syncEnabled={true}
        fontSize={markdownZoom}
        translations={blockActions.actionState.translations}
        streamingTranslation={{
          blockIndex: blockActions.streamingState.streamingBlockIndex || -1,
          content: blockActions.streamingState.streamContent,
          isStreaming: blockActions.streamingState.isStreaming,
          type: blockActions.streamingState.streamType || undefined
        }}
        // 使用内联翻译模式
        useInlineTranslation={true}
        className="translation-markdown-viewer"
      />
    );
  }, [blockBasedContent, blockData, markdownZoom, blockActions]);
  
  // 如果blockData还没加载，显示加载状态
  if (blockData.length === 0) {
    return (
      <div className={`h-full flex flex-col ${className}`}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center space-x-2">
              <div className="w-1 h-1 bg-primary rounded-full animate-pulse"></div>
              <div className="w-1 h-1 bg-primary rounded-full animate-pulse delay-100"></div>
              <div className="w-1 h-1 bg-primary rounded-full animate-pulse delay-200"></div>
            </div>
            <p className="text-sm text-muted-foreground">正在加载文档数据...</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* 工具栏 */}
      <div className="border-b bg-muted/5 px-3 py-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* 左侧：翻译状态和进度 */}
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            {isTranslating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  正在翻译 {translationProgress.current}/{translationProgress.total} 个区块...
                </span>
                <Progress value={progressPercentage} className="w-32 h-2" />
              </>
            ) : (
              <>
                <Languages className="w-4 h-4 text-primary" />
                <span className="text-sm text-muted-foreground">
                  {hasStartedTranslation ? '翻译完成' : '点击快速翻译开始'}
                </span>
              </>
            )}
          </div>
          
          {/* 右侧：操作按钮 */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* 快速翻译按钮 */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleFullTranslate}
              disabled={isTranslating || blockData.length === 0}
              title="使用机器翻译快速翻译全文"
            >
              <Languages className="w-3.5 h-3.5 mr-1" />
              快速翻译
            </Button>
            
            {/* 精准翻译按钮 */}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreciseTranslate}
              disabled={isTranslating || blockData.length === 0}
              title="使用AI进行高质量翻译"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              精准翻译
            </Button>
            
            {/* 字体大小 */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleFontSizeChange}
              title={`字体大小: ${FONT_LABELS[fontSizeLevel]}`}
            >
              {fontSizeLevel === 0 ? (
                <span className="text-xs font-medium">小</span>
              ) : fontSizeLevel === 2 ? (
                <span className="text-xs font-medium">大</span>
              ) : (
                <span className="text-xs font-medium">中</span>
              )}
            </Button>
            
            {/* 复制译文按钮 */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyTranslations}
              disabled={blockActions.actionState.translations.size === 0}
              title="复制译文"
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
            
            {/* 下载选项下拉菜单 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={blockActions.actionState.translations.size === 0}
                  title="下载选项"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDownloadTranslations}>
                  <Download className="w-4 h-4 mr-2" />
                  下载译文
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadBilingual}>
                  <Download className="w-4 h-4 mr-2" />
                  下载原文+译文
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      
      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full w-full">
          <div className="p-4">
            <TranslationMarkdownViewer />
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default TranslationPanel;