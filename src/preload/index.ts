import { contextBridge, ipcRenderer } from 'electron'

/**
 * 白名单 IPC —— 渲染进程只能看到这里暴露的方法。
 * API Key 永不经过这里（它在 Main 进程 safeStorage 里，Phase 3 接入）。
 */
const api = {
  appInfo: () => ipcRenderer.invoke('app:info') as Promise<{
    version: string
    dataDir: string
    isPackaged: boolean
  }>,
  platform: process.platform
}

contextBridge.exposeInMainWorld('woshiwo', api)

export type WoshiwoApi = typeof api
