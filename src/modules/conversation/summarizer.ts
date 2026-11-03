export interface RawMessageForSummarization {
  role: string
  text_content: string
  created_at: string
}

export interface SummarizerDependencies {
  isSummarizing(): boolean
  setSummarizing(value: boolean): void
  fetchRecentMessages(limit: number): Promise<{
    success: boolean
    data?: RawMessageForSummarization[]
  }>
  analyzeContext(
    formattedMessages: Array<{ role: string; content: string }>,
    model: string
  ): Promise<string | null>
  createSummary(
    formattedMessages: Array<{ role: string; content: string }>,
    model: string,
    systemPrompt: string
  ): Promise<string | null>
  saveSummary(params: {
    summaryText: string
    summarizedMessagesCount: number
  }): Promise<void>
  setEphemeralEmotionalContext(value: string | null): void
  getSummarizationConfig(): {
    messageCount: number
    frequency: number
    model: string
    systemPrompt: string
  }
  logError(...args: any[]): void
}

export interface Summarizer {
  triggerSummarization(): Promise<void>
}

export function createSummarizer(
  dependencies: SummarizerDependencies
): Summarizer {
  // 追踪上次总结时的消息数量，用于频率控制
  let lastSummarizedMessageCount = 0

  return {
    async triggerSummarization(): Promise<void> {
      if (dependencies.isSummarizing()) return

      const config = dependencies.getSummarizationConfig()
      const messagesResult = await dependencies.fetchRecentMessages(
        config.messageCount
      )

      if (!messagesResult.success || !messagesResult.data?.length) {
        return
      }

      const currentMessageCount = messagesResult.data.length

      // 频率控制：只有当新消息数量达到阈值时才触发总结
      const newMessagesSinceLastSummary = currentMessageCount - lastSummarizedMessageCount
      if (lastSummarizedMessageCount > 0 && newMessagesSinceLastSummary < config.frequency) {
        return
      }

      dependencies.setSummarizing(true)

      try {
        const rawMessages = messagesResult.data
        const formattedMessages = rawMessages.map(m => ({
          role: m.role,
          content: m.text_content || '[content missing]',
        }))

        const [emotionalContext, factualSummary] = await Promise.all([
          dependencies.analyzeContext(formattedMessages, config.model),
          dependencies.createSummary(
            formattedMessages,
            config.model,
            config.systemPrompt
          ),
        ])

        if (emotionalContext) {
          dependencies.setEphemeralEmotionalContext(emotionalContext)
        }

        if (factualSummary) {
          await dependencies.saveSummary({
            summaryText: factualSummary,
            summarizedMessagesCount: rawMessages.length,
          })
        }

        // 更新上次总结的消息数量
        lastSummarizedMessageCount = currentMessageCount
      } catch (error) {
        dependencies.logError('[Summarizer] Error during summarization:', error)
      } finally {
        dependencies.setSummarizing(false)
      }
    },
  }
}
