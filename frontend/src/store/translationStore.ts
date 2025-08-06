/**
 * Translation Store using Zustand
 * Manages translation state and actions for the MonkeyOCR WebApp
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  TranslationState,
  TranslationActions,
  TranslationJob,
  CachedTranslation,
  TranslationOptions,
  TranslationBlock,
  BlockTranslationResult
} from '../types/translation';
import { llmWrapper } from '../lib/llmwrapper';

// Helper function to generate content hash for caching
const generateContentHash = (content: string, options: TranslationOptions): string => {
  return btoa(
    `${content}_${options.source_language}_${options.target_language}_${options.translation_style}`
  ).replace(/[+/=]/g, '');
};

interface TranslationStore extends TranslationState, TranslationActions {}

export const useTranslationStore = create<TranslationStore>()(
  persist(
    (set, get) => ({
      // State
      activeTranslations: new Map<string, TranslationJob>(),
      translationCache: new Map<string, CachedTranslation>(),
      selectedSourceLanguage: 'auto',
      selectedTargetLanguage: 'en',
      translationStyle: 'accurate',
      autoTranslate: false,
      showOriginalText: false,
      hoveredBlockId: null,
      hoverMenuVisible: false,
      hoverMenuPosition: { x: 0, y: 0 },

      // Actions
      translateBlock: async (taskId, blockId, content, options) => {
        try {
          const contentHash = generateContentHash(content, options);
          
          // Check cache first
          const cached = get().getFromCache(contentHash);
          if (cached && cached.expiresAt > new Date()) {
            return cached.translatedContent;
          }

          // Translate using LLM wrapper
          const result = await llmWrapper.translateBlock(
            content,
            options.source_language,
            options.target_language,
            options.translation_style
          );

          if (result.status === 'completed') {
            // Add to cache
            get().addToCache(contentHash, {
              originalContent: content,
              translatedContent: result.translation,
              sourceLanguage: options.source_language,
              targetLanguage: options.target_language,
              translationStyle: options.translation_style,
              cachedAt: new Date(),
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
            });

            return result.translation;
          } else {
            throw new Error(result.error || 'Translation failed');
          }
        } catch (error) {
          console.error('Block translation error:', error);
          throw error;
        }
      },

      explainBlock: async (taskId, blockId, content, language = 'en') => {
        try {
          const result = await llmWrapper.explainText(content, language);
          return typeof result === 'string' ? result : '';
        } catch (error) {
          console.error('Block explanation error:', error);
          throw error;
        }
      },

      translateDocument: async (taskId, blocks, options) => {
        try {
          const result = await llmWrapper.translateDocument(blocks, {
            source_language: options.source_language,
            target_language: options.target_language,
            preserve_formatting: options.preserve_formatting,
            translation_style: options.translation_style
          });

          // Create translation job
          const translationJob: TranslationJob = {
            id: result.translation_id,
            taskId,
            translationId: result.translation_id,
            status: 'pending',
            progress: 0,
            results: new Map(),
            createdAt: new Date()
          };

          // Add to active translations
          set((state) => ({
            activeTranslations: new Map(state.activeTranslations).set(taskId, translationJob)
          }));

          return result.translation_id;
        } catch (error) {
          console.error('Document translation error:', error);
          throw error;
        }
      },

      pollTranslationStatus: async (translationId) => {
        try {
          return await llmWrapper.getTranslationStatus(translationId);
        } catch (error) {
          console.error('Translation status polling error:', error);
          throw error;
        }
      },

      getTranslationResult: async (translationId) => {
        try {
          return await llmWrapper.getTranslationResult(translationId);
        } catch (error) {
          console.error('Translation result retrieval error:', error);
          throw error;
        }
      },

      cancelTranslation: async (translationId) => {
        try {
          // Remove from active translations
          const state = get();
          const newActiveTranslations = new Map(state.activeTranslations);
          
          for (const [taskId, job] of newActiveTranslations.entries()) {
            if (job.translationId === translationId) {
              newActiveTranslations.delete(taskId);
              break;
            }
          }

          set({ activeTranslations: newActiveTranslations });

          // Clean up backend resources
          await llmWrapper.deleteTranslationResult(translationId);
        } catch (error) {
          console.error('Translation cancellation error:', error);
          throw error;
        }
      },

      // UI state management
      setLanguages: (source, target) => {
        set({
          selectedSourceLanguage: source,
          selectedTargetLanguage: target
        });
      },

      setTranslationStyle: (style) => {
        set({ translationStyle: style });
      },

      setHoverState: (blockId, visible, position) => {
        set({
          hoveredBlockId: blockId,
          hoverMenuVisible: visible,
          hoverMenuPosition: position || get().hoverMenuPosition
        });
      },

      toggleAutoTranslate: () => {
        set((state) => ({ autoTranslate: !state.autoTranslate }));
      },

      toggleShowOriginal: () => {
        set((state) => ({ showOriginalText: !state.showOriginalText }));
      },

      // Cache management
      clearTranslationCache: () => {
        set({ translationCache: new Map() });
      },

      getFromCache: (contentHash) => {
        const cache = get().translationCache;
        const cached = cache.get(contentHash);
        
        if (cached && cached.expiresAt > new Date()) {
          return cached;
        } else if (cached) {
          // Remove expired entry
          const newCache = new Map(cache);
          newCache.delete(contentHash);
          set({ translationCache: newCache });
        }
        
        return null;
      },

      addToCache: (contentHash, translation) => {
        set((state) => ({
          translationCache: new Map(state.translationCache).set(contentHash, translation)
        }));
      }
    }),
    {
      name: 'translation-store',
      // Only persist UI preferences, not active translations or cache
      partialize: (state) => ({
        selectedSourceLanguage: state.selectedSourceLanguage,
        selectedTargetLanguage: state.selectedTargetLanguage,
        translationStyle: state.translationStyle,
        autoTranslate: state.autoTranslate,
        showOriginalText: state.showOriginalText
      })
    }
  )
);

// Helper hooks for easier access to specific parts of the store
export const useTranslationState = () => {
  return useTranslationStore((state) => ({
    selectedSourceLanguage: state.selectedSourceLanguage,
    selectedTargetLanguage: state.selectedTargetLanguage,
    translationStyle: state.translationStyle,
    autoTranslate: state.autoTranslate,
    showOriginalText: state.showOriginalText,
    hoveredBlockId: state.hoveredBlockId,
    hoverMenuVisible: state.hoverMenuVisible,
    hoverMenuPosition: state.hoverMenuPosition,
    activeTranslations: state.activeTranslations
  }));
};

export const useTranslationActions = () => {
  return useTranslationStore((state) => ({
    translateBlock: state.translateBlock,
    explainBlock: state.explainBlock,
    translateDocument: state.translateDocument,
    pollTranslationStatus: state.pollTranslationStatus,
    getTranslationResult: state.getTranslationResult,
    cancelTranslation: state.cancelTranslation,
    setLanguages: state.setLanguages,
    setTranslationStyle: state.setTranslationStyle,
    setHoverState: state.setHoverState,
    toggleAutoTranslate: state.toggleAutoTranslate,
    toggleShowOriginal: state.toggleShowOriginal,
    clearTranslationCache: state.clearTranslationCache,
    getFromCache: state.getFromCache,
    addToCache: state.addToCache
  }));
};