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
import { detectLanguageAndTarget, isTextSuitableForDetection } from '../languageDetection';
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
        
        // 显示语言检测结果（合并开始提示）
        toast.info(`检测到${detectedLanguageInfo.sourceName}，正在翻译为${detectedLanguageInfo.targetName}...`, { 
          duration: 2000 
        });
        
        console.log('🌐 语言检测结果:', detectedLanguageInfo);
      } else {
        // 文本太短，显示默认翻译提示
        console.log('⚠️ 文本过短，使用默认翻译方向:', targetLanguage);
        toast.info('正在翻译选中区块...', { duration: 1500 });
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

      // 发起流式翻译请求
      const stream = await llmWrapper.streamChat({
        messages,
        temperature: 0.3,
        maxTokens: block.content.length * 2
      });

      // 处理流式响应
      await handleStreamingResponse(stream, 'translate', blockIndex, (translatedContent) => {
        // 保存翻译结果
        setActionState(prev => ({
          ...prev,
          translations: new Map(prev.translations).set(blockIndex, translatedContent),
          actionMode: 'idle'
        }));
        
        // 显示成功提示
        toast.success('翻译完成', { duration: 1000 });
      });

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
    
    // 显示开始提示
    toast.info('正在生成解释...', { duration: 1000 });

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
        
        // 显示成功提示
        toast.success('解释生成完成', { duration: 1000 });
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

    toast.info('操作已取消', { duration: 1000 });
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
  
  // 全文翻译功能
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
    
    console.log(`🌍 开始全文翻译，共 ${totalBlocks} 个区块，每批 ${batchSize} 个`);
    toast.info(`开始全文翻译 (共${totalBlocks}个区块)`, { duration: 2000 });
    
    // 分批处理
    for (let i = 0; i < sortedBlocks.length; i += batchSize) {
      const batch = sortedBlocks.slice(i, Math.min(i + batchSize, sortedBlocks.length));
      console.log(`📦 处理第 ${Math.floor(i/batchSize) + 1} 批，包含 ${batch.length} 个区块`);
      
      // 并行处理当前批次的区块
      const batchPromises = batch.map(async (block) => {
        try {
          // 使用 ref 获取最新状态，避免闭包问题
          const currentState = actionStateRef.current;
          
          // 跳过已翻译的区块
          if (currentState.translations.has(block.index)) {
            completedBlocks++;
            onProgress?.(completedBlocks, totalBlocks);
            return;
          }
          
          // 调用单个区块的翻译方法
          await translateBlock(block.index, true);
          completedBlocks++;
          onProgress?.(completedBlocks, totalBlocks);
          
        } catch (error) {
          console.error(`区块 ${block.index} 翻译失败:`, error);
          completedBlocks++;
          onProgress?.(completedBlocks, totalBlocks);
        }
      });
      
      // 等待当前批次完成
      await Promise.allSettled(batchPromises);
      
      // 批次间短暂延迟，避免请求过于密集
      if (i + batchSize < sortedBlocks.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log('✅ 全文翻译完成');
    toast.success('全文翻译完成', { duration: 2000 });
  }, [enabled, blockData, translateBlock]);

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