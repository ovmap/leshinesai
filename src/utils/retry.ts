/**
 * 判断错误是否可重试
 * 基于错误对象的属性（name, message, code, status）判断
 */
export function isRetryableError(error: any): boolean {
  const name = error?.name || ''
  const message = error?.message || ''
  const code = error?.code || ''
  
  // 用户主动取消 - 不重试
  if (name === 'AbortError') return false
  
  // 网络错误
  if (name === 'TypeError' || code === 'network_error') return true
  
  // 超时
  if (message.toLowerCase().includes('timeout') || code === 'timeout') return true
  
  // 流中断/连接断开
  if (message.toLowerCase().includes('stream') || 
      message.toLowerCase().includes('truncated') ||
      message.toLowerCase().includes('network')) return true
  
  // API 限流
  if (code === 'rate_limit_exceeded' || error?.status === 429) return true
  
  // 服务器错误（5xx）
  if (error?.status && error.status >= 500) return true
  
  return false
}

/**
 * 带重试的异步函数执行
 * @param fn 要执行的异步函数
 * @param delays 重试延时数组（毫秒），每个元素代表一次重试的延时
 * @param onRetry 重试时的回调函数
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  delays: number[],
  onRetry?: (attempt: number, error: any) => void
): Promise<T> {
  let lastError: any
  
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      
      // 最后一次尝试或错误不可重试，直接抛出
      if (attempt === delays.length || !isRetryableError(error)) {
        throw error
      }
      
      // 触发重试回调
      if (onRetry) {
        onRetry(attempt + 1, error)
      }
      
      // 等待后重试
      const delay = delays[attempt]
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError
}
