import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { AIConfig, ChatTurn } from '../shared/constants'

interface DeltaPayload {
  requestId: string
  text: string
}

/**
 * 白名单 IPC —— 渲染进程只能看到这里暴露的方法。
 * API Key 只走 key:set 单向传入主进程，之后渲染进程再也读不到它。
 */
const api = {
  appInfo: () =>
    ipcRenderer.invoke('app:info') as Promise<{
      version: string
      dataDir: string
      isPackaged: boolean
    }>,
  platform: process.platform,
  ai: {
    setKey: (key: string) => ipcRenderer.invoke('key:set', key) as Promise<boolean>,
    hasKey: () => ipcRenderer.invoke('key:has') as Promise<boolean>,
    chat: (payload: { requestId: string; config: AIConfig; messages: ChatTurn[] }) =>
      ipcRenderer.invoke('ai:chat', payload) as Promise<{
        ok: boolean
        text: string
        aborted?: boolean
        error?: string
      }>,
    abort: (requestId: string) => ipcRenderer.invoke('ai:abort', requestId) as Promise<boolean>,
    listModels: (config: AIConfig) =>
      ipcRenderer.invoke('ai:models', config) as Promise<{
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
