/**
 * User Preferences Store
 * Manages user translation preferences and settings
 */

import { createWithEqualityFn } from 'zustand/traditional';
import { persist, createJSONStorage } from 'zustand/middleware';

export type TranslationEngine = 'mt' | 'llm';
export type PreferredLanguage = 'zh' | 'en' | 'auto';

interface UserPreferencesState {
  // Translation settings
  translationEngine: TranslationEngine;
  llmModel: string | null;
  preferredLanguage: PreferredLanguage;
  
  // Actions
  setTranslationEngine: (engine: TranslationEngine) => void;
  setLLMModel: (model: string | null) => void;
  setPreferredLanguage: (language: PreferredLanguage) => void;
  resetToDefaults: () => void;
}

const defaultState = {
  translationEngine: 'mt' as TranslationEngine,
  llmModel: null,
  preferredLanguage: 'auto' as PreferredLanguage,
};

export const useUserPreferencesStore = createWithEqualityFn<UserPreferencesState>()(
  persist(
    (set) => ({
      // Initial state
      ...defaultState,
      
      // Actions
      setTranslationEngine: (engine) => {
        set({ translationEngine: engine });
        console.log('[UserPreferences] Translation engine set to:', engine);
      },
      
      setLLMModel: (model) => {
        set({ llmModel: model });
        console.log('[UserPreferences] LLM model set to:', model);
      },
      
      setPreferredLanguage: (language) => {
        set({ preferredLanguage: language });
        console.log('[UserPreferences] Preferred language set to:', language);
      },
      
      resetToDefaults: () => {
        set(defaultState);
        console.log('[UserPreferences] Reset to defaults');
      },
    }),
    {
      name: 'monkeyocr-user-preferences',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);

// Utility hooks
export const useTranslationEngine = () => 
  useUserPreferencesStore((state) => state.translationEngine);

export const useLLMModel = () => 
  useUserPreferencesStore((state) => state.llmModel);

export const usePreferredLanguage = () => 
  useUserPreferencesStore((state) => state.preferredLanguage);