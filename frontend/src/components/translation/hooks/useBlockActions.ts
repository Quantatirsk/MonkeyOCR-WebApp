/**
 * useBlockActions Hook
 * 管理区块翻译和解释操作的状态和逻辑
 */

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { llmWrapper } from '../../../lib/llmwrapper';
import { buildTranslateMessages, buildExplainMessages } from '../prompts';
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
    isProcessing: false,
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
    error: null
  });

  // Refs for avoiding stale closures and managing abort controller
  const actionStateRef = useRef(actionState);
  const streamingStateRef = useRef(streamingState);
  const abortControllerRef = useRef<AbortController | null>(null);
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
    // 清空之前的内容并开始新的流
    setStreamingState({
      isStreaming: true,
      streamContent: '',
      streamType,
      error: null
    });

    let reader: ReadableStreamDefaultReader<string> | null = null;
    let accumulated = '';
    
    try {
      reader = stream.getReader();
      let isStreamComplete = false;

      while (true) {
        // 检查是否被取消
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('操作已取消');
        }
        
        const { done, value } = await reader.read();
        
        if (done) {
          isStreamComplete = true;
          break;
        }
        
        // 累积内容
        accumulated += value;
        
        // 实时更新流式内容 - 使用函数式更新确保获取最新状态
        setStreamingState(prev => ({
          ...prev,
          streamContent: accumulated,
          isStreaming: true,
          streamType
        }));
      }

      // 检查是否被取消
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('操作已取消');
      }

      // 完成处理
      if (isStreamComplete && accumulated.trim()) {
        onComplete(accumulated);
        
        setStreamingState(prev => ({
          ...prev,
          isStreaming: false,
          streamContent: '',
          streamType: null
        }));

        // 触发完成回调
        onActionComplete?.(blockIndex, streamType, accumulated);
      }
      
    } catch (error) {
      console.error(`${streamType} streaming error:`, error);
      const errorMessage = error instanceof Error ? error.message : '处理失败';
      
      // 如果是取消操作，不显示错误提示
      if (!errorMessage.includes('取消')) {
        setStreamingState(prev => ({
          ...prev,
          isStreaming: false,
          streamContent: '',
          streamType: null,
          error: errorMessage
        }));

        // 触发错误回调
        onActionError?.(blockIndex, streamType, errorMessage);
        
        toast.error(`${streamType === 'translate' ? '翻译' : '解释'}失败: ${errorMessage}`);
      } else {
        // 取消操作，清理状态
        setStreamingState(prev => ({
          ...prev,
          isStreaming: false,
          streamContent: '',
          streamType: null,
          error: null
        }));
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
      
      // 清理abort controller
      abortControllerRef.current = null;
    }
  }, [onActionComplete, onActionError]);

  // 翻译区块
  const translateBlock = useCallback(async (blockIndex: number, force: boolean = false) => {
    if (!enabled || actionState.isProcessing) return;

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
    abortControllerRef.current = abortController;

    // 更新状态
    setActionState(prev => ({
      ...prev,
      selectedBlockIndex: blockIndex,
      actionMode: 'translate',
      isProcessing: true
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

      // 使用专用的提示词系统构建消息（支持语言检测）
      const messages = buildTranslateMessages(
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
          actionMode: 'idle',
          isProcessing: false
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
        isProcessing: false
      }));

      onActionError?.(blockIndex, 'translate', errorMessage);
      toast.error(`翻译失败: ${errorMessage}`, { duration: 1000 });
    }
  }, [enabled, actionState.isProcessing, actionState.translations, blockData, targetLanguage, onActionStart, llmWrapper, handleStreamingResponse]);

  // 解释区块
  const explainBlock = useCallback(async (blockIndex: number, force: boolean = false) => {
    if (!enabled || actionState.isProcessing) return;

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
    abortControllerRef.current = abortController;

    // 更新状态
    setActionState(prev => ({
      ...prev,
      selectedBlockIndex: blockIndex,
      actionMode: 'explain',
      isProcessing: true,
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

      // 使用专用的提示词系统构建消息
      const messages = buildExplainMessages(contentType, contentToExplain);

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
          isProcessing: false
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
  }, [enabled, actionState.isProcessing, blockData, onActionStart, llmWrapper, handleStreamingResponse]);

  // 取消操作
  const cancelAction = useCallback(() => {
    if (streamingState.isStreaming && abortControllerRef.current) {
      console.log('Canceling streaming request...');
      // 使用 AbortController 取消流式请求
      abortControllerRef.current.abort();
    }

    setActionState(prev => ({
      ...prev,
      actionMode: 'idle',
      isProcessing: false
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