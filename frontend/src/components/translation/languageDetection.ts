/**
 * 自动语言检测功能
 * 基于 franc-min 实现智能双语翻译逻辑
 */

import { franc } from 'franc-min';

// 语言代码映射
export const LANGUAGE_CODES = {
  CHINESE: 'cmn',     // franc-min 中的中文代码
  ENGLISH: 'eng',     // franc-min 中的英文代码
  UNDEFINED: 'und'    // 未检测到语言
} as const;

// 语言名称映射
export const LANGUAGE_NAMES = {
  zh: '中文',
  en: '英文',
  auto: '自动检测'
} as const;

export type SupportedLanguage = 'zh' | 'en';
export type TranslationEngine = 'mt' | 'llm';
export type DetectionResult = {
  detected: string;
  confidence: 'high' | 'medium' | 'low';
  targetLanguage: SupportedLanguage;
  sourceName: string;
  targetName: string;
  recommendedEngine?: TranslationEngine;
};

/**
 * 检测文本语言并确定翻译目标语言
 * 逻辑：中文 -> 英文，非中文 -> 中文
 */
export function detectLanguageAndTarget(text: string): DetectionResult {
  // 预处理文本：移除HTML标签，保留纯文本用于检测
  const cleanText = cleanTextForDetection(text);
  
  // 如果文本太短，使用启发式检测
  if (cleanText.length < 10) {
    return heuristicDetection(cleanText);
  }
  
  // 使用 franc-min 检测语言
  const detected = franc(cleanText);
  
  console.log('🔍 语言检测结果:', { 
    original: text.substring(0, 100) + '...', 
    cleaned: cleanText.substring(0, 100) + '...', 
    detected,
    length: cleanText.length 
  });
  
  // 根据检测结果确定翻译方向
  if (detected === LANGUAGE_CODES.CHINESE || isChinese(cleanText)) {
    return {
      detected: 'cmn',
      confidence: 'high',
      targetLanguage: 'en',
      sourceName: '中文',
      targetName: '英文',
      recommendedEngine: 'mt' // 中英互译推荐使用MT
    };
  } else if (detected === LANGUAGE_CODES.ENGLISH || detected === LANGUAGE_CODES.UNDEFINED) {
    // 英文或未检测到语言时，翻译为中文
    return {
      detected: detected || 'eng',
      confidence: detected === LANGUAGE_CODES.ENGLISH ? 'high' : 'medium',
      targetLanguage: 'zh',
      sourceName: '英文',
      targetName: '中文',
      recommendedEngine: detected === LANGUAGE_CODES.ENGLISH ? 'mt' : 'llm' // 英文->中文用MT，未知语言用LLM
    };
  } else {
    // 其他语言翻译为中文，必须使用LLM
    return {
      detected,
      confidence: 'medium',
      targetLanguage: 'zh',
      sourceName: '其他语言',
      targetName: '中文',
      recommendedEngine: 'llm' // 其他语言只能用LLM
    };
  }
}

/**
 * 清理文本用于语言检测
 * 移除HTML标签、特殊字符，保留纯文本
 */
function cleanTextForDetection(text: string): string {
  return text
    // 移除HTML标签
    .replace(/<[^>]*>/g, ' ')
    // 移除LaTeX公式
    .replace(/\$[^$]*\$/g, ' ')
    .replace(/\$\$[^$]*\$\$/g, ' ')
    // 移除多余空白字符
    .replace(/\s+/g, ' ')
    // 移除特殊符号，但保留基本标点
    .replace(/[^\w\s\u4e00-\u9fff\u3400-\u4dbf\u20000-\u2a6df\u2a700-\u2b73f\u2b740-\u2b81f\u2b820-\u2ceaf\uf900-\ufaff\u3300-\u33ff\ufe30-\ufe4f\uf900-\ufaff\u2e80-\u2eff.,!?;:]/g, ' ')
    .trim();
}

/**
 * 启发式中文检测
 * 用于短文本或franc检测失败时的备选方案
 */
function isChinese(text: string): boolean {
  // 检测中文字符的比例
  const chineseChars = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || [];
  const totalChars = text.replace(/\s/g, '').length;
  
  if (totalChars === 0) return false;
  
  const chineseRatio = chineseChars.length / totalChars;
  console.log('🈚 中文字符检测:', { chineseChars: chineseChars.length, totalChars, ratio: chineseRatio });
  
  // 如果中文字符占比超过30%，认为是中文
  return chineseRatio > 0.3;
}

/**
 * 启发式语言检测
 * 用于短文本的语言检测
 */
function heuristicDetection(text: string): DetectionResult {
  if (isChinese(text)) {
    return {
      detected: 'cmn',
      confidence: 'medium',
      targetLanguage: 'en',
      sourceName: '中文',
      targetName: '英文',
      recommendedEngine: 'mt' // 中英互译推荐MT
    };
  } else {
    // 默认认为是英文或其他非中文语言
    return {
      detected: 'eng',
      confidence: 'low',
      targetLanguage: 'zh',
      sourceName: '英文',
      targetName: '中文',
      recommendedEngine: 'mt' // 假设是英文，推荐MT
    };
  }
}

/**
 * 获取语言的显示名称
 */
export function getLanguageDisplayName(code: SupportedLanguage): string {
  return LANGUAGE_NAMES[code] || code;
}

/**
 * 验证文本是否适合语言检测
 */
export function isTextSuitableForDetection(text: string): boolean {
  const cleanText = cleanTextForDetection(text);
  return cleanText.length >= 3; // 至少3个字符才能进行可靠检测
}

/**
 * 检查语言对是否被MT支持
 * MT只支持中英互译
 */
export function isSupportedByMT(sourceLang: string, targetLang: string): boolean {
  // 标准化语言代码
  const normalizeLanguage = (lang: string): 'zh' | 'en' | 'other' => {
    if (lang === 'zh' || lang === 'cmn' || lang === 'chi' || lang === 'zho') {
      return 'zh';
    }
    if (lang === 'en' || lang === 'eng') {
      return 'en';
    }
    return 'other';
  };
  
  const normalizedSource = normalizeLanguage(sourceLang);
  const normalizedTarget = normalizeLanguage(targetLang);
  
  // MT支持中英互译
  return (
    (normalizedSource === 'zh' && normalizedTarget === 'en') ||
    (normalizedSource === 'en' && normalizedTarget === 'zh')
  );
}


/**
 * 根据语言检测结果和用户偏好决定使用哪个翻译引擎
 * 注意：这个函数不再检查内容类型，内容类型的判断应该在调用方基于 block.type 进行
 */
export function selectTranslationEngine(
  detectionResult: DetectionResult,
  userPreference: TranslationEngine
): { engine: TranslationEngine; reason?: string } {
  const { detected, targetLanguage, recommendedEngine } = detectionResult;
  
  // 如果用户选择LLM，总是使用LLM
  if (userPreference === 'llm') {
    return { engine: 'llm', reason: '用户偏好设置' };
  }
  
  // 如果用户选择MT，但语言不支持，fallback到LLM
  if (userPreference === 'mt') {
    if (recommendedEngine === 'mt' && isSupportedByMT(detected, targetLanguage)) {
      return { engine: 'mt' };
    } else {
      return { 
        engine: 'llm', 
        reason: `MT不支持此语言对，自动切换到LLM翻译` 
      };
    }
  }
  
  // 默认使用推荐的引擎
  return { engine: recommendedEngine || 'llm' };
}