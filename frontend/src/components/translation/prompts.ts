/**
 * 专门为不同类型区块设计的翻译和分析提示词系统
 * 减少提示词干扰，提高翻译和分析质量
 */

import type { MessageContent } from '../../lib/llmwrapper';

export interface PromptConfig {
  systemPrompt: string;
  userPromptTemplate: (content: string) => string;
}

export interface BlockPrompts {
  translate: PromptConfig;
  explain: PromptConfig;
}

/**
 * 标题类区块专用提示词
 */
const TITLE_PROMPTS: BlockPrompts = {
  translate: {
    systemPrompt: `你是专业的标题翻译专家。专注于翻译标题内容，保持简洁明了的风格。
要求：
- 准确传达标题的核心含义
- 保持简洁，避免冗余表达
- 符合目标语言的标题表达习惯
- 保持原有的语调和重要性级别`,
    userPromptTemplate: (content: string) => `请翻译以下标题：\n\n${content}`
  },
  explain: {
    systemPrompt: `你是知识渊博的标题解释专家。专注于解释标题的含义和背景。
要求：
- 解释标题的核心主题和含义
- 提供相关的背景信息和重要性
- 说明标题在文档中的作用和地位
- 用中文回答，条理清晰`,
    userPromptTemplate: (content: string) => `请解释以下标题的含义和背景：\n\n${content}`
  }
};

/**
 * 表格类区块专用提示词
 */
const TABLE_PROMPTS: BlockPrompts = {
  translate: {
    systemPrompt: `你是专业的表格翻译专家。专注于翻译HTML表格中的文字内容。

严格要求：
- 绝对不能修改任何HTML标签：<table>, <thead>, <tbody>, <tr>, <th>, <td> 等
- 绝对不能修改任何HTML属性或结构
- 只能翻译标签内的文字内容，保持所有HTML标记原样输出
- 确保输出的是完整有效的HTML表格代码
- 每个单元格的内容必须准确对应翻译
- 保持表格的行列结构完全一致

重要：输出必须是可直接在网页中渲染的HTML表格！`,
    userPromptTemplate: (content: string) => `请严格按要求翻译以下HTML表格，只翻译文字内容，保持所有HTML标签和结构不变：\n\n${content}\n\n注意：必须输出完整的HTML表格代码！`
  },
  explain: {
    systemPrompt: `你是专业的表格数据分析专家。专注于分析HTML表格的数据含义。
要求：
- 分析表格的整体结构和逻辑
- 解释表格中的关键数据和趋势
- 说明表格的作用和重要信息点
- 用中文回答，条理清晰`,
    userPromptTemplate: (content: string) => `请分析以下HTML表格的数据含义和重要信息：\n\n${content}`
  }
};

/**
 * 图片类区块专用提示词（支持多模态）
 */
const IMAGE_PROMPTS: BlockPrompts = {
  translate: {
    systemPrompt: `你是专业的视觉内容翻译专家，具备强大的图像理解和跨语言描述能力。

核心任务：直接分析图片内容，用目标语言生成准确、详细的描述


图片分析要求：
- 识别图片中的所有重要元素（文字、物体、人物、场景等）
- 翻译图片中出现的任何文字内容
- 描述图片的布局、颜色、构图等视觉特征
- 识别并说明图表、流程图、架构图等专业内容
- 保持专业术语的准确性

输出格式：
- 先概述图片主要内容
- 详细描述各个组成部分
- 如有文字内容，提供准确翻译
- 说明图片传达的核心信息`,
    userPromptTemplate: (content: string) => `请分析并用中文描述以下内容：\n\n${content}`
  },
  explain: {
    systemPrompt: `你是专业的视觉内容分析专家，擅长深度解读图像信息并提供专业见解。

核心任务：深入分析图片内容，提供专业解释和背景信息

图片分析维度：
- 内容识别：图片中的所有重要元素（文字、物体、人物、场景等）
- 专业解读：解释技术图表、流程图、架构图、数据可视化等
- 背景知识：提供相关领域的专业知识和概念解释
- 关联分析：说明图片在文档中的作用和重要性
- 深层含义：挖掘图片传达的隐含信息和价值

输出要求：
- 用中文回答，条理清晰
- 提供专业、准确的解释
- 包含必要的背景知识
- 指出关键信息和重要细节
- 如果是技术内容，解释相关概念和原理`,
    userPromptTemplate: (content: string) => `请深入分析和解释以下内容：\n\n${content}`
  }
};

/**
 * 文本类区块专用提示词（默认类型）
 */
const TEXT_PROMPTS: BlockPrompts = {
  translate: {
    systemPrompt: `你是专业的文本翻译专家。专注于翻译段落和文本内容。
要求：
- 保持原文的格式和结构
- 确保翻译准确、流畅、自然
- 维持原文的语调和表达风格
- 保持段落结构和标点符号的合理使用`,
    userPromptTemplate: (content: string) => `请翻译以下文本内容：\n\n${content}\n\n 直接返回翻译结果：`
  },
  explain: {
    systemPrompt: `你是知识渊博的文本内容解释专家。专注于解释文本的含义。
要求：
- 详细解释文本的核心含义
- 提供相关的背景信息和概念
- 分析文本的重要观点和论述`,
    userPromptTemplate: (content: string) => `请解释以下文本的含义：\n\n${content}\n\n 直接返回解释内容：`
  }
};

/**
 * 根据区块类型获取相应的提示词配置
 */
export function getBlockPrompts(blockType: string): BlockPrompts {
  switch (blockType) {
    case 'title':
      return TITLE_PROMPTS;
    case 'table':
      return TABLE_PROMPTS;
    case 'image':
      return IMAGE_PROMPTS;
    case 'text':
    default:
      return TEXT_PROMPTS;
  }
}

/**
 * 构建翻译消息数组（支持自动语言检测）
 */
export function buildTranslateMessages(
  blockType: string, 
  content: string, 
  targetLanguage: string = 'zh',
  _sourceLanguage?: string,
  detectionInfo?: { sourceName: string; targetName: string; confidence: string }
): Array<{ role: 'system' | 'user'; content: string }> {
  const prompts = getBlockPrompts(blockType);
  
  // 根据目标语言调整系统提示词
  let systemPrompt = prompts.translate.systemPrompt;
  
  // 添加语言检测信息到系统提示词
  if (detectionInfo) {
    const confidenceText = detectionInfo.confidence === 'high' ? '高置信度' : 
                          detectionInfo.confidence === 'medium' ? '中等置信度' : '低置信度';
    
    systemPrompt += `\n\n语言检测信息：检测到源语言为${detectionInfo.sourceName}（${confidenceText}），请翻译为${detectionInfo.targetName}。`;
  }
  
  // 动态调整翻译方向的系统提示词
  if (targetLanguage === 'zh') {
    systemPrompt = systemPrompt.replace(/翻译成[^。]*/g, '翻译成中文');
  } else if (targetLanguage === 'en') {
    systemPrompt = systemPrompt.replace(/翻译成[^。]*/g, '翻译成英文');
  } else {
    systemPrompt = systemPrompt.replace(/翻译成[^。]*/g, `翻译成${getLanguageName(targetLanguage)}`);
  }
  
  return [
    {
      role: 'system',
      content: systemPrompt
    },
    {
      role: 'user',
      content: prompts.translate.userPromptTemplate(content)
    }
  ];
}

/**
 * 构建解释消息数组
 */
export function buildExplainMessages(
  blockType: string, 
  content: string
): Array<{ role: 'system' | 'user'; content: string }> {
  const prompts = getBlockPrompts(blockType);
  
  return [
    {
      role: 'system',
      content: prompts.explain.systemPrompt
    },
    {
      role: 'user',
      content: prompts.explain.userPromptTemplate(content)
    }
  ];
}

/**
 * 构建多模态翻译消息（支持图片）
 */
export function buildMultimodalTranslateMessages(
  blockType: string,
  textContent: string,
  imageUrl: string | null,
  targetLanguage: string = 'zh',
  _sourceLanguage?: string,
  detectionInfo?: { sourceName: string; targetName: string; confidence: string }
): Array<{ role: 'system' | 'user'; content: string | MessageContent[] }> {
  const prompts = getBlockPrompts(blockType);
  
  // 根据目标语言调整系统提示词
  let systemPrompt = prompts.translate.systemPrompt;
  
  // 添加语言检测信息到系统提示词
  if (detectionInfo) {
    const confidenceText = detectionInfo.confidence === 'high' ? '高置信度' : 
                          detectionInfo.confidence === 'medium' ? '中等置信度' : '低置信度';
    
    systemPrompt += `\n\n语言检测信息：检测到源语言为${detectionInfo.sourceName}（${confidenceText}），请翻译为${detectionInfo.targetName}。`;
  }
  
  // 动态调整翻译方向的系统提示词
  if (targetLanguage === 'zh') {
    systemPrompt = systemPrompt.replace(/翻译成[^。]*/g, '翻译成中文');
  } else if (targetLanguage === 'en') {
    systemPrompt = systemPrompt.replace(/翻译成[^。]*/g, '翻译成英文');
  } else {
    systemPrompt = systemPrompt.replace(/翻译成[^。]*/g, `翻译成${getLanguageName(targetLanguage)}`);
  }
  
  // 如果有图片URL且是图片类型，构建多模态消息
  if (imageUrl && blockType === 'image') {
    const userContent: MessageContent[] = [];
    
    // 添加文本部分（包含图片标题信息）
    if (textContent) {
      // 解析图片标题信息
      const imageRegex = /!\[(.*?)\]\((.*?)\)/;
      const match = textContent.match(imageRegex);
      const imageTitle = match && match[1] ? match[1] : '';
      
      const userPrompt = imageTitle 
        ? `请分析并用中文描述这张图片的内容。图片标题：${imageTitle}`
        : prompts.translate.userPromptTemplate(textContent);
        
      userContent.push({
        type: 'text',
        text: userPrompt
      });
    } else {
      userContent.push({
        type: 'text',
        text: '请分析并用中文描述这张图片的内容：'
      });
    }
    
    // 添加图片部分
    userContent.push({
      type: 'image_url',
      image_url: {
        url: imageUrl
      }
    });
    
    return [
      {
        role: 'system' as const,
        content: systemPrompt
      },
      {
        role: 'user' as const,
        content: userContent
      }
    ];
  }
  
  // 否则返回纯文本消息
  return buildTranslateMessages(blockType, textContent, targetLanguage, _sourceLanguage, detectionInfo);
}

/**
 * 构建多模态解释消息（支持图片）
 */
export function buildMultimodalExplainMessages(
  blockType: string,
  textContent: string,
  imageUrl: string | null
): Array<{ role: 'system' | 'user'; content: string | MessageContent[] }> {
  const prompts = getBlockPrompts(blockType);
  
  // 如果有图片URL且是图片类型，构建多模态消息
  if (imageUrl && blockType === 'image') {
    const userContent: MessageContent[] = [];
    
    // 添加文本部分（包含图片标题信息）
    if (textContent) {
      // 解析图片标题信息
      const imageRegex = /!\[(.*?)\]\((.*?)\)/;
      const match = textContent.match(imageRegex);
      const imageTitle = match && match[1] ? match[1] : '';
      
      const userPrompt = imageTitle 
        ? `请深入分析和解释这张图片的内容、含义和重要信息。图片标题：${imageTitle}`
        : prompts.explain.userPromptTemplate(textContent);
        
      userContent.push({
        type: 'text',
        text: userPrompt
      });
    } else {
      userContent.push({
        type: 'text',
        text: '请深入分析和解释这张图片的内容、含义和重要信息：'
      });
    }
    
    // 添加图片部分
    userContent.push({
      type: 'image_url',
      image_url: {
        url: imageUrl
      }
    });
    
    return [
      {
        role: 'system' as const,
        content: prompts.explain.systemPrompt
      },
      {
        role: 'user' as const,
        content: userContent
      }
    ];
  }
  
  // 否则返回纯文本消息
  return buildExplainMessages(blockType, textContent);
}

/**
 * 获取语言名称
 */
function getLanguageName(languageCode: string): string {
  const languageNames: Record<string, string> = {
    'zh': '中文',
    'en': '英语',
    'ja': '日语',
    'ko': '韩语',
    'fr': '法语',
    'de': '德语',
    'es': '西班牙语',
    'pt': '葡萄牙语',
    'it': '意大利语',
    'ru': '俄语'
  };
  
  return languageNames[languageCode] || languageCode;
}