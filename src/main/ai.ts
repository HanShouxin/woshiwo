import { app, ipcMain, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { WebContents } from 'electron'
import type { AIConfig, ChatTurn } from '../shared/constants'

/**
 * AI 请求全部走主进程：
 * 1) 渲染进程拿不到 API Key；
 * 2) 不受渲染层 CORS / CSP 限制；
 * 3) 流式分块通过 ai:delta 事件推回渲染进程。
 *
 * Key 按配置 id 各自加密保存（一条配置一个 Key），测试连接可以用临时 Key 而不落盘。
 */

const controllers = new Map<string, AbortController>()

function keysDir(): string {
  return join(app.getPath('userData'), 'ai-keys')
}

function keyPathFor(configId: string): string {
  const safeId = configId.replace(/[^a-zA-Z0-9-]/g, '')
  return join(keysDir(), `${safeId || 'default'}.bin`)
}

/** 加密保存密钥：优先用异步 API（同步版 isEncryptionAvailable / encryptString 已弃用） */
async function saveKey(configId: string, key: string): Promise<boolean> {
  try {
    mkdirSync(keysDir(), { recursive: true })
    const path = keyPathFor(configId)
    if (!key) {
      writeFileSync(path, Buffer.alloc(0))
      return true
    }
    const available = await safeStorage.isAsyncEncryptionAvailable()
    const data = available ? await safeStorage.encryptStringAsync(key) : Buffer.from(key, 'utf8')
    writeFileSync(path, data)
    return true
  } catch (error) {
    console.error('[ai] 保存密钥失败', error)
    return false
  }
}

async function loadKey(configId: string): Promise<string> {
  try {
    const path = keyPathFor(configId)
    if (!existsSync(path)) return ''
    const buffer = readFileSync(path)
    if (buffer.length === 0) return ''

    if (await safeStorage.isAsyncEncryptionAvailable()) {
      try {
        const decoded = (await safeStorage.decryptStringAsync(buffer)) as unknown
        if (typeof decoded === 'string') return decoded
        if (Buffer.isBuffer(decoded)) return decoded.toString('utf8')
        return String(decoded)
      } catch {
        // 兼容早期用同步 API 加密的数据
        try {
          return safeStorage.decryptString(buffer)
        } catch {
          return buffer.toString('utf8')
        }
      }
    }
    return buffer.toString('utf8')
  } catch {
    return ''
  }
}

function deleteKey(configId: string): boolean {
  try {
    const path = keyPathFor(configId)
    if (existsSync(path)) unlinkSync(path)
    return true
  } catch {
    return false
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
  messages: ChatTurn[],
  apiKey: string
): Promise<{ ok: boolean; text: string; aborted?: boolean; error?: string }> {
  const controller = new AbortController()
  controllers.set(requestId, controller)

  try {
    const response = await fetch(chatUrl(config), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
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
  ipcMain.handle('key:set', (_event, configId: string, key: string) => saveKey(configId, key))

  ipcMain.handle('key:has', async (_event, configId: string) => (await loadKey(configId)).length > 0)

  // 回读已保存的 Key：供设置页回填输入框，点眼睛可查看 / 复制。
  // 只进渲染进程内存，绝不进数据库与备份。
  ipcMain.handle('key:get', (_event, configId: string) => loadKey(configId))

  ipcMain.handle('key:delete', (_event, configId: string) => deleteKey(configId))

  ipcMain.handle(
    'ai:chat',
    async (
      event,
      payload: {
        requestId: string
        config: AIConfig
        messages: ChatTurn[]
        configId?: string
        tempKey?: string
      }
    ) => {
      // 测试连接传 tempKey（临时用，不落盘）；正式对话按 configId 取已保存的 Key
      const storedKey = payload.configId ? await loadKey(payload.configId) : ''
      const apiKey = payload.tempKey?.trim() || storedKey
      return streamCompletion(event.sender, payload.requestId, payload.config, payload.messages, apiKey)
    }
  )

  ipcMain.handle('ai:abort', (_event, requestId: string) => {
    controllers.get(requestId)?.abort()
    return true
  })

  ipcMain.handle('ai:models', async (_event, payload: { config: AIConfig; configId?: string }) => {
    const apiKey = payload.configId ? await loadKey(payload.configId) : ''
    try {
      const response = await fetch(modelsUrl(payload.config), {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
      })
      if (!response.ok) {
        return { ok: false, models: [] as string[], error: `HTTP ${response.status}` }
      }
      const json: unknown = await response.json()
      if (payload.config.provider === 'ollama') {
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
