/**
 * LLM Wrapper for unified frontend LLM API calls
 * 
 * Provides both streaming and non-streaming interfaces for LLM interactions.
 * - Streaming: Used for conversational chat interfaces
 * - Non-streaming: Used for agent-type operations like file summarization
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionOptions {
  messages: ChatMessage[]
  stream?: boolean
  maxTokens?: number
  temperature?: number
  model?: string
  apiKey?: string
  baseUrl?: string
}

export interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message?: ChatMessage
    finish_reason?: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface StreamChunk {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      content?: string
    }
    finish_reason?: string
  }>
}

export interface ModelInfo {
  id: string
  object: string
  created: number
  owned_by: string
  permission: unknown[]
  root: string
  parent: string | null
}

export interface ModelsResponse {
  object: string
  data: ModelInfo[]
}

export class LLMWrapper {
  private baseUrl: string

  constructor() {
    // Use the same base URL as the main API
    this.baseUrl = 'http://localhost:8001'
  }

  /**
   * Non-streaming chat completion (for agent-type operations)
   */
  async chat(options: ChatCompletionOptions): Promise<string> {
    try {
      const response = await this.makeRequest({
        ...options,
        stream: false
      })

      const data = await response.json() as ChatCompletionResponse
      return data.choices[0]?.message?.content || ''
    } catch (error) {
      console.error('LLM chat error:', error)
      throw new Error(`LLM chat failed: ${error}`)
    }
  }

  /**
   * Streaming chat completion (for conversational interfaces)
   */
  async streamChat(options: ChatCompletionOptions): Promise<ReadableStream<string>> {
    try {
      const response = await this.makeRequest({
        ...options,
        stream: true
      })

      return this.createStreamProcessor(response)
    } catch (error) {
      console.error('LLM stream chat error:', error)
      throw new Error(`LLM stream chat failed: ${error}`)
    }
  }

  /**
   * Summarize file content (streaming)
   */
  async streamSummarizeFile(content: string, maxLength = 10000, model?: string, apiKey?: string, baseUrl?: string): Promise<ReadableStream<string>> {
    // Truncate content if too long
    const truncatedContent = this.truncateContent(content, maxLength)
    
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `用户将提供一篇文档，请告诉读者这篇文档的有什么内容，结合有序列表、加粗字体简要陈列文档的主要信息或观点，语言简洁明了。`
      },
      {
        role: 'user',
        content: `${truncatedContent}\n\n 请概括上述内容，不要有任何解释，直接输出文档概要：`
      }
    ]

    console.log('Creating stream for file summarization...')
    const stream = await this.streamChat({
      messages,
      temperature: 0.3,
      maxTokens: 2000,
      model,
      apiKey,
      baseUrl
    })
    console.log('Stream created successfully')
    return stream
  }

  /**
   * Extract keywords from user query (non-streaming)
   */
  async extractKeywords(query: string, model?: string, apiKey?: string, baseUrl?: string): Promise<string[][]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是一个专业的关键词提取助手。根据用户查询，提取不同长度的关键词组合用于文件搜索。

**重要规则：**
1. **只返回JSON数组，不要包含任何解释文字**
2. 生成2-4组不同长度的关键词组合
3. 包含：
   - 1-2组两个关键词（最核心的2个词汇，提高召回率）
   - 1-2组三个关键词（提高精确度，用于精准搜索）
4. 包含同义词、英文缩写、相关概念
5. 考虑不同的搜索角度和表达方式

**输出格式（严格按照此格式，不要有其他文字）：**
[
  ["核心词", "相关词"],
  ["技术词", "应用词"],
  ["概念词", "方法词", "领域词"]
]

**示例：**
查询："机器学习算法"
输出：
[
  ["机器学习", "算法"],
  ["深度学习", "训练"],
  ["神经网络", "预测", "分类"]
]`
      },
      {
        role: 'user',
        content: `用户查询："${query}"\n\n请提取关键词组合（只返回JSON数组）：`
      }
    ]

    try {
      const response = await this.chat({
        messages,
        temperature: 0.3,
        maxTokens: 400,
        model,
        apiKey,
        baseUrl
      })

      // Clean and parse JSON response
      let cleanedResponse = response.trim()
      
      // Try to extract JSON array from response if it contains extra text
      const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0]
      }
      
      console.log('Keywords extraction response:', cleanedResponse)
      const parsed = JSON.parse(cleanedResponse)
      
      if (Array.isArray(parsed) && parsed.every(group => Array.isArray(group))) {
        // Filter out empty groups and ensure each group has valid keywords
        const validGroups = parsed
          .filter(group => group.length > 0)
          .map(group => group.filter(keyword => typeof keyword === 'string' && keyword.trim().length > 0))
          .filter(group => group.length > 0)
        
        if (validGroups.length > 0) {
          return validGroups as string[][]
        }
      }
      
      throw new Error('Invalid response format')
    } catch (error) {
      console.warn('Failed to extract keywords, using fallback:', error)
      // Enhanced fallback: create multiple search strategies
      const baseKeywords = query.split(/\s+/).filter(word => word.length > 1)
      return [
        baseKeywords, // Original query words
        [query], // Full query as single term
        baseKeywords.slice(0, 2) // First two words only
      ].filter(group => group.length > 0)
    }
  }

  /**
   * Analyze file relevance and provide recommendations (non-streaming)
   */
  async analyzeRelevance(userQuery: string, files: Array<{ file_path: string; file_name: string; file_type?: string; content_preview?: string; match_score?: number }>, model?: string, apiKey?: string, baseUrl?: string): Promise<{
    reasoning: string
    recommendedFiles: Array<{ file_path: string; file_name: string; file_type?: string; content_preview?: string; match_score?: number }>
  }> {
    const filesInfo = files.slice(0, 20).map(file => ({
      path: file.file_path,
      name: file.file_name,
      type: file.file_type,
      preview: file.content_preview || '',
      score: file.match_score
    }))

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是一个专业的文件相关性分析助手。根据用户查询和搜索结果，分析文件相关性并提供推荐。

**重要规则：**
1. **只返回JSON格式，不要包含任何解释文字**
2. 分析用户查询意图和需求
3. 评估每个文件的相关性程度
4. 按相关性从高到低排序，推荐5-10个最相关文件
5. 提供简洁清晰的推荐理由

**输出格式（严格按照此格式）：**
{
  "reasoning": "基于用户查询分析，推荐以下文件的理由",
  "recommendedFiles": ["文件路径1", "文件路径2", "文件路径3"]
}

**分析要点：**
- 文件名与查询的匹配度
- 文件类型的相关性
- 内容预览的相关性
- 文件的匹配评分`
      },
      {
        role: 'user',
        content: `用户查询："${userQuery}"

可选文件列表：
${JSON.stringify(filesInfo, null, 2)}

请分析并推荐最相关的文件（只返回JSON格式）：`
      }
    ]

    try {
      const response = await this.chat({
        messages,
        temperature: 0.3,
        maxTokens: 600,
        model,
        apiKey,
        baseUrl
      })

      // Clean and parse JSON response
      let cleanedResponse = response.trim()
      
      // Try to extract JSON object from response if it contains extra text
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0]
      }
      
      console.log('File relevance analysis response:', cleanedResponse)
      const parsed = JSON.parse(cleanedResponse)
      
      if (parsed.reasoning && Array.isArray(parsed.recommendedFiles)) {
        // Map file paths back to full file objects
        const recommendedFiles = parsed.recommendedFiles
          .map((filePath: string) => files.find(f => f.file_path === filePath))
          .filter(Boolean)
          .slice(0, 10) // Limit to 10 files max

        return {
          reasoning: parsed.reasoning,
          recommendedFiles
        }
      } else {
        throw new Error('Invalid response format')
      }
    } catch (error) {
      console.warn('Failed to analyze relevance, using fallback:', error)
      // Enhanced fallback: return top files by match score with better reasoning
      const topFiles = files
        .slice(0, 10)
        .sort((a, b) => (b.match_score || 0) - (a.match_score || 0))
      
      return {
        reasoning: `基于搜索匹配度和文件类型相关性，为查询"${userQuery}"推荐以下${topFiles.length}个文件。推荐顺序按匹配度从高到低排列。`,
        recommendedFiles: topFiles
      }
    }
  }

  /**
   * Truncate content intelligently
   */
  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content
    }

    // Intelligent truncation: prioritize beginning and end
    const startLength = Math.floor(maxLength * 0.7)
    const endLength = maxLength - startLength - 50 // 50 chars for ellipsis

    return content.substring(0, startLength) + 
           '\n\n... [中间内容已省略] ...\n\n' + 
           content.substring(content.length - endLength)
  }

  /**
   * Create stream processor for handling SSE responses
   */
  private createStreamProcessor(response: Response): ReadableStream<string> {
    if (!response.body) {
      throw new Error('No response body received')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    return new ReadableStream<string>({
      start(controller) {
        let buffer = ''
        
        const processStream = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read()
              
              if (done) {
                // Process any remaining data in buffer
                if (buffer.trim()) {
                  console.warn('Unprocessed data in buffer:', buffer)
                }
                controller.close()
                break
              }

              const chunk = decoder.decode(value, { stream: true })
              buffer += chunk
              
              // Process complete lines
              const lines = buffer.split('\n')
              buffer = lines.pop() || '' // Keep incomplete line in buffer

              for (const line of lines) {
                const trimmedLine = line.trim()
                if (!trimmedLine) continue
                
                if (trimmedLine.startsWith('data: ')) {
                  const data = trimmedLine.slice(6)
                  
                  if (data === '[DONE]') {
                    controller.close()
                    return
                  }

                  try {
                    const parsed = JSON.parse(data) as StreamChunk
                    const content = parsed.choices[0]?.delta?.content
                    
                    if (content) {
                      console.log('[LLMWrapper] Enqueuing content chunk:', JSON.stringify(content))
                      controller.enqueue(content)
                    }
                  } catch (parseError) {
                    console.warn('Failed to parse stream chunk:', data, parseError)
                  }
                }
              }
            }
          } catch (error) {
            console.error('[LLMWrapper] Stream processing error:', error)
            controller.error(error)
          } finally {
            // Clean up the original reader
            try {
              reader.releaseLock()
            } catch (e) {
              console.warn('Error releasing original reader:', e)
            }
          }
        }
        
        processStream()
      }
    })
  }

  /**
   * Get available models from the API
   */
  async getModels(apiKey?: string, baseUrl?: string): Promise<ModelInfo[]> {
    try {
      // Build request body, only include credentials if provided
      const requestBody: any = {}
      
      if (apiKey) {
        requestBody.api_key = apiKey
      }
      
      if (baseUrl) {
        requestBody.base_url = baseUrl
      }
      
      console.log('[LLMWrapper] Getting models with:', {
        hasApiKey: !!apiKey,
        baseUrl: baseUrl || 'backend default'
      })

      const response = await fetch(`${this.baseUrl}/v1/models`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `HTTP ${response.status}`)
      }

      const data = await response.json() as ModelsResponse
      return data.data || []
    } catch (error) {
      console.error('Failed to get models:', error)
      // Return fallback models if API call fails
      return [
        { id: 'gpt-4.1-nano', object: 'model', created: Date.now(), owned_by: 'openai', permission: [] as unknown[], root: 'gpt-4.1-nano', parent: null },
        { id: 'gpt-4.1-mini', object: 'model', created: Date.now(), owned_by: 'openai', permission: [] as unknown[], root: 'gpt-4.1-mini', parent: null }
      ]
    }
  }

  /**
   * Make HTTP request to LLM API (unified for both streaming and non-streaming)
   */
  private async makeRequest(options: ChatCompletionOptions): Promise<Response> {
    // Build request body, only include model if explicitly provided
    const requestBody: any = {
      messages: options.messages,
      stream: options.stream || false,
      max_tokens: options.maxTokens,
      temperature: options.temperature || 0.7
    }
    
    // Only include optional fields if they're explicitly provided
    if (options.model) {
      requestBody.model = options.model
    }
    
    if (options.apiKey) {
      requestBody.api_key = options.apiKey
    }
    
    if (options.baseUrl) {
      requestBody.base_url = options.baseUrl
    }
    
    console.log('[LLMWrapper] Sending request with:', {
      model: options.model || 'backend default',
      hasApiKey: !!options.apiKey,
      baseUrl: options.baseUrl || 'backend default'
    })
    
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.detail || `HTTP ${response.status}`)
    }

    return response
  }

  /**
   * Translate text using backend translation API
   */
  async translateText(
    text: string,
    sourceLanguage = 'auto',
    targetLanguage: string,
    style: 'accurate' | 'natural' | 'formal' = 'accurate',
    stream = false
  ): Promise<string | ReadableStream<string>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/llm/translate/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          source_language: sourceLanguage,
          target_language: targetLanguage,
          translation_style: style,
          stream
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `Translation failed: HTTP ${response.status}`)
      }

      if (stream) {
        return this.createTranslationStreamProcessor(response)
      } else {
        const data = await response.json()
        return data.translation || ''
      }
    } catch (error) {
      console.error('Translation error:', error)
      throw new Error(`Translation failed: ${error}`)
    }
  }

  /**
   * Explain text using backend explanation API
   */
  async explainText(
    text: string,
    language = 'en',
    stream = false
  ): Promise<string | ReadableStream<string>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/llm/explain/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          language,
          stream
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `Explanation failed: HTTP ${response.status}`)
      }

      if (stream) {
        return this.createTranslationStreamProcessor(response)
      } else {
        const data = await response.json()
        return data.explanation || ''
      }
    } catch (error) {
      console.error('Explanation error:', error)
      throw new Error(`Explanation failed: ${error}`)
    }
  }

  /**
   * Translate single block using backend API
   */
  async translateBlock(
    content: string,
    sourceLanguage = 'auto',
    targetLanguage: string,
    translationStyle: 'accurate' | 'natural' | 'formal' = 'accurate'
  ): Promise<{
    original: string;
    translation: string;
    status: string;
    error?: string;
    source_language: string;
    target_language: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/translate/block`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          block_content: content,
          source_language: sourceLanguage,
          target_language: targetLanguage,
          translation_style: translationStyle
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `Block translation failed: HTTP ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Block translation error:', error)
      throw new Error(`Block translation failed: ${error}`)
    }
  }

  /**
   * Start document translation job
   */
  async translateDocument(blocks: Array<{
    id: string;
    content: string;
    type: string;
  }>, options: {
    source_language: string;
    target_language: string;
    preserve_formatting?: boolean;
    translation_style?: 'accurate' | 'natural' | 'formal';
  }): Promise<{
    translation_id: string;
    status: string;
    total_blocks: number;
    message: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/translate/document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          blocks,
          source_language: options.source_language,
          target_language: options.target_language,
          preserve_formatting: options.preserve_formatting ?? true,
          translation_style: options.translation_style ?? 'accurate'
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `Document translation failed: HTTP ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Document translation error:', error)
      throw new Error(`Document translation failed: ${error}`)
    }
  }

  /**
   * Get translation job status
   */
  async getTranslationStatus(translationId: string): Promise<{
    translation_id: string;
    status: string;
    progress: number;
    total_blocks: number;
    completed_blocks: number;
    failed_blocks: number;
    created_at: string;
    completed_at?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/translate/status/${translationId}`)

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Translation job not found')
        }
        const errorData = await response.json()
        throw new Error(errorData.detail || `Status check failed: HTTP ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Translation status error:', error)
      throw new Error(`Translation status check failed: ${error}`)
    }
  }

  /**
   * Get complete translation results
   */
  async getTranslationResult(translationId: string): Promise<{
    translation_id: string;
    status: string;
    source_language: string;
    target_language: string;
    total_blocks: number;
    results: Array<{
      block_id: string;
      original_content: string;
      translated_content: string;
      status: string;
      error_message?: string;
    }>;
    created_at: string;
    completed_at?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/translate/result/${translationId}`)

      if (!response.ok) {
        if (response.status === 202) {
          throw new Error('Translation still in progress')
        }
        if (response.status === 404) {
          throw new Error('Translation results not found')
        }
        const errorData = await response.json()
        throw new Error(errorData.detail || `Result retrieval failed: HTTP ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Translation result error:', error)
      throw new Error(`Translation result retrieval failed: ${error}`)
    }
  }

  /**
   * Delete translation result and free memory
   */
  async deleteTranslationResult(translationId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/translate/result/${translationId}`, {
        method: 'DELETE'
      })

      if (!response.ok && response.status !== 404) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `Deletion failed: HTTP ${response.status}`)
      }
    } catch (error) {
      console.error('Translation deletion error:', error)
      // Don't throw for deletion errors - they're not critical
    }
  }

  /**
   * Get available models from backend LLM API
   */
  async getLLMModels(): Promise<Array<{
    id: string;
    object: string;
    created: number;
    owned_by: string;
  }>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/llm/models`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `Models retrieval failed: HTTP ${response.status}`)
      }

      const data = await response.json()
      return data.data || []
    } catch (error) {
      console.error('LLM models error:', error)
      // Return fallback models
      return [
        { id: 'gpt-3.5-turbo', object: 'model', created: Date.now(), owned_by: 'openai' },
        { id: 'gpt-4', object: 'model', created: Date.now(), owned_by: 'openai' }
      ]
    }
  }

  /**
   * Create stream processor for translation/explanation streaming
   */
  private createTranslationStreamProcessor(response: Response): ReadableStream<string> {
    if (!response.body) {
      throw new Error('No response body received')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    return new ReadableStream<string>({
      start(controller) {
        let buffer = ''
        
        const processStream = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read()
              
              if (done) {
                controller.close()
                break
              }

              const chunk = decoder.decode(value, { stream: true })
              buffer += chunk
              
              // Process complete lines
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''

              for (const line of lines) {
                const trimmedLine = line.trim()
                if (!trimmedLine) continue
                
                if (trimmedLine.startsWith('data: ')) {
                  const data = trimmedLine.slice(6)
                  
                  if (data === '[DONE]') {
                    controller.close()
                    return
                  }

                  try {
                    const parsed = JSON.parse(data)
                    if (parsed.content) {
                      controller.enqueue(parsed.content)
                    } else if (parsed.error) {
                      controller.error(new Error(parsed.error))
                    }
                  } catch (parseError) {
                    console.warn('Failed to parse translation stream chunk:', data)
                  }
                }
              }
            }
          } catch (error) {
            console.error('Translation stream processing error:', error)
            controller.error(error)
          }
        }
        
        processStream()
      }
    })
  }
}

// Export singleton instance
export const llmWrapper = new LLMWrapper()