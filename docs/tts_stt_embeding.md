# OpenAI API Key 使用说明

**配置位置**: Core API Configuration → OpenAI API Key *
**说明**: Required for TTS/STT/embeddings regardless of AI provider.

---

## 1. **TTS (Text-to-Speech) 文字转语音**

### 使用的模型和技术
- **模型**: `tts-1` (OpenAI 标准 TTS 模型)
- **API 方法**: `openai.audio.speech.create()`
- **输出格式**: MP3
- **可用语音**: `alloy`, `echo`, `fable`, `nova`, `onyx`, `shimmer`
- **技术**: 基于 OpenAI 的神经 TTS 模型，生成自然流畅的语音

### 触发条件
- 当 `ttsProvider` 设置为 `'openai'` 时直接使用
- 当 `ttsProvider` 为 `'local'` 或 `'google'` 但失败时，会 **fallback** 到 OpenAI TTS

### 关键代码
```typescript
// 文件: src/services/apiService.ts (第380-396行)
const fallbackToOpenAITTS = async (
  text: string,
  signal: AbortSignal
): Promise<Response> => {
  const openai = getOpenAIClient()
  const settings = useSettingsStore().config

  return openai.audio.speech.create(
    {
      model: 'tts-1',              // OpenAI TTS 模型
      voice: settings.ttsVoice || 'nova',  // 默认语音: nova
      input: text,                 // 要转换的文本
      response_format: 'mp3',      // 输出格式
    },
    { signal }
  )
}
```

### 调用流程
```
ttsStream() 
  → 检查 ttsProvider
    → 'local': 调用本地 Piper TTS → 失败则 fallbackToOpenAITTS()
    → 'google': 调用 Google TTS API → 失败则 fallbackToOpenAITTS()
    → 其他: 直接调用 fallbackToOpenAITTS()
```

---

## 2. **STT (Speech-to-Text) 语音转文字**

### 使用的模型和技术
- **模型**: `gpt-4o-transcribe` (OpenAI 最新语音识别模型)
- **API 方法**: `openai.audio.transcriptions.create()`
- **输入格式**: WAV 音频文件 (AudioBuffer)
- **输出格式**: JSON (包含 `text` 字段)
- **技术**: 基于 GPT-4o 的语音识别模型，支持多语言自动检测

### 触发条件
- 当 `sttProvider` 设置为 `'openai'` 时使用
- 其他 STT 提供商: `groq`, `google`, `local` (本地 Whisper)

### 关键代码
```typescript
// 文件: src/services/apiService.ts (第563-576行)
export const transcribeWithOpenAI = async (
  audioBuffer: ArrayBuffer
): Promise<string> => {
  const openai = getOpenAIClient()
  
  // 将 ArrayBuffer 转换为 File 对象
  const file = await toFile(audioBuffer, 'audio.wav', {
    type: 'audio/wav',
  })
  
  // 调用 OpenAI 语音识别 API
  const transcription = await openai.audio.transcriptions.create({
    file,                          // 音频文件
    model: 'gpt-4o-transcribe',   // OpenAI STT 模型
    response_format: 'json',      // 返回 JSON 格式
  })
  
  return transcription?.text || ''
}
```

### STT 路由逻辑
```typescript
// 文件: src/modules/conversation/backendService.ts (第43-51行)
if (sttProvider === 'openai') {
  return await deps.transcribeWithOpenAI(audioArrayBuffer)
} else if (sttProvider === 'groq') {
  return await deps.transcribeWithGroq(audioArrayBuffer)
} else if (sttProvider === 'google') {
  return await deps.transcribeWithGoogle(audioArrayBuffer)
} else if (sttProvider === 'local') {
  return await deps.transcribeWithBackend(audioArrayBuffer)  // 本地 Whisper
}
```

---

## 3. **Embeddings (文本向量化)**

### 使用的模型和技术
- **模型**: `text-embedding-ada-002` (OpenAI 嵌入模型)
- **API 方法**: `openai.embeddings.create()`
- **输出**: 1536 维浮点数向量 (float 数组)
- **编码格式**: `float`
- **技术**: 将文本转换为高维向量，用于语义搜索、RAG (检索增强生成)、记忆检索等

### 触发条件
- 当 `embeddingProvider` 设置为 `'openai'` 时使用
- 可降级到 `local` (本地 MiniLM 模型)

### 关键代码
```typescript
// 文件: src/services/apiService.ts (第683-693行)
const fallbackToOpenAIEmbedding = async (
  textToEmbed: string
): Promise<number[]> => {
  const openai = getOpenAIClient()
  
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',  // OpenAI 嵌入模型
    input: textToEmbed,               // 要向量化的文本
    encoding_format: 'float',         // 返回 float 数组
  })
  
  return response.data[0]?.embedding || []
}
```

### 嵌入策略
```typescript
// 文件: src/services/apiService.ts (第615-646行)
export const createEmbedding = async (textInput: any): Promise<number[]> => {
  const settings = useSettingsStore().config
  const textToEmbed = extractTextForEmbedding(textInput)
  
  const hasOpenAIKey = !!settings.VITE_OPENAI_API_KEY?.trim()
  const shouldPreferLocal =
    settings.embeddingProvider === 'local' ||
    (!hasOpenAIKey && settings.aiProvider !== 'openai')
  
  if (shouldPreferLocal) {
    // 优先使用本地嵌入
    const embedding = await generateLocalEmbedding(textToEmbed)
    if (embedding && embedding.length > 0) {
      return embedding
    }
    // 本地失败则 fallback 到 OpenAI
    return hasOpenAIKey ? fallbackToOpenAIEmbedding(textToEmbed) : []
  }
  
  // 直接使用 OpenAI 嵌入
  return fallbackToOpenAIEmbedding(textToEmbed)
}
```

### 双重嵌入模式
系统还支持同时生成 OpenAI 和本地两种嵌入向量：
```typescript
// 文件: src/services/apiService.ts (第649-681行)
export const createDualEmbeddings = async (
  textInput: any
): Promise<{ openai?: number[]; local?: number[] }> => {
  // 同时生成 local 和 openai 两种嵌入向量
  // 用于混合检索策略
}
```

---

## OpenAI 客户端初始化

所有 OpenAI API 调用都通过统一的客户端实例：

```typescript
// 文件: src/services/apiClients.ts (第112-136行)
function initializeOpenAIClient(): void {
  const settings = useSettingsStore().config

  // 检查是否需要 OpenAI API Key
  if (!settings.VITE_OPENAI_API_KEY) {
    const needsOpenAI =
      settings.sttProvider === 'openai' ||
      settings.ttsProvider === 'openai' ||
      settings.embeddingProvider === 'openai'

    if (needsOpenAI) {
      console.warn('OpenAI API Key is not configured but required for STT/TTS/Embeddings.')
      throw new Error('OpenAI API Key is not configured.')
    }
    return
  }

  // 创建 OpenAI 客户端实例
  openaiClient = new OpenAI({
    apiKey: settings.VITE_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true,  // 允许在浏览器端使用
    timeout: 20 * 1000,             // 20秒超时
    maxRetries: 1,                  // 最多重试1次
  })
}
```

---

## 替代方案配置

如果无法连接 OpenAI，可以在设置中切换到其他提供商：

### TTS 替代方案
| 提供商 | 设置值 | 说明 |
|--------|--------|------|
| OpenAI | `'openai'` | 需要 API Key，使用 tts-1 模型 |
| Google | `'google'` | 需要 Google API Key，使用 Google Cloud TTS |
| Local | `'local'` | 使用本地 Piper TTS (Go 后端)，无需 API Key |


非实时语音合成（Qwen-TTS）API 的请求参数与返回字段说明。

> 模型的使用方法请参见 [非实时语音合成](https://help.aliyun.com/zh/model-studio/non-realtime-tts-user-guide) 。



### STT 替代方案
| 提供商 | 设置值 | 说明 |
|--------|--------|------|
| OpenAI | `'openai'` | 需要 API Key，使用 gpt-4o-transcribe |
| Groq | `'groq'` | 需要 Groq API Key，使用 Whisper 模型 |
| Google | `'google'` | 需要 Google API Key，使用 Google Speech-to-Text |
| Local | `'local'` | 使用本地 Whisper (Go 后端)，无需 API Key |

### Embeddings 替代方案
| 提供商 | 设置值 | 说明 |
|--------|--------|------|
| OpenAI | `'openai'` | 需要 API Key，使用 text-embedding-ada-002 |
| Local | `'local'` | 使用本地 MiniLM (Go 后端)，无需 API Key |


curl --location 'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings' \
--header "Authorization: Bearer $DASHSCOPE_API_KEY" \
--header 'Content-Type: application/json' \
--data '{
    "model": "text-embedding-v4",
    "input": "风急天高猿啸哀，渚清沙白鸟飞回，无边落木萧萧下，不尽长江滚滚来",  
    "dimensions": 1024,  
    "encoding_format": "float"
}'

---

## 关键文件索引

| 文件 | 作用 |
|------|------|
| [apiClients.ts](file:///e:/Program/nodejs/Alice/src/services/apiClients.ts) | OpenAI 客户端初始化和配置 |
| [apiService.ts](file:///e:/Program/nodejs/Alice/src/services/apiService.ts) | TTS/STT/Embeddings 服务实现 |
| [backendService.ts](file:///e:/Program/nodejs/Alice/src/modules/conversation/backendService.ts) | STT 提供商路由逻辑 |
| [backendApi.ts](file:///e:/Program/nodejs/Alice/src/services/backendApi.ts) | 本地后端 API 调用 (STT/TTS/Embeddings) |
| [settingsStore.ts](file:///e:/Program/nodejs/Alice/src/stores/settingsStore.ts) | 配置管理和验证 |
| [CoreSettingsTab.vue](file:///e:/Program/nodejs/Alice/src/components/settings/CoreSettingsTab.vue) | 设置 UI 界面 |


post测试

curl --location 'https://api.302.ai/v1/audio/speech' \
--header 'Authorization: Bearer ' \
--header 'Content-Type: application/json' \
--data '{
    "model": "gpt-4o-mini-tts",
    "input": "The quick brown fox jumped over the lazy dog.",
    "voice": "alloy"
}'

curl --location 'https://api.302ai.cn/v1/embeddings' \
--header 'Authorization: Bearer sk-UnyJFPWSsfEKBAUTxwLYxE6XYr0m0MrRQH1nWhC7oiEK5QNm' \
--header 'Content-Type: application/json' \
--data '{
  "model": "text-embedding-ada-002",
  "input": "The food was delicious and the waiter..."
}'