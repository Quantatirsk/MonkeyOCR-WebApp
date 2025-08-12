/**
 * useBlockActions Hook
 * 管理区块翻译和解释操作的状态和逻辑
 */

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { llmWrapper, LLMWrapper } from '../../../lib/llmwrapper';
import { getStaticFileUrl } from '../../../config';
import { 
  buildTranslateMessages, 
  buildExplainMessages,
  buildMultimodalTranslateMessages,
  buildMultimodalExplainMessages
} from '../prompts';
import { 
  detectLanguageAndTarget, 
  isTextSuitableForDetection,
  isSupportedByMT
} from '../languageDetection';
import { mtTranslationService } from '../../../services/mtTranslationService';
import { useUserPreferencesStore } from '../../../store/userPreferencesStore';
import type { 
  BlockActionState, 
  StreamingState, 
  UseBlockActionsReturn, 
  BlockActionOptions,
  StreamType
} from '../types';

const DEFAULT_SHORTCUTS = {
  translate: 'n',
  explain: 'm',
  cancel: 'Escape'
};

/**
 * 从 markdown 内容中提取图片URL和标题
 * 支持格式: ![alt text](url)
 */
function extractImageInfo(content: string): { url: string; title: string } | null {
  const imageRegex = /!\[(.*?)\]\((.*?)\)/;
  const match = content.match(imageRegex);
  if (match && match[2]) {
    const title = match[1] || '';
    const url = match[2];
    // 如果是相对路径，转换为完整URL
    const fullUrl = url.startsWith('/static/') ? getStaticFileUrl(url.slice(8)) : url;
    return { url: fullUrl, title };
  }
  return null;
}


export const useBlockActions = ({
  blockData,
  enabled = true,
  targetLanguage = 'zh',
  shortcuts: _shortcuts = DEFAULT_SHORTCUTS,
  onActionStart,
  onActionComplete,
  onActionError
}: BlockActionOptions): UseBlockActionsReturn => {
  
  // 区块操作状态
  const [actionState, setActionState] = useState<BlockActionState>({
    selectedBlockIndex: null,
    actionMode: 'idle',
    processingBlocks: new Set(),
    activeOperations: new Map(),
    translations: new Map(),  // 存储翻译内容
    explanations: new Map(),  // 存储解释内容（使用相同的显示组件）
    explanationContent: null,  // 保留用于兼容性
    explanationBlockIndex: null  // 保留用于兼容性
  });

  // 流式响应状态
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isStreaming: false,
    streamContent: '',
    streamType: null,
    streamingBlockIndex: null,
    error: null
  });

  // Refs for avoiding stale closures and managing abort controllers
  const actionStateRef = useRef(actionState);
  const streamingStateRef = useRef(streamingState);
  const abortControllersRef = useRef<Map<number, AbortController>>(new Map());
  actionStateRef.current = actionState;
  streamingStateRef.current = streamingState;

  // 获取选中的区块
  const selectedBlock = actionState.selectedBlockIndex !== null 
    ? blockData.find(block => block.index === actionState.selectedBlockIndex) || null
    : null;

  // 检查是否有翻译和解释
  const hasTranslation = actionState.selectedBlockIndex !== null && 
    actionState.translations.has(actionState.selectedBlockIndex);
  
  const hasExplanation = actionState.selectedBlockIndex !== null && 
    actionState.explanations.has(actionState.selectedBlockIndex);

  // 处理流式响应的通用方法
  const handleStreamingResponse = useCallback(async (
    stream: ReadableStream<string>,
    streamType: StreamType,
    blockIndex: number,
    onComplete: (content: string) => void
  ) => {
    // 开始流式传输
    setStreamingState({
      isStreaming: true,
      streamContent: '',
      streamType,
      streamingBlockIndex: blockIndex,
      error: null
    });

    let reader: ReadableStreamDefaultReader<string> | null = null;
    let accumulated = '';
    
    try {
      reader = stream.getReader();
      let isStreamComplete = false;

      while (true) {
        // 检查是否被取消
        const abortController = abortControllersRef.current.get(blockIndex);
        if (abortController?.signal.aborted) {
          throw new Error('操作已取消');
        }
        
        const { done, value } = await reader.read();
        
        if (done) {
          isStreamComplete = true;
          break;
        }
        
        // 累积内容
        accumulated += value;
        
        // 实时更新流式内容 - 只有当前区块正在流式传输时才更新
        setStreamingState(prev => {
          if (prev.streamingBlockIndex === blockIndex) {
            return {
              ...prev,
              streamContent: accumulated,
              isStreaming: true,
              streamType
            };
          }
          return prev;
        });
      }

      // 检查是否被取消
      const abortController = abortControllersRef.current.get(blockIndex);
      if (abortController?.signal.aborted) {
        throw new Error('操作已取消');
      }

      // 完成处理
      if (isStreamComplete && accumulated.trim()) {
        onComplete(accumulated);
        
        // 只有当前流式传输的区块才清理流式状态
        setStreamingState(prev => {
          if (prev.streamingBlockIndex === blockIndex) {
            return {
              ...prev,
              isStreaming: false,
              streamContent: '',
              streamType: null,
              streamingBlockIndex: null
            };
          }
          return prev;
        });

        // 触发完成回调
        onActionComplete?.(blockIndex, streamType, accumulated);
      }
      
    } catch (error) {
      console.error(`${streamType} streaming error:`, error);
      
      let errorMessage = error instanceof Error ? error.message : '处理失败';
      
      // 尝试解析流式错误响应
      if (typeof error === 'object' && error !== null && 'message' in error) {
        try {
          // 检查是否是流式错误格式: data: {"error": {"message": "...", "type": "stream_error"}}
          const errorStr = String(error.message);
          if (errorStr.includes('stream_error') || errorStr.includes('invalid_request_error')) {
            // 尝试提取错误消息
            const match = errorStr.match(/"message":\s*"([^"]+)"/);
            if (match) {
              errorMessage = match[1];
            }
          }
        } catch (parseError) {
          console.warn('Failed to parse stream error:', parseError);
        }
      }
      
      // 如果是取消操作，不显示错误提示
      if (!errorMessage.includes('取消')) {
        // 清理当前区块的处理状态
        setActionState(prev => ({
          ...prev,
          processingBlocks: new Set([...prev.processingBlocks].filter(id => id !== blockIndex)),
          activeOperations: new Map([...prev.activeOperations].filter(([id]) => id !== blockIndex))
        }));
        
        // 只有当前流式传输的区块才更新错误状态
        setStreamingState(prev => {
          if (prev.streamingBlockIndex === blockIndex) {
            return {
              ...prev,
              isStreaming: false,
              streamContent: '',
              streamType: null,
              streamingBlockIndex: null,
              error: errorMessage
            };
          }
          return prev;
        });

        // 触发错误回调
        onActionError?.(blockIndex, streamType, errorMessage);
        
        toast.error(`${streamType === 'translate' ? '翻译' : '解释'}失败: ${errorMessage}`);
      } else {
        // 取消操作，清理状态
        setActionState(prev => ({
          ...prev,
          processingBlocks: new Set([...prev.processingBlocks].filter(id => id !== blockIndex)),
          activeOperations: new Map([...prev.activeOperations].filter(([id]) => id !== blockIndex))
        }));
        
        setStreamingState(prev => {
          if (prev.streamingBlockIndex === blockIndex) {
            return {
              ...prev,
              isStreaming: false,
              streamContent: '',
              streamType: null,
              streamingBlockIndex: null,
              error: null
            };
          }
          return prev;
        });
      }
    } finally {
      // 清理资源
      if (reader) {
        try {
          reader.releaseLock();
        } catch (e) {
          console.warn('Error releasing reader:', e);
        }
      }
      
      // 清理该区块的 abort controller
      abortControllersRef.current.delete(blockIndex);
      
      // 清理该区块的处理状态
      setActionState(prev => ({
        ...prev,
        processingBlocks: new Set([...prev.processingBlocks].filter(id => id !== blockIndex)),
        activeOperations: new Map([...prev.activeOperations].filter(([id]) => id !== blockIndex))
      }));
    }
  }, [onActionComplete, onActionError]);

  // 翻译区块
  const translateBlock = useCallback(async (blockIndex: number, force: boolean = false) => {
    if (!enabled || actionState.processingBlocks.has(blockIndex)) return;

    const block = blockData.find(b => b.index === blockIndex);
    if (!block) {
      toast.error('未找到指定区块');
      return;
    }

    // 检查是否已有翻译（除非是强制刷新）
    if (!force && actionState.translations.has(blockIndex)) {
      toast.info('该区块已有翻译');
      return;
    }

    // 创建 AbortController
    const abortController = new AbortController();
    abortControllersRef.current.set(blockIndex, abortController);

    // 更新状态
    setActionState(prev => ({
      ...prev,
      selectedBlockIndex: blockIndex,
      actionMode: 'translate',
      processingBlocks: new Set([...prev.processingBlocks, blockIndex]),
      activeOperations: new Map([...prev.activeOperations, [blockIndex, 'translate']])
    }));

    // 触发开始回调
    onActionStart?.(blockIndex, 'translate');

    try {
      // 获取要翻译的内容（表格类型使用HTML内容）
      const contentType = block.type || 'text';
      const contentToTranslate = contentType === 'table' 
        ? (block.html_content || block.content)
        : block.content;

      // 自动检测语言并确定翻译方向
      let detectedLanguageInfo = null;
      let actualTargetLanguage = targetLanguage;
      
      if (isTextSuitableForDetection(contentToTranslate)) {
        detectedLanguageInfo = detectLanguageAndTarget(contentToTranslate);
        actualTargetLanguage = detectedLanguageInfo.targetLanguage;
        
        console.log('🌐 语言检测结果:', detectedLanguageInfo);
      } else {
        // 文本太短，使用默认翻译方向
        console.log('⚠️ 文本过短，使用默认翻译方向:', targetLanguage);
      }

      // 获取用户的翻译引擎偏好
      const userTranslationEngine = useUserPreferencesStore.getState().translationEngine;
      const userLLMModel = useUserPreferencesStore.getState().llmModel;
      
      // 表格、图片和公式类型必须使用LLM
      let engineSelection;
      if (contentType === 'table' || contentType === 'image' || contentType === 'interline_equation') {
        let reason = '';
        if (contentType === 'table') reason = '表格内容需要使用LLM翻译';
        else if (contentType === 'image') reason = '图片内容需要使用LLM翻译';
        else if (contentType === 'interline_equation') reason = '数学公式需要使用LLM翻译';
        
        engineSelection = {
          engine: 'llm' as const,
          reason
        };
      } else {
        // 标题和文本类型可以使用MT（根据语言和用户偏好）
        // 不需要再检查内容，因为我们已经知道确切的块类型
        console.log('🔍 Block type for MT selection:', {
          contentType,
          userTranslationEngine,
          detectedLanguageInfo,
          targetLanguage: actualTargetLanguage
        });
        
        const languageInfo = detectedLanguageInfo || { 
          detected: 'und', 
          confidence: 'low', 
          targetLanguage: actualTargetLanguage as 'zh' | 'en',
          sourceName: '未知',
          targetName: actualTargetLanguage === 'zh' ? '中文' : '英文'
        };
        
        // 直接根据用户偏好和语言支持决定引擎
        const isMTSupported = isSupportedByMT(languageInfo.detected, actualTargetLanguage);
        console.log('🔍 MT support check:', {
          sourceLang: languageInfo.detected,
          targetLang: actualTargetLanguage,
          isMTSupported
        });
        
        if (userTranslationEngine === 'mt' && isMTSupported) {
          engineSelection = { engine: 'mt' as const };
        } else if (userTranslationEngine === 'mt') {
          // MT被选中但语言不支持
          engineSelection = { 
            engine: 'llm' as const, 
            reason: 'MT不支持此语言对，自动切换到LLM翻译' 
          };
        } else {
          // 用户选择了LLM
          engineSelection = { engine: 'llm' as const };
        }
      }
      
      // 仅在控制台记录翻译引擎选择
      if (detectedLanguageInfo) {
        const engineInfo = engineSelection.engine === 'mt' ? ' (机器翻译)' : ' (AI翻译)';
        console.log(`🌐 检测到${detectedLanguageInfo.sourceName}，正在翻译为${detectedLanguageInfo.targetName}${engineInfo}...`);
      } else {
        const engineInfo = engineSelection.engine === 'mt' ? '机器翻译' : 'AI翻译';
        console.log(`🌐 正在使用${engineInfo}翻译选中区块...`);
      }
      
      // 如果有切换原因，仅在控制台记录
      if (engineSelection.reason) {
        console.log('🔄 翻译引擎选择:', engineSelection);
      }

      // 对于图片类型，检查并提取图片URL和标题，然后转换为base64
      let messages;
      if (contentType === 'image') {
        const imageInfo = extractImageInfo(contentToTranslate);
        if (imageInfo) {
          try {
            // 转换图片URL为base64格式
            console.log('🖼️ 开始转换图片URL为base64:', imageInfo.url, '标题:', imageInfo.title);
            const base64DataUrl = await LLMWrapper.imageUrlToDataUrl(imageInfo.url);
            
            // 使用多模态消息构建（包含base64图片和标题）
            messages = buildMultimodalTranslateMessages(
              contentType,
              contentToTranslate,
              base64DataUrl,
              actualTargetLanguage,
              detectedLanguageInfo?.detected,
              detectedLanguageInfo ? {
                sourceName: detectedLanguageInfo.sourceName,
                targetName: detectedLanguageInfo.targetName,
                confidence: detectedLanguageInfo.confidence
              } : undefined
            );
            console.log('🖼️ 使用多模态翻译，图片已转换为base64，包含标题信息');
          } catch (error) {
            console.error('图片base64转换失败:', error);
            // 转换失败，终止操作
            setActionState(prev => ({
              ...prev,
              actionMode: 'idle',
              processingBlocks: new Set([...prev.processingBlocks].filter(id => id !== blockIndex)),
              activeOperations: new Map([...prev.activeOperations].filter(([id]) => id !== blockIndex))
            }));
            toast.error('图片加载失败，无法进行翻译');
            return;
          }
        } else {
          // 没有找到图片URL，使用纯文本模式
          messages = buildTranslateMessages(
            contentType, 
            contentToTranslate, 
            actualTargetLanguage,
            detectedLanguageInfo?.detected,
            detectedLanguageInfo ? {
              sourceName: detectedLanguageInfo.sourceName,
              targetName: detectedLanguageInfo.targetName,
              confidence: detectedLanguageInfo.confidence
            } : undefined
          );
        }
      } else {
        // 非图片类型，使用标准文本消息
        messages = buildTranslateMessages(
          contentType, 
          contentToTranslate, 
          actualTargetLanguage,
          detectedLanguageInfo?.detected,
          detectedLanguageInfo ? {
            sourceName: detectedLanguageInfo.sourceName,
            targetName: detectedLanguageInfo.targetName,
            confidence: detectedLanguageInfo.confidence
          } : undefined
        );
      }

      // 根据选择的引擎进行翻译
      if (engineSelection.engine === 'mt') {
        // 使用MT翻译（非流式）
        try {
          console.log('🚀 使用MT翻译服务...');
          const translatedText = await mtTranslationService.translateText(
            contentToTranslate,
            detectedLanguageInfo?.detected || 'en',
            actualTargetLanguage
          );
          
          // 保存翻译结果
          setActionState(prev => ({
            ...prev,
            translations: new Map(prev.translations).set(blockIndex, translatedText),
            actionMode: 'idle',
            processingBlocks: new Set([...prev.processingBlocks].filter(id => id !== blockIndex)),
            activeOperations: new Map([...prev.activeOperations].filter(([id]) => id !== blockIndex))
          }));
          
          // 触发完成回调
          onActionComplete?.(blockIndex, 'translate', translatedText);
          
          // 仅在控制台记录
          console.log('✅ 机器翻译完成');
          
        } catch (mtError) {
          console.error('MT翻译失败，尝试fallback到LLM:', mtError);
          console.log('⚠️ 机器翻译失败，切换到AI翻译...');
          
          // Fallback到LLM
          const estimatedTokens = Math.min(8000, Math.max(1000, block.content.length * 4));
          const stream = await llmWrapper.streamChat({
            messages,
            temperature: 0.3,
            maxTokens: estimatedTokens,
            model: userLLMModel || undefined
          });
          
          // 处理流式响应
          await handleStreamingResponse(stream, 'translate', blockIndex, (translatedContent) => {
            // 保存翻译结果
            setActionState(prev => ({
              ...prev,
              translations: new Map(prev.translations).set(blockIndex, translatedContent),
              actionMode: 'idle'
            }));
            
            // 仅在控制台记录
            console.log('✅ AI翻译完成');
          });
        }
      } else {
        // 使用LLM翻译（流式）
        console.log('🤖 使用LLM翻译服务...');
        
        // 计算合理的 token 限制
        // 中文字符通常需要 2-3 个 tokens，翻译后可能会扩展
        // 使用更保守的估算：原文长度 * 4，最小 1000，最大 8000
        const estimatedTokens = Math.min(8000, Math.max(1000, block.content.length * 4));
        
        const stream = await llmWrapper.streamChat({
          messages,
          temperature: 0.3,
          maxTokens: estimatedTokens,
          model: userLLMModel || undefined
        });

        // 处理流式响应
        await handleStreamingResponse(stream, 'translate', blockIndex, (translatedContent) => {
          // 保存翻译结果
          setActionState(prev => ({
            ...prev,
            translations: new Map(prev.translations).set(blockIndex, translatedContent),
            actionMode: 'idle'
          }));
          
          // 仅在控制台记录
          console.log('✅ AI翻译完成');
        });
      }

    } catch (error) {
      console.error('Translation error:', error);
      const errorMessage = error instanceof Error ? error.message : '翻译失败';
      
      setActionState(prev => ({
        ...prev,
        actionMode: 'idle',
              }));

      onActionError?.(blockIndex, 'translate', errorMessage);
      toast.error(`翻译失败: ${errorMessage}`, { duration: 1000 });
    }
  }, [enabled, actionState.processingBlocks.size > 0, actionState.translations, blockData, targetLanguage, onActionStart, llmWrapper, handleStreamingResponse]);

  // 解释区块
  const explainBlock = useCallback(async (blockIndex: number, force: boolean = false) => {
    if (!enabled || actionState.processingBlocks.has(blockIndex)) return;

    const block = blockData.find(b => b.index === blockIndex);
    if (!block) {
      toast.error('未找到指定区块');
      return;
    }

    // 检查是否已有解释（除非是强制刷新）
    if (!force && actionState.explanations.has(blockIndex)) {
      toast.info('该区块已有解释');
      return;
    }

    // 创建 AbortController
    const abortController = new AbortController();
    abortControllersRef.current.set(blockIndex, abortController);

    // 更新状态
    setActionState(prev => ({
      ...prev,
      selectedBlockIndex: blockIndex,
      actionMode: 'explain',
      processingBlocks: new Set([...prev.processingBlocks, blockIndex]),
      activeOperations: new Map([...prev.activeOperations, [blockIndex, 'explain']]),
      explanationContent: null,
      explanationBlockIndex: blockIndex
    }));

    // 触发开始回调
    onActionStart?.(blockIndex, 'explain');
    
    // 仅在控制台记录
    console.log('🔍 正在生成解释...');

    try {
      // 获取要解释的内容（表格类型使用HTML内容）
      const contentType = block.type || 'text';
      const contentToExplain = contentType === 'table' 
        ? (block.html_content || block.content)
        : block.content;

      // 对于图片类型，检查并提取图片URL和标题，然后转换为base64
      let messages;
      if (contentType === 'image') {
        const imageInfo = extractImageInfo(contentToExplain);
        if (imageInfo) {
          try {
            // 转换图片URL为base64格式
            console.log('🖼️ 开始转换图片URL为base64:', imageInfo.url, '标题:', imageInfo.title);
            const base64DataUrl = await LLMWrapper.imageUrlToDataUrl(imageInfo.url);
            
            // 使用多模态消息构建（包含base64图片）
            messages = buildMultimodalExplainMessages(
              contentType,
              contentToExplain,
              base64DataUrl
            );
            console.log('🖼️ 使用多模态解释，图片已转换为base64，包含标题信息');
          } catch (error) {
            console.error('图片base64转换失败:', error);
            // 转换失败，终止操作
            setActionState(prev => ({
              ...prev,
              actionMode: 'idle',
              processingBlocks: new Set([...prev.processingBlocks].filter(id => id !== blockIndex)),
              activeOperations: new Map([...prev.activeOperations].filter(([id]) => id !== blockIndex)),
              explanationContent: null,
              explanationBlockIndex: null
            }));
            toast.error('图片加载失败，无法进行解释');
            return;
          }
        } else {
          // 没有找到图片URL，使用纯文本模式
          messages = buildExplainMessages(contentType, contentToExplain);
        }
      } else {
        // 非图片类型，使用标准文本消息
        messages = buildExplainMessages(contentType, contentToExplain);
      }

      // 发起流式解释请求
      const stream = await llmWrapper.streamChat({
        messages,
        temperature: 0.7,
        maxTokens: 4000
      });

      // 处理流式响应
      await handleStreamingResponse(stream, 'explain', blockIndex, (explanationContent) => {
        // 保存解释结果到 explanations Map（和翻译使用相同的显示方式）
        setActionState(prev => ({
          ...prev,
          explanations: new Map(prev.explanations).set(blockIndex, explanationContent),
          explanationContent,  // 保留用于兼容性
          actionMode: 'idle',
                  }));
        
        // 仅在控制台记录
        console.log('✅ 解释生成完成');
      });

    } catch (error) {
      console.error('Explanation error:', error);
      const errorMessage = error instanceof Error ? error.message : '解释失败';
      
      setActionState(prev => ({
        ...prev,
        actionMode: 'idle',
        isProcessing: false,
        explanationContent: null,
        explanationBlockIndex: null
      }));

      onActionError?.(blockIndex, 'explain', errorMessage);
      toast.error(`解释失败: ${errorMessage}`, { duration: 1000 });
    }
  }, [enabled, actionState.processingBlocks.size > 0, blockData, onActionStart, llmWrapper, handleStreamingResponse]);

  // 取消操作
  const cancelAction = useCallback(() => {
    if (streamingState.isStreaming && streamingState.streamingBlockIndex !== null) {
      console.log('Canceling streaming request for block:', streamingState.streamingBlockIndex);
      // 使用 AbortController 取消流式请求
      const abortController = abortControllersRef.current.get(streamingState.streamingBlockIndex);
      if (abortController) {
        abortController.abort();
      }
    }

    setActionState(prev => ({
      ...prev,
      actionMode: 'idle',
          }));

    setStreamingState(prev => ({
      ...prev,
      isStreaming: false,
      streamContent: '',
      streamType: null,
      error: null
    }));

    console.log('ℹ️ 操作已取消');
  }, [streamingState.isStreaming]);

  // 清除翻译
  const clearTranslation = useCallback((blockIndex: number) => {
    setActionState(prev => {
      const newTranslations = new Map(prev.translations);
      newTranslations.delete(blockIndex);
      return {
        ...prev,
        translations: newTranslations
      };
    });
  }, []);

  // 清除解释
  const clearExplanation = useCallback((blockIndex?: number) => {
    setActionState(prev => {
      const newExplanations = new Map(prev.explanations);
      if (blockIndex !== undefined) {
        newExplanations.delete(blockIndex);
      } else if (prev.selectedBlockIndex !== null) {
        newExplanations.delete(prev.selectedBlockIndex);
      }
      return {
        ...prev,
        explanations: newExplanations,
        explanationContent: null,  // 保留用于兼容性
        explanationBlockIndex: null  // 保留用于兼容性
      };
    });
  }, []);

  // 清除所有翻译
  const clearAllTranslations = useCallback(() => {
    setActionState(prev => ({
      ...prev,
      translations: new Map()
    }));
  }, []);

  // 清除所有解释
  const clearAllExplanations = useCallback(() => {
    setActionState(prev => ({
      ...prev,
      explanations: new Map(),
      explanationContent: null,
      explanationBlockIndex: null
    }));
  }, []);
  
  // 快速翻译功能 - 改进版：并发执行带重试机制
  const translateAllBlocks = useCallback(async (
    onProgress?: (completed: number, total: number) => void,
    batchSize: number = 10
  ) => {
    if (!enabled || !blockData || blockData.length === 0) {
      toast.error('没有可翻译的内容');
      return;
    }
    
    // 按index排序区块
    const sortedBlocks = [...blockData].sort((a, b) => a.index - b.index);
    const totalBlocks = sortedBlocks.length;
    let completedBlocks = 0;
    
    console.log(`🌍 开始快速翻译，共 ${totalBlocks} 个区块，并发数: ${batchSize}`);
    
    // 获取用户的翻译引擎偏好
    const userTranslationEngine = useUserPreferencesStore.getState().translationEngine;
    const userLLMModel = useUserPreferencesStore.getState().llmModel;
    
    // 带重试的翻译单个区块函数
    const translateBlockWithRetry = async (block: any, maxRetries: number = 3): Promise<void> => {
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // 使用 ref 获取最新状态
          const currentState = actionStateRef.current;
          
          // 跳过已翻译的区块
          if (currentState.translations.has(block.index)) {
            return;
          }
          
          // 对于LLM翻译，不使用原来的translateBlock方法（它是顺序流式的）
          // 直接在这里实现并发的非流式翻译
          if (userTranslationEngine === 'llm' || 
              block.type === 'table' || 
              block.type === 'image' || 
              block.type === 'interline_equation') {
            
            // 构建消息
            const contentType = block.type || 'text';
            const contentToTranslate = contentType === 'table' 
              ? (block.html_content || block.content)
              : block.content;
            
            // 检测语言
            let detectedLanguageInfo = null;
            let actualTargetLanguage = targetLanguage;
            if (isTextSuitableForDetection(contentToTranslate)) {
              detectedLanguageInfo = detectLanguageAndTarget(contentToTranslate);
              actualTargetLanguage = detectedLanguageInfo.targetLanguage;
            }
            
            let messages;
            // 对于图片类型，特殊处理
            if (contentType === 'image') {
              const imageInfo = extractImageInfo(contentToTranslate);
              if (imageInfo) {
                try {
                  const base64DataUrl = await LLMWrapper.imageUrlToDataUrl(imageInfo.url);
                  messages = buildMultimodalTranslateMessages(
                    contentType,
                    contentToTranslate,
                    base64DataUrl,
                    actualTargetLanguage,
                    detectedLanguageInfo?.detected,
                    detectedLanguageInfo ? {
                      sourceName: detectedLanguageInfo.sourceName,
                      targetName: detectedLanguageInfo.targetName,
                      confidence: detectedLanguageInfo.confidence
                    } : undefined
                  );
                } catch (error) {
                  console.error(`图片转换失败 (区块 ${block.index}):`, error);
                  throw error;
                }
              } else {
                messages = buildTranslateMessages(
                  contentType, 
                  contentToTranslate, 
                  actualTargetLanguage,
                  detectedLanguageInfo?.detected,
                  detectedLanguageInfo ? {
                    sourceName: detectedLanguageInfo.sourceName,
                    targetName: detectedLanguageInfo.targetName,
                    confidence: detectedLanguageInfo.confidence
                  } : undefined
                );
              }
            } else {
              messages = buildTranslateMessages(
                contentType, 
                contentToTranslate, 
                actualTargetLanguage,
                detectedLanguageInfo?.detected,
                detectedLanguageInfo ? {
                  sourceName: detectedLanguageInfo.sourceName,
                  targetName: detectedLanguageInfo.targetName,
                  confidence: detectedLanguageInfo.confidence
                } : undefined
              );
            }
            
            // 计算token限制
            const estimatedTokens = Math.min(8000, Math.max(1000, block.content.length * 4));
            
            // 直接调用LLM（非流式）
            const response = await llmWrapper.chat({
              messages,
              temperature: 0.3,
              maxTokens: estimatedTokens,
              model: userLLMModel || undefined
            });
            
            if (response && response.trim()) {
              // 保存翻译结果
              setActionState(prev => ({
                ...prev,
                translations: new Map(prev.translations).set(block.index, response)
              }));
              
              return; // 成功，退出重试循环
            } else {
              throw new Error('翻译结果为空');
            }
            
          } else {
            // 使用MT或原有的translateBlock方法
            await translateBlock(block.index, true);
            return; // 成功
          }
          
        } catch (error) {
          lastError = error as Error;
          console.warn(`区块 ${block.index} 翻译失败 (尝试 ${attempt}/${maxRetries}):`, error);
          
          if (attempt < maxRetries) {
            // 指数退避：第1次重试等1秒，第2次等2秒，第3次等4秒
            const delay = Math.pow(2, attempt - 1) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      // 所有重试都失败了
      console.error(`区块 ${block.index} 翻译最终失败:`, lastError);
      throw lastError;
    };
    
    // 使用并发控制器
    const concurrencyLimit = batchSize;
    const queue: any[] = [...sortedBlocks];
    const executing: Promise<void>[] = [];
    
    while (queue.length > 0 || executing.length > 0) {
      // 填充执行队列到并发限制
      while (executing.length < concurrencyLimit && queue.length > 0) {
        const block = queue.shift()!;
        
        const promise = translateBlockWithRetry(block)
          .then(() => {
            completedBlocks++;
            onProgress?.(completedBlocks, totalBlocks);
          })
          .catch((error) => {
            console.error(`区块 ${block.index} 翻译失败（跳过）:`, error);
            completedBlocks++;
            onProgress?.(completedBlocks, totalBlocks);
          })
          .finally(() => {
            // 从执行队列中移除
            const index = executing.indexOf(promise);
            if (index > -1) {
              executing.splice(index, 1);
            }
          });
        
        executing.push(promise);
      }
      
      // 等待至少一个任务完成
      if (executing.length > 0) {
        await Promise.race(executing);
      }
    }
    
    console.log('✅ 快速翻译完成');
  }, [enabled, blockData, targetLanguage, translateBlock, llmWrapper]);

  // 获取翻译内容
  const getTranslation = useCallback((blockIndex: number): string | null => {
    return actionState.translations.get(blockIndex) || null;
  }, [actionState.translations]);

  // 获取解释内容
  const getExplanation = useCallback((blockIndex: number): string | null => {
    return actionState.explanations.get(blockIndex) || null;
  }, [actionState.explanations]);

  return {
    // 状态
    actionState,
    streamingState,
    
    // 当前选中区块信息
    selectedBlock,
    hasTranslation,
    hasExplanation,
    
    // 操作方法
    translateBlock,
    explainBlock,
    translateAllBlocks,
    cancelAction,
    clearTranslation,
    clearExplanation,
    clearAllTranslations,
    clearAllExplanations,
    
    // 获取内容方法
    getTranslation,
    getExplanation
  };
};