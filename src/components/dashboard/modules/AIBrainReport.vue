<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useDashboardDataStore } from '../../../stores/dashboardDataStore'
import { messageMarkdown } from '../../../utils/markdown'

const dataStore = useDashboardDataStore()

const REPORT_TITLES: Record<string, string> = {
  cddWeeklyReport: 'CDD 周报',
  pfpAssessment: 'PFP 考核',
  isgAlert: 'ISG 订单预警',
  signingAlert: '签收异常预警',
}

const focusedReport = computed(() => dataStore.focusedAIReport)

const reportTitle = computed(() => {
  const key = focusedReport.value
  return key ? (REPORT_TITLES[key] || key) : 'AI 大脑'
})

// 从数据中提取内容
function extractContent(data: any): any {
  if (!data) return null
  if (typeof data === 'string') return data
  if (typeof data === 'object') {
    if (data.data) return data.data
    if (data.content) return data.content
    if (data.markdown) return data.markdown
    if (data.text) return data.text
  }
  return data
}

// 判断是否为 HTML 内容
function isHtmlContent(data: any): boolean {
  if (typeof data !== 'string') return false
  return data.includes('<') && data.includes('>') && (
    data.includes('<html') || data.includes('<body') ||
    data.includes('<div') || data.includes('<table')
  )
}

// 数组转 markdown 表格
function arrayToMarkdown(arr: any[]): string {
  if (!arr || arr.length === 0) return '暂无数据'
  if (typeof arr[0] === 'string') {
    return arr.map((item, idx) => `${idx + 1}. ${item}`).join('\n\n')
  }
  const headers = Object.keys(arr[0])
  if (headers.length === 0) return '暂无数据'
  let md = '| ' + headers.join(' | ') + ' |\n'
  md += '| ' + headers.map(() => '---').join(' | ') + ' |\n'
  for (const row of arr) {
    const cells = headers.map(h => {
      const val = row[h]
      if (val === null || val === undefined) return '-'
      if (typeof val === 'object') return JSON.stringify(val)
      return String(val)
    })
    md += '| ' + cells.join(' | ') + ' |\n'
  }
  return md
}

// ========== HTML → 暗色主题 HTML ==========
function convertToDarkTheme(html: string): string {
  let result = html

  // 移除 <style>/<script>/<html>/<head>/<body>/<meta>/<link>/<title> 标签
  result = result.replace(/<style[\s\S]*?<\/style>/gi, '')
  result = result.replace(/<script[\s\S]*?<\/script>/gi, '')
  result = result.replace(/<\/?(html|head|meta|link|title)[^>]*>/gi, '')
  // 保留 body 内容但移除 body 标签
  result = result.replace(/<\/?body[^>]*>/gi, '')

  // 替换背景色：白色/浅色 → 暗色
  // background-color: #fff / #ffffff / white / rgb(255,...)
  result = result.replace(/background-color\s*:\s*#fff\b[^;"]*/gi, 'background-color: #1a2744')
  result = result.replace(/background-color\s*:\s*#ffffff\b[^;"]*/gi, 'background-color: #1a2744')
  result = result.replace(/background-color\s*:\s*white\b[^;"]*/gi, 'background-color: #1a2744')
  result = result.replace(/background-color\s*:\s*rgb\([^)]*255[^)]*\)[^;"]*/gi, 'background-color: #1a2744')

  // 替换浅色背景
  result = result.replace(/background-color\s*:\s*#f[0-9a-f]{5}\b[^;"]*/gi, 'background-color: rgba(99, 102, 241, 0.08)')
  result = result.replace(/background-color\s*:\s*#e[0-9a-f]{5}\b[^;"]*/gi, 'background-color: rgba(99, 102, 241, 0.12)')

  // background 简写
  result = result.replace(/(?<!-)background\s*:\s*#fff\b[^;"]*/gi, 'background: #1a2744')
  result = result.replace(/(?<!-)background\s*:\s*#ffffff\b[^;"]*/gi, 'background: #1a2744')
  result = result.replace(/(?<!-)background\s*:\s*white\b[^;"]*/gi, 'background: #1a2744')
  result = result.replace(/(?<!-)background\s*:\s*#[fF][0-9a-f]{5}\b[^;"]*/gi, 'background: rgba(99, 102, 241, 0.08)')
  result = result.replace(/(?<!-)background\s*:\s*#[eE][0-9a-f]{5}\b[^;"]*/gi, 'background: rgba(99, 102, 241, 0.12)')

  // bgcolor 属性
  result = result.replace(/bgcolor\s*=\s*["']?#fff\b[^"']*/gi, 'bgcolor="#1a2744"')
  result = result.replace(/bgcolor\s*=\s*["']?#ffffff\b[^"']*/gi, 'bgcolor="#1a2744"')
  result = result.replace(/bgcolor\s*=\s*["']?white\b[^"']*/gi, 'bgcolor="#1a2744"')

  // 替换文字颜色：深色 → 浅色（确保暗色背景下可读）
  result = result.replace(/color\s*:\s*#1[0-9a-f]{5}\b[^;"]*/gi, 'color: #e0e6ed')
  result = result.replace(/color\s*:\s*#2[0-9a-f]{5}\b[^;"]*/gi, 'color: #e0e6ed')
  result = result.replace(/color\s*:\s*#3[0-9a-f]{5}\b[^;"]*/gi, 'color: #c9d1d9')
  result = result.replace(/color\s*:\s*#4[0-9a-f]{5}\b[^;"]*/gi, 'color: #c9d1d9')
  result = result.replace(/color\s*:\s*#[0-4][0-9a-f]{5}\b[^;"]*/gi, 'color: #c9d1d9')

  // 保留有意义的颜色（红色/绿色/橙色等标记色）
  // 这些不需要替换，保留原样

  // 边框颜色：浅色边框 → 暗色边框
  result = result.replace(/border[^:]*:\s*[^;]*#[d-f][0-9a-f]{5}\b[^;"]*/gi, (match) => {
    return match.replace(/#[d-f][0-9a-f]{5}/gi, 'rgba(99, 102, 241, 0.2)')
  })

  // box-shadow：替换为暗色阴影
  result = result.replace(/box-shadow\s*:[^;"]*/gi, 'box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3)')

  return result
}

// ========== 数据计算 ==========
const rawContent = computed(() => {
  const key = focusedReport.value
  if (!key) return null
  const cargoBannerData = dataStore.moduleData['cargoBanner']
  return extractContent(cargoBannerData?.[key])
})

const isHtml = computed(() => isHtmlContent(rawContent.value))
const isArray = computed(() => Array.isArray(rawContent.value))

// 最终渲染的 HTML
const renderedHtml = computed(() => {
  const content = rawContent.value
  if (!content) return ''

  if (isHtml.value) {
    return convertToDarkTheme(typeof content === 'string' ? content : '')
  }

  // 非 HTML：走 markdown
  let text = ''
  if (isArray.value) {
    text = arrayToMarkdown(content as any[])
  } else if (typeof content === 'string') {
    text = content
  } else if (typeof content === 'object') {
    text = '```json\n' + JSON.stringify(content, null, 2) + '\n```'
  }
  return messageMarkdown(text)
})

const hasData = computed(() => {
  return rawContent.value != null && !(Array.isArray(rawContent.value) && rawContent.value.length === 0)
})

// ========== 自动轮播滚动 ==========
const viewportRef = ref<HTMLElement | null>(null)
const isPaused = ref(false)
const isScrolling = ref(false)
const phase = ref<'scrolling' | 'returning'>('scrolling')

let scrollIntervalId: ReturnType<typeof setInterval> | null = null
const SCROLL_STEP_DOWN = 1  // 每次滚动的像素数
const SCROLL_STEP_UP = 20   // 回顶时每次滚动的像素数
const SCROLL_INTERVAL = 30  // 滚动间隔（毫秒）
const PAUSE_DURATION = 3000
let pauseTimer: ReturnType<typeof setTimeout> | null = null

function startAutoScroll() {
  stopAutoScroll()
  phase.value = 'scrolling'

  scrollIntervalId = setInterval(() => {
    const viewport = viewportRef.value
    if (!viewport) return

    const maxScroll = viewport.scrollHeight - viewport.clientHeight

    if (maxScroll < 10) {
      // 内容不够长，不需要滚动
      return
    }

    isScrolling.value = true

    // 暂停期间不滚动
    if (isPaused.value) return

    if (phase.value === 'scrolling') {
      viewport.scrollTop += SCROLL_STEP_DOWN

      if (viewport.scrollTop >= maxScroll) {
        viewport.scrollTop = maxScroll
        isPaused.value = true
        pauseTimer = setTimeout(() => {
          isPaused.value = false
          phase.value = 'returning'
        }, PAUSE_DURATION)
      }
    } else {
      viewport.scrollTop -= SCROLL_STEP_UP

      if (viewport.scrollTop <= 0) {
        viewport.scrollTop = 0
        phase.value = 'scrolling'
      }
    }
  }, SCROLL_INTERVAL)
}

function stopAutoScroll() {
  if (scrollIntervalId !== null) {
    clearInterval(scrollIntervalId)
    scrollIntervalId = null
  }
  if (pauseTimer) {
    clearTimeout(pauseTimer)
    pauseTimer = null
  }
  isScrolling.value = false
}



watch(rawContent, async () => {
  stopAutoScroll()
  await nextTick()
  setTimeout(() => startAutoScroll(), 300)
})

onMounted(() => {
  if (hasData.value) {
    setTimeout(() => startAutoScroll(), 300)
  }
})

onUnmounted(() => {
  stopAutoScroll()
})
</script>

<template>
  <div class="ai-brain-report">
    <div class="report-header">
      <h2 class="report-title">{{ reportTitle }}</h2>
      <span class="report-badge">AI 大脑</span>
      <div class="header-spacer"></div>
      <div class="scroll-indicator" v-if="isScrolling">
        <span class="scroll-dot" :class="{ 'scroll-dot-paused': isPaused }"></span>
        <span class="scroll-text">{{ isPaused ? '已暂停' : (phase === 'scrolling' ? '↓ 滚动中' : '↑ 回顶中') }}</span>
      </div>
    </div>

    <div
      class="report-viewport"
      ref="viewportRef"
    >
      <div class="report-content" v-if="hasData" v-html="renderedHtml"></div>
      <div class="report-empty" v-else>
        <p>暂无数据</p>
        <p class="empty-hint">请先打开智能体中心页面，等待数据加载</p>
      </div>
    </div>


  </div>
</template>

<style scoped>
.ai-brain-report {
  width: 100%;
  height: calc(100vh - 80px);
  max-height: calc(100vh - 80px);
  background: linear-gradient(135deg, #0a1628 0%, #1a2744 50%, #0d1f3c 100%);
  border-radius: 12px;
  padding: 20px 24px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  color: #e0e6ed;
  font-family: 'Microsoft YaHei', 'PingFang SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.report-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(99, 102, 241, 0.3);
  flex-shrink: 0;
}

.report-title {
  font-size: 20px;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

.report-badge {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.header-spacer { flex: 1; }

.scroll-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #8b9dc3;
}

.scroll-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  animation: pulse 1.5s ease-in-out infinite;
}

.scroll-dot-paused {
  background: #f59e0b;
  animation: none;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.scroll-text { white-space: nowrap; }

/* 滚动视口 */
.report-viewport {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  border-radius: 8px;
  position: relative;
}

.report-viewport::-webkit-scrollbar { display: none; }
.report-viewport { -ms-overflow-style: none; scrollbar-width: none; }

/* 内容区域 - 确保撑开高度 */
.report-content {
  font-size: 14px;
  line-height: 1.6;
  color: #c9d1d9;
  min-height: 100%;
}

/* 覆盖 HTML 内联样式的表格 */
.report-content :deep(table) {
  width: 100%;
  border-collapse: collapse !important;
  margin: 12px 0;
  font-size: 13px;
  background: transparent !important;
}

.report-content :deep(th) {
  background: rgba(99, 102, 241, 0.2) !important;
  color: #a5b4fc !important;
  font-weight: 600;
  border: 1px solid rgba(99, 102, 241, 0.2) !important;
  padding: 10px 12px !important;
}

.report-content :deep(td) {
  border: 1px solid rgba(99, 102, 241, 0.15) !important;
  padding: 8px 12px !important;
  color: #c9d1d9 !important;
  background: transparent !important;
}

.report-content :deep(tr:nth-child(even) td) {
  background: rgba(255, 255, 255, 0.03) !important;
}

.report-content :deep(strong),
.report-content :deep(b) {
  color: #f0f0f0 !important;
}

.report-content :deep(h1),
.report-content :deep(h2),
.report-content :deep(h3),
.report-content :deep(h4) {
  color: #a5b4fc !important;
  margin: 16px 0 8px;
}

.report-content :deep(a) {
  color: #818cf8 !important;
}

.report-content :deep(blockquote) {
  border-left: 3px solid #6366f1 !important;
  padding-left: 12px !important;
  margin: 12px 0 !important;
  color: #9ca3af !important;
  background: transparent !important;
}

.report-content :deep(code) {
  background-color: rgba(99, 102, 241, 0.15) !important;
  color: #c4b5fd !important;
}

.report-content :deep(pre) {
  background-color: rgba(0, 0, 0, 0.3) !important;
  color: #d4d4d4 !important;
}

.report-content :deep(ul),
.report-content :deep(ol) {
  color: #c9d1d9 !important;
}

.report-content :deep(li) {
  color: #c9d1d9 !important;
  background: transparent !important;
}

.report-content :deep(div),
.report-content :deep(p),
.report-content :deep(span) {
  background: transparent !important;
}

/* 表格内滚动条美化 */
.report-content :deep(.table-container),
.report-content :deep([style*="overflow"]) {
  scrollbar-width: thin;
  scrollbar-color: rgba(99, 102, 241, 0.3) transparent;
}

.report-content :deep(.table-container)::-webkit-scrollbar,
.report-content :deep([style*="overflow"])::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.report-content :deep(.table-container)::-webkit-scrollbar-track,
.report-content :deep([style*="overflow"])::-webkit-scrollbar-track {
  background: transparent;
}

.report-content :deep(.table-container)::-webkit-scrollbar-thumb,
.report-content :deep([style*="overflow"])::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.3);
  border-radius: 3px;
}

.report-content :deep(.table-container)::-webkit-scrollbar-thumb:hover,
.report-content :deep([style*="overflow"])::-webkit-scrollbar-thumb:hover {
  background: rgba(99, 102, 241, 0.5);
}

/* 下载按钮文字白色 */
.report-content :deep(a[href*="download"]),
.report-content :deep(a[href*="Download"]),
.report-content :deep(button) {
  color: #fff !important;
}

.report-content :deep(a[href*="download"] span),
.report-content :deep(a[href*="Download"] span),
.report-content :deep(button span) {
  color: #fff !important;
}

.report-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #6b7280;
}

.report-empty p { margin: 4px 0; }
.empty-hint { font-size: 13px; color: #4b5563; }
</style>
