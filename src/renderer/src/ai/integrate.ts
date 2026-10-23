import { db } from '../db/db'
import { getSetting, newId, now, setSetting } from '../db/repo'
import { listMessages, listSessions } from '../db/chatRepo'
import { startChat } from './client'
import type { AIConfigEntry, MemoryType } from '../../../shared/constants'

/**
 * 「启动即消化」（定稿 §6.6）：
 * 聊天时零后台任务；应用启动后静默把上次未整合的对话提炼成长期记忆与会话摘要。
 * 规则：
 * - 只在模型配置完成后才启动；没配模型 → 直接返回，游标不动；
 * - 失败静默，下次启动重试；
 * - 游标按会话记录「已整合到第几条 seq」，只前进不后退。
 */

type CursorMap = Record<string, number>

const CURSOR_KEY = 'integrationCursorMap'

export type IntegrationStatus = 'idle' | 'running'

let status: IntegrationStatus = 'idle'
const listeners = new Set<() => void>()

function setStatus(next: IntegrationStatus): void {
  status = next
  listeners.forEach((listener) => listener())
}

export function subscribeIntegration(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getIntegrationStatus(): IntegrationStatus {
  return status
}

function toMemoryType(value: unknown): MemoryType {
  return value === 'preference' || value === 'decision' ? value : 'fact'
}

interface IntegrationResult {
  memories: Array<{ content: string; type?: unknown }>
  summary?: string
}

/** 从模型输出里抠出 JSON（模型偶尔会包代码块或加一句话） */
function parseIntegration(text: string): IntegrationResult | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const json = JSON.parse(match[0]) as {
      memories?: unknown
      summary?: unknown
    }
    const rawList = Array.isArray(json.memories) ? json.memories : []
    const memories = rawList
      .map((item) => item as { content?: unknown; type?: unknown })
      .filter((item) => typeof item.content === 'string' && item.content.trim().length > 0)
      .map((item) => ({ content: String(item.content).trim(), type: item.type }))
    const summary = typeof json.summary === 'string' ? json.summary.trim() : undefined
    return { memories, summary }
  } catch {
    return null
  }
}

function buildPrompt(transcript: string): string {
  return `从下面这段对话里，提炼值得长期记住的信息。

${transcript}

只输出严格的 JSON，不要代码块、不要任何解释：
{"memories":[{"content":"关于用户的事实/偏好/决定，一句话","type":"fact|preference|decision"}],"summary":"这段对话的进展，一句话"}

要求：
- memories 最多 2 条，只保留以后还有用、且不会很快过时的信息；
- 不要把一次性的情绪或临时状态当成长期事实；
- 没有值得提炼的就给空数组。`
}

export async function runStartupIntegration(): Promise<void> {
  if (status === 'running') return

  try {
    const configs = await getSetting<AIConfigEntry[]>('aiConfigs', [])
    const activeId = await getSetting<string>('activeConfigId', '')
    const config = configs.find((item) => item.id === activeId) ?? configs[0]
    // 没配模型：跳过，游标保持不动，等配好之后的某次启动再补
    if (!config?.model || !config.baseUrl) return

    const sessions = (await listSessions()).filter((item) => item.kind === 'normal').slice(0, 3)
    if (sessions.length === 0) return

    const cursorMap = await getSetting<CursorMap>(CURSOR_KEY, {})
    const hasPending = await Promise.all(
      sessions.map(async (session) => {
        const messages = await listMessages(session.id)
        return messages.filter((message) => message.seq > (cursorMap[session.id] ?? 0)).length
      })
    )
    if (hasPending.every((count) => count < 2)) return

    setStatus('running')

    for (const session of sessions) {
      const messages = await listMessages(session.id)
      const lastSeq = cursorMap[session.id] ?? 0
      const pending = messages.filter(
        (message) => message.seq > lastSeq && message.status !== 'streaming'
      )
      if (pending.length < 2) continue

      const transcript = pending
        .slice(-30)
        .map(
          (message) =>
            `${message.role === 'user' ? '用户' : 'AI'}：${message.content.slice(0, 600)}`
        )
        .join('\n\n')

      const handle = startChat({
        config,
        configId: config.id,
        messages: [{ role: 'user', content: buildPrompt(transcript) }]
      })
      const result = await handle.done
      if (!result.ok) continue

      const parsed = parseIntegration(result.text)
      if (!parsed) continue

      const timestamp = now()
      for (const memory of parsed.memories.slice(0, 2)) {
        await db.memories.add({
          id: newId(),
          content: memory.content.slice(0, 160),
          type: toMemoryType(memory.type),
          status: 'valid',
          source: 'auto',
          sessionId: session.id,
          createdAt: timestamp,
          updatedAt: timestamp
        })
      }

      const maxSeq = pending[pending.length - 1].seq
      if (parsed.summary) {
        await db.sessionSummaries.add({
          id: newId(),
          sessionId: session.id,
          content: parsed.summary.slice(0, 240),
          coversUpToSeq: maxSeq,
          createdAt: timestamp,
          updatedAt: timestamp
        })
      }

      cursorMap[session.id] = maxSeq
      await setSetting(CURSOR_KEY, cursorMap)
    }
  } catch {
    // 静默失败：下次启动再试，绝不打扰用户
  } finally {
    setStatus('idle')
  }
}
