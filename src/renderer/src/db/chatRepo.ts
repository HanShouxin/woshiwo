import { db } from './db'
import type { ChatMessage, ChatSession, MessageStatus, SourceRef } from './types'
import { newId, now } from './repo'

/** 会话与消息的存取。seq 是记忆整合游标的锚点，永远单调递增，删除不回收。 */

export const listSessions = (): Promise<ChatSession[]> =>
  db.chatSessions.orderBy('updatedAt').reverse().toArray()

export const getSession = (id: string): Promise<ChatSession | undefined> =>
  db.chatSessions.get(id)

export async function createSession(title = '新对话'): Promise<string> {
  const t = now()
  const id = newId()
  await db.chatSessions.add({ id, title, kind: 'normal', createdAt: t, updatedAt: t })
  return id
}

export async function updateSession(id: string, patch: Partial<ChatSession>): Promise<void> {
  await db.chatSessions.update(id, { ...patch, updatedAt: now() })
}

/** 删除会话：级联删除消息与摘要。长期记忆的去留在 UI 层询问后再决定。 */
export async function deleteSession(id: string): Promise<void> {
  await db.transaction('rw', db.chatSessions, db.chatMessages, db.sessionSummaries, async () => {
    await db.chatMessages.where('sessionId').equals(id).delete()
    await db.sessionSummaries.where('sessionId').equals(id).delete()
    await db.chatSessions.delete(id)
  })
}

export const countMemoriesOfSession = (sessionId: string): Promise<number> =>
  db.memories.where('sessionId').equals(sessionId).count()

export async function listMessages(sessionId: string): Promise<ChatMessage[]> {
  const rows = await db.chatMessages.where('sessionId').equals(sessionId).toArray()
  return rows.sort((a, b) => a.seq - b.seq)
}

export async function appendMessage(input: {
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  status?: MessageStatus
  sources?: SourceRef[]
}): Promise<string> {
  const rows = await db.chatMessages.where('sessionId').equals(input.sessionId).toArray()
  const seq = rows.length === 0 ? 1 : Math.max(...rows.map((row) => row.seq)) + 1
  const id = newId()
  await db.chatMessages.add({
    id,
    sessionId: input.sessionId,
    seq,
    role: input.role,
    content: input.content,
    status: input.status ?? 'ok',
    sources: input.sources,
    createdAt: now()
  })
  await db.chatSessions.update(input.sessionId, { updatedAt: now() })
  return id
}

export async function updateMessage(id: string, patch: Partial<ChatMessage>): Promise<void> {
  await db.chatMessages.update(id, patch)
}

export const deleteMessage = (id: string): Promise<void> => db.chatMessages.delete(id)

/** 会话内最新一条消息（用于判断是否需要自动命名） */
export async function lastMessageOf(sessionId: string): Promise<ChatMessage | undefined> {
  const rows = await db.chatMessages.where('sessionId').equals(sessionId).toArray()
  return rows.sort((a, b) => b.seq - a.seq)[0]
}
