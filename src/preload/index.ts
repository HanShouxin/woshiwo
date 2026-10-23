import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { AIConfig, ChatTurn } from '../shared/constants'

interface DeltaPayload {
  requestId: string
  text: string
}

interface ChatPayload {
  requestId: string
  config: AIConfig
  messages: ChatTurn[]
  /** 正式对话：按配置 id 取已保存的 Key */
  configId?: string
  /** 测试连接：临时 Key，不落盘 */
  tempKey?: string
}

/**
 * 白名单 IPC —— 渲染进程只能看到这里暴露的方法。
 * API Key 只走单向传入主进程，之后渲染进程再也读不到它。
 */
const api = {
  appInfo: () =>
    ipcRenderer.invoke('app:info') as Promise<{
      version: string
      dataDir: string
      isPackaged: boolean
    }>,
  platform: process.platform,
  /** 标题栏跟随主题 */
  setTitleBarTheme: (theme: 'light' | 'dark') =>
    ipcRenderer.invoke('window:titlebar', theme) as Promise<boolean>,
  file: {
    saveText: (payload: { content: string; defaultName: string; extension: 'json' | 'md' }) =>
      ipcRenderer.invoke('file:saveText', payload) as Promise<{
        ok: boolean
        path?: string
        error?: string
      }>,
    openText: () =>
      ipcRenderer.invoke('file:openText') as Promise<{
        ok: boolean
        content?: string
        path?: string
        error?: string
      }>
  },
  ai: {
    setKey: (configId: string, key: string) =>
      ipcRenderer.invoke('key:set', configId, key) as Promise<boolean>,
    hasKey: (configId: string) => ipcRenderer.invoke('key:has', configId) as Promise<boolean>,
    getKey: (configId: string) => ipcRenderer.invoke('key:get', configId) as Promise<string>,
    deleteKey: (configId: string) => ipcRenderer.invoke('key:delete', configId) as Promise<boolean>,
    chat: (payload: ChatPayload) =>
      ipcRenderer.invoke('ai:chat', payload) as Promise<{
        ok: boolean
        text: string
        aborted?: boolean
        error?: string
      }>,
    abort: (requestId: string) => ipcRenderer.invoke('ai:abort', requestId) as Promise<boolean>,
    listModels: (payload: { config: AIConfig; configId?: string }) =>
      ipcRenderer.invoke('ai:models', payload) as Promise<{
        ok: boolean
        models: string[]
        error?: string
      }>,
    onDelta: (handler: (payload: DeltaPayload) => void) => {
      const listener = (_event: IpcRendererEvent, payload: DeltaPayload): void => handler(payload)
      ipcRenderer.on('ai:delta', listener)
      return () => {
        ipcRenderer.removeListener('ai:delta', listener)
      }
    }
  }
}

contextBridge.exposeInMainWorld('woshiwo', api)

export type WoshiwoApi = typeof api
