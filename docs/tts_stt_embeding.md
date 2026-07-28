# OpenAI API Key 使用说明

**配置位置**: Core API Configuration → OpenAI API Key *
**说明**: Required for TTS/STT/embeddings regardless of AI provider.

---

## 1. **TTS (Text-to-Speech) 文字转语音**

### OpenAI TTS
- **模型**: `tts-1` (OpenAI 标准 TTS 模型)
- **API 方法**: `openai.audio.speech.create()`
- **输出格式**: MP3
- **可用语音**: `alloy`, `echo`, `fable`, `nova`, `onyx`, `shimmer`
- **技术**: 基于 OpenAI 的神经 TTS 模型，生成自然流畅的语音

### 通义千问 TTS
- **模型**: `qwen3-tts-flash` (通义千问 TTS 模型)
- **API 端点**: `https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`
- **输出格式**: WAV (通过 OSS 临时链接下载)
- **可用语音**: `Cherry`, `Serena`, `Ethan`, `Chelsie`, `Maia`
- **技术**: 基于通义千问多模态生成接口，返回音频数据后二次下载

### Google TTS
- **API 端点**: `https://texttospeech.googleapis.com/v1/text:synthesize`
- **输出格式**: MP3 (base64 编码)

### 触发条件
- 当 `ttsProvider` 设置为 `'openai'` 时直接使用
- 当 `ttsProvider` 为 `'dashscope'` 时使用通义千问
- 当 `ttsProvider` 为 `'local'` 或 `'google'` 但失败时，会 **fallback** 到 OpenAI TTS

### 关键代码
```typescript
// 文件: src/services/apiService.ts (第387-466行)
const dashScopeTTS = async (
  text: string,
  signal: AbortSignal
): Promise<Response> => {
  const settings = useSettingsStore().config
  const apiKey = settings.VITE_DASHSCOPE_API_KEY
  
  // 第一次请求：获取音频 OSS URL
  const response = await fetch(
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
    {
      method: 'POST',
      signal,
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3-tts-flash',
        input: { text, voice: voice, language_type: 'Chinese' },
      }),
    }
  )
  
  const data = await response.json()
  const audioUrl = data.output?.audio?.url
  
  // 第二次请求：从 OSS 下载音频
  const audioResponse = await fetch(audioUrl, { signal })
  return new Response(await audioResponse.blob())
}
```

### 调用流程
```
ttsStream() 
  → 检查 ttsProvider
    → 'openai': 直接调用 fallbackToOpenAITTS()
    → 'dashscope': 调用 dashScopeTTS()
    → 'google': 调用 Google TTS API → 失败则 fallbackToOpenAITTS()
    → 'local': 调用本地 Piper TTS → 失败则 fallbackToOpenAITTS()
```

---

## 2. **STT (Speech-to-Text) 语音转文字**

### OpenAI STT
- **模型**: `gpt-4o-transcribe` (OpenAI 最新语音识别模型)
- **API 方法**: `openai.audio.transcriptions.create()`
- **输入格式**: WAV 音频文件 (AudioBuffer)
- **输出格式**: JSON (包含 `text` 字段)

### 通义千问 STT
- **模型**: `qwen3-asr-flash` (通义千问语音识别模型)
- **API 端点**: `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
- **输入格式**: base64 编码的音频数据 URI
- **输出格式**: JSON (包含 `choices[0].message.content`)
- **配置**: 支持 `asr_options.language` 和 `enable_itn`

### Google STT / Groq STT / Local STT
- Google: 调用 Google Speech-to-Text API
- Groq: 调用 Groq Whisper API
- Local: 本地 Whisper (Go 后端)

### 关键代码
```typescript
// 文件: src/services/apiService.ts (第649-716行)
export const transcribeWithDashScope = async (
  audioBuffer: ArrayBuffer
): Promise<string> => {
  const settings = useSettingsStore().config
  const apiKey = settings.VITE_DASHSCOPE_API_KEY
  
  // 转换为 base64 data URI
  const blob = new Blob([audioBuffer], { type: 'audio/wav' })
  const base64Audio = await new Promise<string>(resolve => {
    const reader = new FileReader()
    reader.onloadend = () => resolve((reader.result as string).split(',')[1])
    reader.readAsDataURL(blob)
  })
  
  const response = await fetch(
    'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3-asr-flash',
        messages: [{
          role: 'user',
          content: [{
            type: 'input_audio',
            input_audio: { data: `data:audio/wav;base64,${base64Audio}` }
          }]
        }],
        asr_options: { language: language === 'auto' ? undefined : language, enable_itn: false }
      })
    }
  )
  
  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}
```

### STT 路由逻辑
```typescript
// 文件: src/modules/conversation/backendService.ts (第43-54行)
if (sttProvider === 'openai') {
  return await deps.transcribeWithOpenAI(audioArrayBuffer)
} else if (sttProvider === 'dashscope') {
  return await deps.transcribeWithDashScope(audioArrayBuffer)
} else if (sttProvider === 'groq') {
  return await deps.transcribeWithGroq(audioArrayBuffer)
} else if (sttProvider === 'google') {
  return await deps.transcribeWithGoogle(audioArrayBuffer)
} else if (sttProvider === 'local') {
  return await deps.transcribeWithBackend(audioArrayBuffer)
}
```

---

## 3. **Embeddings (文本向量化)**

### OpenAI Embeddings
- **模型**: `text-embedding-ada-002` (OpenAI 嵌入模型)
- **API 方法**: `openai.embeddings.create()`
- **输出**: 1536 维浮点数向量

### 通义千问 Embeddings
- **模型**: `text-embedding-v4` (通义千问嵌入模型)
- **API 端点**: `https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings`
- **输出**: 1536 维浮点数向量 (已调整为与 OpenAI 一致)
- **配置**: `dimensions: 1536`, `encoding_format: 'float'`

### 关键代码
```typescript
// 文件: src/services/apiService.ts (第777-813行)
const fallbackToDashScopeEmbedding = async (
  textToEmbed: string
): Promise<number[]> => {
  const settings = useSettingsStore().config
  const apiKey = settings.VITE_DASHSCOPE_API_KEY
  
  const response = await fetch(
    'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings',
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'text-embedding-v4',
        input: textToEmbed,
        dimensions: 1536,
        encoding_format: 'float',
      }),
    }
  )
  
  const data = await response.json()
  return data.data?.[0]?.embedding || []
}
```

---

## 替代方案配置

如果无法连接 OpenAI，可以在设置中切换到其他提供商：

### TTS 替代方案
| 提供商 | 设置值 | 说明 |
|--------|--------|------|
| OpenAI | `'openai'` | 需要 API Key，使用 tts-1 模型 |
| 通义千问 | `'dashscope'` | 需要 API Key，使用 qwen3-tts-flash 模型 |
| Google | `'google'` | 需要 Google API Key，使用 Google Cloud TTS |
| Local | `'local'` | 使用本地 Piper TTS (Go 后端)，无需 API Key |

### STT 替代方案
| 提供商 | 设置值 | 说明 |
|--------|--------|------|
| OpenAI | `'openai'` | 需要 API Key，使用 gpt-4o-transcribe |
| 通义千问 | `'dashscope'` | 需要 API Key，使用 qwen3-asr-flash 模型 |
| Groq | `'groq'` | 需要 Groq API Key，使用 Whisper 模型 |
| Google | `'google'` | 需要 Google API Key，使用 Google Speech-to-Text |
| Local | `'local'` | 使用本地 Whisper (Go 后端)，无需 API Key |

### Embeddings 替代方案
| 提供商 | 设置值 | 说明 |
|--------|--------|------|
| OpenAI | `'openai'` | 需要 API Key，使用 text-embedding-ada-002 |
| 通义千问 | `'dashscope'` | 需要 API Key，使用 text-embedding-v4 (1536维) |
| Local | `'local'` | 使用本地 MiniLM (Go 后端)，无需 API Key |

---

## 关键文件索引

| 文件 | 作用 |
|------|------|
| [apiClients.ts](file:///e:/Program/nodejs/Leshine/src/services/apiClients.ts) | OpenAI 客户端初始化和配置 |
| [apiService.ts](file:///e:/Program/nodejs/Leshine/src/services/apiService.ts) | TTS/STT/Embeddings 服务实现 |
| [backendService.ts](file:///e:/Program/nodejs/Leshine/src/modules/conversation/backendService.ts) | STT 提供商路由逻辑 |
| [backendApi.ts](file:///e:/Program/nodejs/Leshine/src/services/backendApi.ts) | 本地后端 API 调用 (STT/TTS/Embeddings) |
| [settingsStore.ts](file:///e:/Program/nodejs/Leshine/src/stores/settingsStore.ts) | 配置管理和验证 |
| [CoreSettingsTab.vue](file:///e:/Program/nodejs/Leshine/src/components/settings/CoreSettingsTab.vue) | 设置 UI 界面 |
