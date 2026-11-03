import { BrowserWindow, screen, shell, protocol } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

if (!process.env.APP_ROOT) {
  process.env.APP_ROOT = path.join(__dirname, '../..')
}

export function getMainDist(): string {
  return path.join(process.env.APP_ROOT!, 'dist-electron')
}

export function getRendererDist(): string {
  return path.join(process.env.APP_ROOT!, 'dist')
}

export function getVitePublic(): string {
  return process.env.VITE_DEV_SERVER_URL
    ? path.join(process.env.APP_ROOT!, 'public')
    : getRendererDist()
}

export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

const IS_DEV = !!VITE_DEV_SERVER_URL

function getPreloadPath(): string {
  return path.join(__dirname, '../preload/index.mjs')
}

function getIndexHtmlPath(): string {
  return path.join(getRendererDist(), 'index.html')
}

let win: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let dashboardWindow: BrowserWindow | null = null

export function getMainWindow(): BrowserWindow | null {
  return win
}

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow
}

export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow
}

export async function createMainWindow(): Promise<BrowserWindow> {
  win = new BrowserWindow({
    title: 'Leshine',
    icon: path.join(getVitePublic(), 'app_logo.png'),
    transparent: true,
    frame: false,
    width: 500,
    height: 500,
    resizable: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: getPreloadPath(),
      offscreen: false,
      backgroundThrottling: false,
      webSecurity: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(getIndexHtmlPath())
  }

  win.on('closed', () => {
    win = null
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send(
      'main-process-message',
      `Leshine ready at ${new Date().toLocaleString()}`
    )
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  return win
}

export async function createOverlayWindow(): Promise<BrowserWindow> {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  overlayWindow = new BrowserWindow({
    width,
    height,
    transparent: false,
    frame: false,
    alwaysOnTop: true,
    fullscreen: false,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    backgroundColor: '#000000',
    show: false,
    paintWhenInitiallyHidden: true,
    webPreferences: {
      preload: getPreloadPath(),
      offscreen: false,
      backgroundThrottling: false,
      webSecurity: false,
    },
  })

  const arg = 'overlay'
  if (VITE_DEV_SERVER_URL) {
    await overlayWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`)
  } else {
    await overlayWindow.loadFile(getIndexHtmlPath(), { hash: arg })
  }

  overlayWindow.hide()

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })

  return overlayWindow
}

export async function showOverlay(): Promise<boolean> {
  if (!overlayWindow) {
    await createOverlayWindow()
  }

  const currentOverlayWindow = overlayWindow
  if (!currentOverlayWindow) return false

  currentOverlayWindow.setOpacity(0.35)
  currentOverlayWindow.show()
  currentOverlayWindow.focus()
  currentOverlayWindow.webContents.send('overlay-shown')

  return true
}

export function hideOverlay(): boolean {
  overlayWindow?.hide()
  win?.webContents.send('overlay-closed')
  return true
}

export function setOverlayOpacity(opacity: number): boolean {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return false
  }
  overlayWindow.setOpacity(opacity)
  return true
}

export function resizeMainWindow(width: number, height: number): void {
  if (win) {
    win.setSize(width, height)
  }
}

export function minimizeMainWindow(minimize: boolean): void {
  if (!win) return

  const display = screen.getPrimaryDisplay()
  if (minimize) {
    const x = display.bounds.width - 230
    const y = display.bounds.height - 260
    win.setPosition(x, y)
    win.setSize(210, 210)
  } else {
    const x = Math.round(display.bounds.width / 2 - 250)
    const y = Math.round(display.bounds.height / 2 - 250)
    win.setPosition(x, y)
    win.setSize(500, 500)
  }
}

// 保存原始窗口大小和位置，用于恢复
let originalWindowBounds: { x: number; y: number; width: number; height: number } | null = null

export function maximizeMainWindow(): boolean {
  if (!win) return false

  // 保存当前窗口状态
  if (!originalWindowBounds) {
    const bounds = win.getBounds()
    originalWindowBounds = bounds
  }

  // 最大化窗口
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  win.setBounds({ x: 0, y: 0, width, height })
  return true
}

export function unmaximizeMainWindow(): boolean {
  if (!win) return false

  // 恢复原始窗口大小
  if (originalWindowBounds) {
    win.setBounds(originalWindowBounds)
    originalWindowBounds = null
  }
  return true
}

export function focusMainWindow(): boolean {
  if (win && !win.isDestroyed()) {
    win.show()
    win.focus()
    win.moveTop()
    console.log('[WindowManager] Main window focused')
    return true
  }
  return false
}

export async function createSettingsWindow(): Promise<BrowserWindow> {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show()
    settingsWindow.focus()
    return settingsWindow
  }

  settingsWindow = new BrowserWindow({
    title: 'Leshine Settings',
    icon: path.join(getVitePublic(), 'app_logo.png'),
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    frame: false,
    resizable: true,
    alwaysOnTop: false,
    parent: win || undefined,
    modal: false,
    backgroundColor: '#1f2937',
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      offscreen: false,
      backgroundThrottling: false,
      webSecurity: false,
    },
  })

  const arg = 'settings'
  if (VITE_DEV_SERVER_URL) {
    await settingsWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`)
  } else {
    await settingsWindow.loadFile(getIndexHtmlPath(), { hash: arg })
  }

  settingsWindow.show()
  settingsWindow.focus()

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })

  settingsWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  return settingsWindow
}

export function closeSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close()
  }
}

export function getDashboardWindow(): BrowserWindow | null {
  return dashboardWindow
}

export async function createDashboardWindow(params: {
  modules?: string[]
  filters?: object
}): Promise<BrowserWindow> {
  // 如果已存在，先显示并聚焦
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.show()
    dashboardWindow.focus()
    // 发送更新参数
    dashboardWindow.webContents.send('dashboard:update', params)
    return dashboardWindow
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  dashboardWindow = new BrowserWindow({
    title: 'Leshine Dashboard',
    icon: path.join(getVitePublic(), 'app_logo.png'),
    width: Math.floor(width * 0.9),
    height: Math.floor(height * 0.9),
    minWidth: 800,
    minHeight: 600,
    frame: false,
    transparent: false,
    alwaysOnTop: false,
    resizable: true,
    fullscreenable: true,
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      offscreen: false,
      backgroundThrottling: false,
      webSecurity: false,
    },
  })

  const arg = 'dashboard'
  if (VITE_DEV_SERVER_URL) {
    await dashboardWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`)
  } else {
    await dashboardWindow.loadFile(getIndexHtmlPath(), { hash: arg })
  }

  // 传递初始参数
  dashboardWindow.webContents.on('did-finish-load', () => {
    dashboardWindow?.webContents.send('dashboard:init', params)
  })

  // 监听全屏状态变化
  dashboardWindow.on('enter-full-screen', () => {
    dashboardWindow?.webContents.send('dashboard:fullscreen-change', true)
  })
  dashboardWindow.on('leave-full-screen', () => {
    dashboardWindow?.webContents.send('dashboard:fullscreen-change', false)
  })

  dashboardWindow.show()
  dashboardWindow.setFullScreen(true)
  dashboardWindow.focus()

  dashboardWindow.on('closed', () => {
    dashboardWindow = null
    win?.webContents.send('dashboard-closed')
  })

  return dashboardWindow
}

export function closeDashboard(): boolean {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.close()
    return true
  }
  return false
}

export function cleanupWindows(): void {
  win = null
  overlayWindow = null
  settingsWindow = null
  dashboardWindow = null
}

export function registerCustomProtocol(
  generatedImagesPath: string,
  customAvatarsPath?: string
): void {
  protocol.registerFileProtocol('leshine-image', (request, callback) => {
    const url = request.url.substring('leshine-image://'.length)
    const decodedUrlPath = decodeURIComponent(url)
    const filePath = path.normalize(
      path.join(generatedImagesPath, decodedUrlPath)
    )

    if (filePath.startsWith(path.normalize(generatedImagesPath))) {
      callback({ path: filePath })
    } else {
      console.error(
        `[Protocol] Denied access to unsafe path: ${filePath} from URL: ${request.url}`
      )
      callback({ error: -6 })
    }
  })

  if (customAvatarsPath) {
    protocol.registerFileProtocol('leshine-avatar', (request, callback) => {
      const url = request.url.substring('leshine-avatar://'.length)
      const decodedUrlPath = decodeURIComponent(url)
      const filePath = path.normalize(
        path.join(customAvatarsPath, decodedUrlPath)
      )

      if (filePath.startsWith(path.normalize(customAvatarsPath))) {
        callback({ path: filePath })
      } else {
        console.error(
          `[Protocol] Denied avatar access to unsafe path: ${filePath} from URL: ${request.url}`
        )
        callback({ error: -6 })
      }
    })
  }
}
