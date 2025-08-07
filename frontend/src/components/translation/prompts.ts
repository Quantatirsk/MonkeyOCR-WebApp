/**
 * 专门为不同类型区块设计的翻译和分析提示词系统
 * 减少提示词干扰，提高翻译和分析质量
 */

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
- 重点解释数据内容，而不是HTML标签结构
- 用中文回答，条理清晰`,
    userPromptTemplate: (content: string) => `请分析以下HTML表格的数据含义和重要信息：\n\n${content}`
  }
};

/**
 * 图片类区块专用提示词
 */
const IMAGE_PROMPTS: BlockPrompts = {
  translate: {
    systemPrompt: `你是专业的图片描述翻译专家。专注于翻译图片描述和说明文字。
要求：
- 准确翻译图片的描述内容
- 保持描述的准确性和完整性
- 维持原有的描述风格和详细程度
- 确保翻译后仍能准确描述图片内容`,
    userPromptTemplate: (content: string) => `请翻译以下图片描述或说明文字：\n\n${content}`
  },
  explain: {
    systemPrompt: `你是专业的图片内容解释专家。专注于解释图片描述的含义和背景。
要求：
- 基于描述内容解释图片的含义
- 提供相关的概念和背景信息
- 说明图片在文档中的作用和重要性
- 解释图片所传达的信息和价值
- 用中文回答，条理清晰`,
    userPromptTemplate: (content: string) => `请基于以下描述解释图片的含义和相关背景：\n\n${content}`
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
    userPromptTemplate: (content: string) => `请翻译以下文本内容：\n\n${content}`
  },
  explain: {
    systemPrompt: `你是知识渊博的文本内容解释专家。专注于解释文本的含义和背景。
要求：
- 详细解释文本的核心含义
- 提供相关的背景信息和概念
- 分析文本的重要观点和论述
- 解释专业术语和关键概念
- 用中文回答，条理清晰，便于理解`,
    userPromptTemplate: (content: string) => `请详细解释以下文本的含义和背景：\n\n${content}`
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