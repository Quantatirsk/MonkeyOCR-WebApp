/**
 * LLM Wrapper for MonkeyOCR WebApp translation and explanation features
 * 
 * Provides streaming interface for real-time content translation and explanation
 */

export interface ImageUrl {
  url: string  // Can be a URL or base64 data URL
}

export interface TextContent {
  type: 'text'
  text: string
}

export interface ImageContent {
  type: 'image_url'
  image_url: ImageUrl
}

export type MessageContent = TextContent | ImageContent

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | MessageContent[]
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

interface StreamChunk {
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
   * Helper method to create a text message
   */
  static createTextMessage(role: 'system' | 'user' | 'assistant', text: string): ChatMessage {
    return {
      role,
      content: text
    }
  }

  /**
   * Helper method to create a multimodal message with text and images
   */
  static createMultimodalMessage(
    role: 'system' | 'user' | 'assistant',
    parts: Array<{ type: 'text', text: string } | { type: 'image', url: string }>
  ): ChatMessage {
    const content: MessageContent[] = parts.map(part => {
      if (part.type === 'text') {
        return {
          type: 'text',
          text: part.text
        }
      } else {
        return {
          type: 'image_url',
          image_url: {
            url: part.url
          }
        }
      }
    })

    return {
      role,
      content
    }
  }

  /**
   * Helper method to convert an image file to base64 data URL
   */
  static async imageToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result)
        } else {
          reject(new Error('Failed to convert image to data URL'))
        }
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  /**
   * Helper method to convert an image URL to base64 data URL
   */
  static async imageUrlToDataUrl(url: string): Promise<string> {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result)
          } else {
            reject(new Error('Failed to convert image to data URL'))
          }
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      throw new Error(`Failed to fetch and convert image: ${error}`)
    }
  }

  /**
   * Non-streaming chat completion for translation and explanation
   */
  async chat(options: ChatCompletionOptions): Promise<string> {
    try {
      const response = await this.makeRequest({
        ...options,
        stream: false
      })

      const data = await response.json()
      return data.choices?.[0]?.message?.content || ''
    } catch (error) {
      console.error('LLM chat error:', error)
      throw new Error(`LLM chat failed: ${error}`)
    }
  }

  /**
   * Streaming chat completion for translation and explanation
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
   * Get available models from the API
   */
  async getModels(apiKey?: string, baseUrl?: string): Promise<ModelInfo[]> {
    try {
      console.log('[LLMWrapper] Getting models with:', {
        hasApiKey: !!apiKey,
        baseUrl: baseUrl || 'backend default'
      })

      // For now, use GET request as the backend expects
      // TODO: Update backend to accept POST with credentials if needed
      const response = await fetch(`${this.baseUrl}/api/llm/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
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
                    const parsed = JSON.parse(data)
                    
                    // 检查是否是错误响应
                    if (parsed.error) {
                      const errorMessage = parsed.error.message || 'Unknown error'
                      console.error('[LLMWrapper] Stream error received:', errorMessage)
                      controller.error(new Error(errorMessage))
                      return
                    }
                    
                    // 正常处理内容
                    const streamChunk = parsed as StreamChunk
                    const content = streamChunk.choices[0]?.delta?.content
                    
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
   * Make HTTP request to LLM API
   */
  private async makeRequest(options: ChatCompletionOptions): Promise<Response> {
    // Build request body with required fields
    const requestBody: any = {
      model: options.model || 'google/gemini-2.5-flash-lite', // Provide default model
      messages: options.messages,
      stream: options.stream || false,
      max_tokens: options.maxTokens,
      temperature: options.temperature || 0.7
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
    
    const response = await fetch(`${this.baseUrl}/api/llm/chat/completions`, {
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
}

// Export singleton instance
export const llmWrapper = new LLMWrapper()