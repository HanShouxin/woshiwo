import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { registerAiIpc } from './ai'

// 文本类桌面工具不需要 GPU 合成：省电，并避免驱动/远程桌面/受限环境下的 GPU 进程崩溃。
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-gpu-compositing')
app.commandLine.appendSwitch('disable-gpu-sandbox')
app.disableHardwareAcceleration()

/**
 * 数据目录（便携优先）—— 评审 #10 定案。
 * 便携版的语义是"拷贝文件夹即带走数据"，所以打包后数据落在程序目录/data，
 * 开发期落在项目根/.data。绝不与 %APPDATA% 混用，避免两份程序互相污染。
 */
function resolveUserDataDir(): string {
  if (!app.isPackaged) return join(app.getAppPath(), '.data')
  return join(dirname(process.execPath), 'data')
}

// 单实例锁（评审 #3）：两个实例共用同一个 IndexedDB 目录会损坏数据。
const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  const dataDir = resolveUserDataDir()
  mkdirSync(dataDir, { recursive: true })
  // 必须在 ready 之前设置，否则 Chromium 已经按默认路径建库
  app.setPath('userData', dataDir)

  let mainWindow: BrowserWindow | null = null

  function createWindow(): void {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 840,
      minWidth: 960,
      minHeight: 640,
      show: false,
      backgroundColor: '#FBFAF8',
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    mainWindow.once('ready-to-show', () => {
      mainWindow?.show()
    })

    mainWindow.on('closed', () => {
      mainWindow = null
    })

    // 外链一律交给系统浏览器，绝不在应用内开新窗口
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://')) void shell.openExternal(url)
      return { action: 'deny' }
    })

    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (devUrl) {
      void mainWindow.loadURL(devUrl)
    } else {
      void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
  }

  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  void app.whenReady().then(() => {
    ipcMain.handle('app:info', () => ({
      version: app.getVersion(),
      dataDir,
      isPackaged: app.isPackaged
    }))

    registerAiIpc()

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
