/**
 * MT Translation Service
 * Provides fast machine translation for Chinese-English bidirectional translation
 */

import { useAuthStore } from '../store/authStore';

export type MTLanguage = 'zh' | 'en';

interface TranslationItem {
  index: number;
  text: string;
}

interface TranslationResult {
  index: number;
  translated_text: string | null;
}

interface BatchTranslateRequest {
  items: TranslationItem[];
  source_lang: MTLanguage;
  target_lang: MTLanguage;
}

interface BatchTranslateResponse {
  results: TranslationResult[];
  source_lang: string;
  target_lang: string;
  count: number;
  timestamp: string;
}

interface SimpleTranslateRequest {
  text: string;
  source_lang: MTLanguage;
  target_lang: MTLanguage;
}

interface SimpleTranslateResponse {
  translated_text: string;
  source_lang: string;
  target_lang: string;
}

interface LanguagesResponse {
  languages: Array<{
    code: string;
    name: string;
    native_name: string;
  }>;
  default_source: string;
  default_target: string;
  supported_pairs: Array<{
    source: string;
    target: string;
    description: string;
  }>;
}

class MTTranslationService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';
  }

  /**
   * Get authentication headers
   */
  private getAuthHeaders(): HeadersInit {
    const token = useAuthStore.getState().token;
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  /**
   * Check if a language pair is supported by MT
   */
  isSupportedLanguagePair(sourceLang: string, targetLang: string): boolean {
    // MT only supports Chinese-English bidirectional translation
    const validPairs = [
      ['zh', 'en'],
      ['en', 'zh'],
      ['cmn', 'en'], // franc-min uses 'cmn' for Chinese
      ['en', 'cmn'],
      ['eng', 'zh'], // franc-min uses 'eng' for English
      ['zh', 'eng'],
    ];
    
    return validPairs.some(
      ([src, tgt]) => 
        (sourceLang === src && targetLang === tgt) ||
        (sourceLang === tgt && targetLang === src)
    );
  }

  /**
   * Normalize language code to MT format
   */
  private normalizeLangCode(lang: string): MTLanguage {
    // Map various language codes to MT format
    const mapping: Record<string, MTLanguage> = {
      'cmn': 'zh',  // franc-min Chinese
      'eng': 'en',  // franc-min English
      'zh': 'zh',
      'en': 'en',
      'chinese': 'zh',
      'english': 'en',
      '中文': 'zh',
      '英文': 'en',
    };
    
    const normalized = mapping[lang.toLowerCase()];
    if (!normalized) {
      throw new Error(`Unsupported language: ${lang}`);
    }
    
    return normalized;
  }

  /**
   * Translate a single text
   */
  async translateText(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<string> {
    try {
      // Normalize language codes
      const normalizedSource = this.normalizeLangCode(sourceLang);
      const normalizedTarget = this.normalizeLangCode(targetLang);
      
      // Check if language pair is supported
      if (!this.isSupportedLanguagePair(normalizedSource, normalizedTarget)) {
        throw new Error(
          `Language pair not supported by MT: ${sourceLang} → ${targetLang}. ` +
          `MT only supports Chinese-English translation.`
        );
      }
      
      const request: SimpleTranslateRequest = {
        text,
        source_lang: normalizedSource,
        target_lang: normalizedTarget,
      };
      
      const response = await fetch(`${this.baseUrl}/api/mt/translate`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(request),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `MT translation failed: ${response.status}`);
      }
      
      const data: SimpleTranslateResponse = await response.json();
      return data.translated_text;
      
    } catch (error) {
      console.error('[MTTranslation] Translation error:', error);
      throw error;
    }
  }

  /**
   * Batch translate multiple texts with index tracking
   */
  async batchTranslate(
    items: Array<{ index: number; text: string }>,
    sourceLang: string,
    targetLang: string
  ): Promise<Map<number, string>> {
    try {
      // Normalize language codes
      const normalizedSource = this.normalizeLangCode(sourceLang);
      const normalizedTarget = this.normalizeLangCode(targetLang);
      
      // Check if language pair is supported
      if (!this.isSupportedLanguagePair(normalizedSource, normalizedTarget)) {
        throw new Error(
          `Language pair not supported by MT: ${sourceLang} → ${targetLang}. ` +
          `MT only supports Chinese-English translation.`
        );
      }
      
      const request: BatchTranslateRequest = {
        items,
        source_lang: normalizedSource,
        target_lang: normalizedTarget,
      };
      
      const response = await fetch(`${this.baseUrl}/api/mt/translate/batch`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(request),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `MT batch translation failed: ${response.status}`);
      }
      
      const data: BatchTranslateResponse = await response.json();
      
      // Convert results to Map for easy lookup
      const resultMap = new Map<number, string>();
      data.results.forEach((result) => {
        if (result.translated_text) {
          resultMap.set(result.index, result.translated_text);
        }
      });
      
      return resultMap;
      
    } catch (error) {
      console.error('[MTTranslation] Batch translation error:', error);
      throw error;
    }
  }

  /**
   * Get supported languages
   */
  async getSupportedLanguages(): Promise<LanguagesResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/mt/languages`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `Failed to get languages: ${response.status}`);
      }
      
      return await response.json();
      
    } catch (error) {
      console.error('[MTTranslation] Get languages error:', error);
      // Return default supported languages on error
      return {
        languages: [
          { code: 'zh', name: 'Chinese', native_name: '中文' },
          { code: 'en', name: 'English', native_name: 'English' },
        ],
        default_source: 'en',
        default_target: 'zh',
        supported_pairs: [
          { source: 'zh', target: 'en', description: 'Chinese to English' },
          { source: 'en', target: 'zh', description: 'English to Chinese' },
        ],
      };
    }
  }

  /**
   * Check MT service health
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/mt/health`, {
        method: 'GET',
      });
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      return data.status === 'healthy' && data.service_available;
      
    } catch (error) {
      console.error('[MTTranslation] Health check error:', error);
      return false;
    }
  }
}

// Export singleton instance
export const mtTranslationService = new MTTranslationService();

// Export type
export type { MTTranslationService };