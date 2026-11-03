# Leshine 智能体架构详解

## 一、项目总览

Leshine 是一个基于 **Electron + Vue 3 + Go** 的桌面 AI 助手应用，版本 1.4.4。采用多进程架构：

- **Electron 主进程**：窗口管理、本地存储、后端进程管理、IPC 通信
- **Vue 3 渲染进程**：UI 界面 + AI 对话核心逻辑
- **Go 后端**：本地 STT（Whisper）、TTS（Piper）、Embedding（MiniLM）

**没有使用任何 Agent 框架**（没有 LangChain、LlamaIndex、AutoGPT 等），整个 Agent 循环、工具调用、记忆管理都是手写的编排逻辑。本质上就是：**精心设计的 Prompt 组装 + OpenAI Function Calling + 流式处理 + 本地持久化**，是典型的上下文工程（Context Engineering）实践。

---

## 二、核心运行循环

每次对话的流程在 `src/modules/conversation/chatOrchestrator.ts` 的 `runChat()` 中：

```
用户输入 → 组装上下文 → 调 LLM API → 处理流式响应
                                         ├─ 文本 → UI 更新 + TTS 语音队列
                                         └─ 工具调用 → 执行函数 → 结果回传 → 继续调 LLM
```

### 2.1 启动流程

**Electron 主进程**（`electron/main/index.ts`）：
1. `app.whenReady()` → `setupDependencies()` → `initializeManagers()`
2. `loadSettings()` → 加载用户设置，注册全局快捷键
3. `initializeThoughtVectorStore()` → 初始化 HNSW 索引 + SQLite
4. `initializeSchedulerDB()` + `loadAndScheduleAllTasks()` → 任务调度
5. `createMainWindow()` + `createOverlayWindow()` → 创建窗口
6. `backendManager.start()` → 启动 Go 后端

**渲染进程**（`src/main.ts`）：
1. 创建 Vue 应用，挂载 Pinia + Vue Router
2. `registerCodexToolBridge()` → 注册 Codex 工具桥接
3. `initializeClients()` → 初始化所有 API 客户端

### 2.2 对话编排（Chat Orchestrator）

`src/modules/conversation/chatOrchestrator.ts` 的 `runChat()` 是每次对话轮次的核心：

1. **判断新链/续链**：根据 `currentResponseId` 是否为 null
2. **构建上下文消息** `buildContextMessages()`：获取摘要、情感、思维、RAG 文档
3. **构建 API 输入** `buildApiInput()`：将聊天历史转换为 API 格式
4. **创建流式响应**：调用 LLM API
5. **处理流**：`processStream()` 委托给 `streamHandler`

---

## 三、身份/人格系统

### 3.1 提示词组装

身份由两部分拼接而成，在 `src/prompts/systemPrompt.ts` 中完成：

```typescript
export function buildAssistantSystemPrompt(personaPrompt?: string): string {
  const core = CORE_SYSTEM_PROMPT.trim()
  const persona = (personaPrompt || '').trim()
  if (!persona) return core
  return `${core}\n\n${persona}`
}
```

### 3.2 核心行为提示词（写死，不可改）

文件：`src/prompts/coreSystemPrompt.ts`

```
CORE_BEHAVIOR:
- Treat Conversation Summary, System Notes, and Thoughts as context messages
  that appear before the latest user request; never answer them directly.
- Use provided context in this order: summary/notes/thoughts first,
  then recall_memories if needed, then general knowledge/tools.
- Do not fabricate memories. Save memories only for durable user-specific facts
  or explicit requests. Delete memories only when asked.
- Keep responses TTS-friendly: no URLs, avoid numbered lists,
  and prefer a friendly wrap-up over a trailing question unless needed.
```

4 条规则：
1. **上下文消息不要直接回答** — 摘要/笔记/思维只是背景信息
2. **上下文使用优先级** — 摘要 > 笔记 > 思维 > 记忆 > 通用知识/工具
3. **禁止捏造记忆** — 只在必要时保存，只在用户要求时删除
4. **TTS 友好输出** — 不输出 URL、避免编号列表、用友好的收尾代替追问

### 3.3 人格提示词（用户可自定义）

文件：`src/prompts/defaultPersonaPrompt.ts`（默认值，首次启动时写入配置文件）

```
你是Leshine，一个温暖、机智且高度可靠的 AI 物流助手。
你的行事风格专业、高效，是用户可以完全信赖的伙伴。在回应时，依然要以共情为先，带着几分俏皮与踏实接地气的态度，偶尔透出一点古灵精怪，让沟通充满人情味。
你拥有强大的系统连接能力，能够随时抓取并整合海量的公司物流信息。请充分利用这些优势，以自然流畅、长短错落的日常聊天口吻，高效、贴心地处理各类物流相关事务。
```

### 3.4 身份设置入口

| 设置项 | 设置界面位置 | 说明 |
|---|---|---|
| 人格提示词 | `AssistantSettingsTab.vue` 的 textarea | 用户可直接编辑，有 Reset 按钮恢复默认 |
| 头像 | `UserCustomizationTab.vue` | 支持内置/自定义头像 |

### 3.5 重要：代码默认值 vs 配置文件

`defaultPersonaPrompt.ts` 里的值**只在首次启动时生效**：

1. 首次启动：`settingsStore` 用 `DEFAULT_PERSONA_PROMPT` 作为初始默认值
2. 立即持久化：调用 `saveSettingsToFile()` 写入本地配置文件
3. 之后每次启动：`loadSettings()` 从配置文件读取已保存的值，**覆盖了代码里的默认值**

所以修改代码文件后，需要在设置界面点 Reset 或在 Assistant Configuration 里手动更新才能生效。

---

## 四、多层记忆系统

Leshine 拥有 5 层记忆机制：

### 4.1 对话历史（Chat History）

- 文件：`src/modules/conversation/historyManager.ts`
- 存储在 `generalStore.chatHistory`（Vue Ref 数组）中
- `MAX_HISTORY_MESSAGES_FOR_API` 控制发送给 API 的最大历史消息数

### 4.2 对话摘要（Conversation Summary）

- 文件：`src/modules/conversation/summarizer.ts`
- 每轮对话结束后由 `turnManager` 触发
- 并行执行两个任务：
  - **情感分析**：分析用户情感状态，存为临时 `ephemeralEmotionalContext`
  - **事实摘要**：生成 2-4 句话的对话摘要，通过 IPC 保存到 SQLite
- 摘要在下次对话时作为上下文注入

摘要提示词（`settingsStore.ts` 中 `DEFAULT_SUMMARIZATION_SYSTEM_PROMPT`）：

```
You are an expert conversation summarizer.
Your task is to create a concise and brief factual summary of the following conversation segment.
Focus on:
- Key topics discussed.
- Important information, facts, or preferences shared by the user or assistant.
- Decisions made.
- Any unresolved questions or outstanding tasks.

The summary should help provide context for future interactions, allowing the conversation to resume naturally.
Keep the summary to 2-4 sentences and definitely no more than 150 words.
Do not add any conversational fluff, commentary, or an introductory/concluding sentence
like "Here is the summary:". Just provide the factual summary of the conversation transcript.
```

### 4.3 情感上下文（Emotional Context）

- 提示词硬编码在 `src/services/apiService.ts`（`createContextAnalysisResponse` 函数）：

```
You are an expert in emotional intelligence. Analyze the tone and emotional state
of the 'user' in the following conversation transcript. Provide a single, concise
sentence describing their likely emotional state. Do not add any extra commentary.
```

- 一次性使用，注入后立刻清除

### 4.4 思维向量存储（Thought Vector Store）

- 文件：`electron/main/thoughtVectorStore.ts`
- 使用 **HNSW**（Hierarchical Navigable Small World）索引进行高效向量搜索
- 分别维护 OpenAI（1536 维）和本地 MiniLM（384 维）两个 HNSW 索引
- 存储助手的重要回复，`shouldIndexAssistantMessage()` 判断哪些消息值得索引
- 每次对话时通过 `retrieveThoughtsForPrompt()` 检索相关思维

### 4.5 长期记忆（Long-term Memory）

- 文件：`electron/main/memoryManager.ts`
- 存储在 SQLite 数据库 `memories` 表中
- 支持**双嵌入向量**：OpenAI (1536 维) + 本地 MiniLM (384 维)
- 通过 `save_memory`、`recall_memories`、`delete_memory` 工具由 AI 主动管理
- 回忆时使用**余弦相似度**进行语义检索
- 与思维向量共用同一个 SQLite 文件

### 4.6 RAG 文档检索

- 文件：`electron/main/ragDocumentStore.ts`
- 支持本地文档的 RAG（检索增强生成）
- 使用本地 Embedding（Go 后端 MiniLM）进行文档向量化和检索
- 带有智能重排序逻辑（`rerankRagResults()`）
- 动态调整检索数量（`adjustRagConfig()`）：
  - 短输入（<=6 词）：增加检索量
  - 长输入（>=60 词）：减少检索量

---

## 五、上下文组装顺序

每次调 LLM 前，上下文按以下顺序拼入（`chatOrchestrator.ts` 的 `buildContextMessages()`）：

```
1. [对话摘要]           -- 来自 SQLite 的上文对话摘要
   [CONVERSATION_SUMMARY_START] ... [CONVERSATION_SUMMARY_END]

2. [情感上下文]         -- 临时情感状态标注（一次性使用）
   [SYSTEM_NOTE: Based on our recent interaction, the user's emotional state seems to be: ...]

3. [相关思维]           -- 从 HNSW 索引检索的历史相关思维
   Relevant thoughts from our past conversation (for context):
   - ...

4. [RAG 规则 + 文档片段] -- 如果启用 RAG，注入相关文档摘录
   RAG_RULES:
   - Use the document excerpts below when they are relevant.
   - Cite sources inline like [filename#pX].
   - If the answer is not in the excerpts, say you could not find it.

   Relevant excerpts from user's documents (cite when used):
   - [source] (Section: ...) snippet...

5. [聊天历史]           -- 最近 N 条消息（由 MAX_HISTORY_MESSAGES_FOR_API 控制）

6. [系统指令]           -- 核心行为 + 人格提示词（作为 instructions 参数）
```

### 上下文窗口管理

- **对话截断**：`MAX_HISTORY_MESSAGES_FOR_API` 控制发送的历史消息数量
- **OpenAI 自动截断**：使用 `truncation: 'auto'`，让 OpenAI 自动管理上下文窗口
- **Response ID 链式续接**：通过 `previous_response_id` 实现对话连续性（OpenAI 特有），非 OpenAI 提供商则每次发送完整历史

---

## 六、工具/函数调用系统

### 6.1 工具定义

- Schema 定义：`resources/functions.json` — 包含 20 个预定义工具的 JSON Schema
- 工具注册：`src/utils/assistantTools.ts` — 从 `functions.json` 加载 schema

### 6.2 内置工具列表

| 工具名 | 功能 | 实现位置 |
|---|---|---|
| `get_current_datetime` | 获取当前时间 | `functionCaller.ts` |
| `open_path` | 打开文件/文件夹/URL | `utils/functions/filesystem.ts` |
| `manage_clipboard` | 剪贴板操作 | `utils/functions/clipboard.ts` |
| `save_memory` | 保存长期记忆 | `functionCaller.ts` |
| `recall_memories` | 回忆长期记忆 | `functionCaller.ts` |
| `delete_memory` | 删除长期记忆 | `functionCaller.ts` |
| `list_directory` | 列出目录内容 | `utils/functions/filesystem.ts` |
| `execute_command` | 执行系统命令 | `utils/functions/filesystem.ts` |
| `search_torrents` | 搜索种子 | `utils/functions/torrent.ts` |
| `add_torrent_to_qb` | 添加种子到 qBittorrent | `utils/functions/torrent.ts` |
| `get_calendar_events` | 获取日历事件 | `utils/functions/calendar.ts` |
| `create_calendar_event` | 创建日历事件 | `utils/functions/calendar.ts` |
| `update_calendar_event` | 更新日历事件 | `utils/functions/calendar.ts` |
| `delete_calendar_event` | 删除日历事件 | `utils/functions/calendar.ts` |
| `get_unread_emails` | 获取未读邮件 | `functionCaller.ts` |
| `search_emails` | 搜索邮件 | `functionCaller.ts` |
| `get_email_content` | 获取邮件内容 | `functionCaller.ts` |
| `browser_context` | 浏览器上下文获取 | `functionCaller.ts` |
| `schedule_task` | 创建定时任务 | `utils/functions/calendar.ts` |
| `manage_scheduled_tasks` | 管理定时任务 | `utils/functions/calendar.ts` |
| `perform_web_search` | Metaso 网络搜索 | `functionCaller.ts` |
| `searxng_web_search` | SearXNG 搜索 | `functionCaller.ts` |

### 6.3 工具调用完整流程

#### 第一步：流中检测工具调用（`streamHandler.ts`）

LLM 返回的是流式事件，`streamHandler` 逐事件处理：

```
response.function_call_arguments.delta → 把 delta 拼进 functionCallArgsBuffer

response.output_item.done && item.type === 'function_call'
  → JSON.parse 拼好的参数
  → addToolCall(payload)     // 记录到历史
  → handleToolCall(payload)  // 交给 toolCallHandler
  → return（退出当前流处理）
```

关键点：检测到工具调用后，**当前流直接 return**，把控制权交给 `toolCallHandler`。

#### 第二步：执行工具并继续对话（`toolCallHandler.ts`）

```
① 显示状态消息
   → getToolStatusMessage() 生成如 "正在查日历..." 的提示
   → addSystemMessage() 插入到聊天历史

② 执行工具函数
   → executeFunction(functionName, functionArgs)
   → 失败则捕获错误，返回错误字符串（不会中断流程）

③ 把工具结果加入聊天历史
   → addToolMessage({ toolCallId, functionName, content: resultString })

④ 重新构建 API 输入
   → buildApiInput() 把完整历史（含工具结果）转为 API 格式

⑤ 创建占位消息 + 发起新的 LLM 请求
   → createAssistantPlaceholder()  // UI 上先占个位
   → createOpenAIResponse(nextApiInput, responseId, ...)  // 再调一次 LLM
   → processStream(stream)  // 处理新的流式响应

⑥ 错误恢复
   → 如果 previous_response_id 找不到（服务端已过期）
   → 清空 responseId，不带上一次 ID 重试
```

核心思路：**工具执行完后，把结果塞回历史，再调一次 LLM，让模型基于工具结果继续生成回复**。这就是 OpenAI Function Calling 的标准模式。

#### 第三步：具体函数执行（`functionCaller.ts`）

`executeFunction()` 是统一入口：

```
① 查内置注册表 functionRegistry（20 个内置工具）

② 找不到 → 查自定义工具
   → customToolsStore.toolsByName[name]
   → 通过 IPC 调用 Electron 主进程执行

③ 参数校验
   → 根据 functionSchemas 检查 required 字段
   → 缺参数直接返回错误，不执行

④ 执行函数
   → func(args) 返回 { success, data/error }

⑤ 格式化返回
   → 成功：JSON.stringify(result.data)
   → 失败：错误字符串
```

#### 完整调用链

```
LLM 流式响应
    │
    ▼
streamHandler 检测到 function_call 事件
    │  收集参数 delta → JSON.parse
    │
    ▼
toolCallHandler.handleToolCall()
    │  ① 显示 "正在执行..."
    │  ② executeFunction(name, args)
    │  ③ 工具结果 → addToolMessage()
    │  ④ buildApiInput() 重建完整上下文
    │  ⑤ createOpenAIResponse() ← 再调一次 LLM
    │  ⑥ processStream() ← 处理新响应（可能又触发工具调用）
    │
    ▼
functionCaller.executeFunction()
    │  查 functionRegistry → 校验参数 → 执行 → 返回结果
    │
    ▼
结果回到 LLM → 模型基于工具结果生成最终回复
```

注意第 ⑤ 步又调了 `processStream()`，所以这是一个**递归结构** — 如果 LLM 第二次回复又要调工具，整个流程会再走一遍，直到 LLM 给出纯文本回复为止。

---

## 七、多 LLM 提供商支持

### 7.1 支持的提供商

| 提供商 | API 类型 |
|---|---|
| `openai` | Responses API |
| `codex` | Responses API |
| `openrouter` | Chat Completions API |
| `ollama` | Chat Completions API |
| `lm-studio` | Chat Completions API |
| `zai` | Chat Completions API |
| `minimax` | Chat Completions API |
| `deepseek` | Chat Completions API |
| `dashscope` | Chat Completions API |

### 7.2 提供商适配器

每个提供商有独立的适配器文件（如 `openai.ts`、`openrouter.ts`、`ollama.ts` 等），统一通过 `apiService.ts` 的 `createOpenAIResponse()` 分发。

---

## 八、外部依赖库

| 库 | 版本 | 用途 |
|---|---|---|
| `openai` | ^6.33.0 | OpenAI SDK（Responses API + Chat Completions API） |
| `groq-sdk` | ^1.3.0 | Groq SDK（Whisper STT） |
| `vue` | ^3.5.26 | 前端 UI 框架 |
| `pinia` | ^3.0.3 | 状态管理 |
| `electron` | ^28.3.3 | 桌面应用框架 |
| `better-sqlite3` | ^9.6.0 | 本地 SQLite 数据库（记忆、思维、摘要存储） |
| `hnswlib-node` | ^2.0.0 | HNSW 向量索引（思维检索） |
| `axios` | ^1.16.1 | HTTP 客户端 |
| `ws` | ^8.19.0 | WebSocket 服务器（浏览器上下文工具） |
| `googleapis` | ^166.0.0 | Google API（Calendar、Gmail） |
| `marked` | ^15.0.11 | Markdown 解析 |
| `dompurify` | ^3.3.0 | HTML 净化 |
| `cheerio` | ^1.0.0-rc.12 | HTML 解析 |
| `pdfjs-dist` | ^5.7.284 | PDF 解析（RAG） |
| `mammoth` | ^1.12.0 | DOCX 解析（RAG） |
| `turndown` | ^7.2.4 | HTML 转 Markdown |
| `node-cron` | ^4.2.1 | 定时任务调度 |
| `@ricky0123/vad-web` | ^0.0.24 | 语音活动检测 (VAD) |
| `electron-updater` | ^6.6.2 | 自动更新 |
| `electron-log` | ^5.4.3 | 日志 |

---

## 九、数据存储位置

所有数据存储在 Electron 的 `userData` 目录下，Windows 路径为：

```
C:\Users\<用户名>\AppData\Roaming\leshine-ai-app\
```

### 9.1 文件清单

| 文件名 | 来源代码 | 存储内容 |
|---|---|---|
| `leshine-settings.json` | `settingsManager.ts` | 所有用户设置（含 API Key，明文存储） |
| `leshine-thoughts.sqlite` | `thoughtVectorStore.ts` | 思维向量、对话摘要、长期记忆 |
| `leshine-thoughts-hnsw-openai.index` | `thoughtVectorStore.ts` | OpenAI 1536 维 HNSW 索引 |
| `leshine-thoughts-hnsw-local.index` | `thoughtVectorStore.ts` | 本地 MiniLM 384 维 HNSW 索引 |
| `leshine-rag.sqlite` | `ragDocumentStore.ts` | RAG 文档分片 + 向量 |
| `leshine-rag-hnsw-local.index` | `ragDocumentStore.ts` | RAG 文档的 HNSW 索引 |
| `leshine-rag-hnsw-local.meta.json` | `ragDocumentStore.ts` | RAG 索引元数据 |

### 9.2 SQLite 数据库表结构（`leshine-thoughts.sqlite`）

| 表名 | 用途 |
|---|---|
| `thoughts` | 历史对话思维，含 embedding 向量字段 |
| `conversation_summaries` | 对话摘要（summary_text、created_at 等） |
| `memories` | 长期记忆（AI 通过 `save_memory` 工具主动写入的） |

注意：**长期记忆和思维向量共用同一个 SQLite 文件**，`memoryManager.ts` 直接复用了 `thoughtVectorStore` 的 `getDBInstance()`，没有单独建库。

### 9.3 安全提醒

`leshine-settings.json` 中所有 API Key 都是**明文存储**，没有加密。需要注意保密，不要随便分享或上传。

---

## 十、提示词文件清单

项目中所有提示词分散在以下位置：

### 主对话 System Prompt

| 文件 | 内容 |
|---|---|
| `src/prompts/coreSystemPrompt.ts` | 核心行为规则（4 条，不可改） |
| `src/prompts/defaultPersonaPrompt.ts` | 默认人格（首次启动写入配置） |
| `src/prompts/systemPrompt.ts` | 拼接函数 |

### 摘要/情感分析提示词

| 位置 | 用途 |
|---|---|
| `settingsStore.ts` 中 `DEFAULT_SUMMARIZATION_SYSTEM_PROMPT` | 对话摘要生成提示词 |
| `apiService.ts` 中 `createContextAnalysisResponse` 函数内硬编码 | 情感分析提示词 |

### 上下文注入提示词模板

都在 `chatOrchestrator.ts` 中：

| 位置 | 提示词片段 | 作用 |
|---|---|---|
| `buildContextMessages()` | `[CONVERSATION_SUMMARY_START]...[END]` | 对话摘要标记 |
| `buildContextMessages()` | `[SYSTEM_NOTE: ...emotional state...]` | 情感状态标注 |
| `buildThoughtsBlock()` | `Relevant thoughts from our past conversation` | 历史思维检索结果 |
| `buildRagRulesBlock()` | `RAG_RULES: - Use the document excerpts...` | RAG 使用规则 |
| `buildRagBlock()` | `Relevant excerpts from user's documents` | RAG 文档片段 |
