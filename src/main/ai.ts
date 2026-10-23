import { app, ipcMain, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { WebContents } from 'electron'
import type { AIConfig, ChatTurn } from '../shared/constants'

/**
 * AI 请求全部走主进程：
 * 1) 渲染进程拿不到 API Key；
 * 2) 不受渲染层 CORS / CSP 限制；
 * 3) 流式分块通过 ai:delta 事件推回渲染进程。
 */

const controllers = new Map<string, AbortController>()

function keyFile(): string {
  return join(app.getPath('userData'), 'ai-key.bin')
}

function saveKey(key: string): boolean {
  const path = keyFile()
  try {
    if (!key) {
      writeFileSync(path, Buffer.alloc(0))
      return true
    }
    if (safeStorage.isEncryptionAvailable()) {
      writeFileSync(path, safeStorage.encryptString(key))
    } else {
      // 系统不支持加密时退回本地明文文件（仅本机，不进数据库与备份）
      writeFileSync(path, Buffer.from(key, 'utf8'))
    }
    return true
  } catch (error) {
    console.error('[ai] 保存密钥失败', error)
    return false
  }
}

function loadKey(): string {
  try {
    if (!existsSync(keyFile())) return ''
    const buffer = readFileSync(keyFile())
    if (buffer.length === 0) return ''
    if (safeStorage.isEncryptionAvailable()) {
      try {
        return safeStorage.decryptString(buffer)
      } catch {
        return buffer.toString('utf8')
      }
    }
    return buffer.toString('utf8')
  } catch {
    return ''
  }
}

function trimBase(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '')
}

function chatUrl(config: AIConfig): string {
  const base = trimBase(config.baseUrl)
  if (config.provider === 'ollama' && !/\/v1$/.test(base)) return `${base}/v1/chat/completions`
  return `${base}/chat/completions`
}

function modelsUrl(config: AIConfig): string {
  const base = trimBase(config.baseUrl)
  if (config.provider === 'ollama') {
    // Ollama 的模型清单在 /api/tags（从 /v1 退回根路径）
    return `${base.replace(/\/v1$/, '')}/api/tags`
  }
  return `${base}/models`
}

interface StreamChunk {
  choices?: Array<{ delta?: { content?: string } }>
}

function sendDelta(sender: WebContents, requestId: string, text: string): void {
  if (!sender.isDestroyed()) sender.send('ai:delta', { requestId, text })
}

async function streamCompletion(
  sender: WebContents,
  requestId: string,
  config: AIConfig,
  messages: ChatTurn[]
): Promise<{ ok: boolean; text: string; aborted?: boolean; error?: string }> {
  const controller = new AbortController()
  controllers.set(requestId, controller)
  const key = loadKey()

  try {
    const response = await fetch(chatUrl(config), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { Authorization: `Bearer ${key}` } : {})
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: true,
        temperature: 0.6
      }),
      signal: controller.signal
    })

    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => '')
      return {
        ok: false,
        text: '',
        error: `HTTP ${response.status} ${detail.slice(0, 200)}`.trim()
      }
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let full = ''

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (!data || data === '[DONE]') continue
        try {
          const json = JSON.parse(data) as StreamChunk
          const delta = json.choices?.[0]?.delta?.content
          if (typeof delta === 'string' && delta.length > 0) {
            full += delta
            sendDelta(sender, requestId, delta)
          }
        } catch {
          // 单个坏块不影响整体流
        }
      }
    }

    return { ok: true, text: full }
  } catch (error) {
    if (controller.signal.aborted) return { ok: false, text: '', aborted: true }
    return { ok: false, text: '', error: String(error) }
  } finally {
    controllers.delete(requestId)
  }
}

export function registerAiIpc(): void {
  ipcMain.handle('key:set', (_event, key: string) => saveKey(key))

  ipcMain.handle('key:has', () => loadKey().length > 0)

  ipcMain.handle(
    'ai:chat',
    (event, payload: { requestId: string; config: AIConfig; messages: ChatTurn[] }) =>
      streamCompletion(event.sender, payload.requestId, payload.config, payload.messages)
  )

  ipcMain.handle('ai:abort', (_event, requestId: string) => {
    controllers.get(requestId)?.abort()
    return true
  })

  ipcMain.handle('ai:models', async (_event, config: AIConfig) => {
    const key = loadKey()
    try {
      const response = await fetch(modelsUrl(config), {
        headers: key ? { Authorization: `Bearer ${key}` } : {}
      })
      if (!response.ok) {
        return { ok: false, models: [] as string[], error: `HTTP ${response.status}` }
      }
      const json: unknown = await response.json()
      if (config.provider === 'ollama') {
        const list = (json as { models?: Array<{ name?: string }> }).models ?? []
        return { ok: true, models: list.map((item) => item.name ?? '').filter(Boolean) }
      }
      const list = (json as { data?: Array<{ id?: string }> }).data ?? []
      return { ok: true, models: list.map((item) => item.id ?? '').filter(Boolean) }
    } catch (error) {
      return { ok: false, models: [] as string[], error: String(error) }
    }
  })
}
