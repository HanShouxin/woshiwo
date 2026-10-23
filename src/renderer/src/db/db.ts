import Dexie, { type Table } from 'dexie'
import type {
  ActionItem,
  AppSetting,
  ChatMessage,
  ChatSession,
  Contradiction,
  Goal,
  Memory,
  ProfileCard,
  Reflection,
  SessionSummary,
  Viewpoint
} from './types'

/**
 * 主数据库：业务数据 + 设置。
 * 注意：复盘笔记不在这里 —— 它有自己的库（见下），保证 AI 上下文在架构上无法触及。
 */
class AppDatabase extends Dexie {
  chatSessions!: Table<ChatSession, string>
  chatMessages!: Table<ChatMessage, string>
  sessionSummaries!: Table<SessionSummary, string>
  memories!: Table<Memory, string>
  goals!: Table<Goal, string>
  contradictions!: Table<Contradiction, string>
  actions!: Table<ActionItem, string>
  viewpoints!: Table<Viewpoint, string>
  profileCards!: Table<ProfileCard, string>
  appSettings!: Table<AppSetting, string>

  constructor() {
    super('woshiwo')
    this.version(1).stores({
      chatSessions: 'id, kind, updatedAt',
      chatMessages: 'id, sessionId, [sessionId+seq], createdAt',
      sessionSummaries: 'id, sessionId, updatedAt',
      memories: 'id, status, sessionId, updatedAt',
      goals: 'id, horizon, status, order, updatedAt',
      contradictions: 'id, status, goalId, proposedAt',
      actions: 'id, contradictionId, type, status, order',
      viewpoints: 'id, order, updatedAt',
      profileCards: 'id, category, order, updatedAt',
      appSettings: 'key'
    })
  }
}

export const db = new AppDatabase()

/**
 * 复盘独立数据库（评审 #12 定案）。
 * 独立 IDB 文件 + 只有复盘模块 import 这个句柄 → 「AI 读不到」可被测试断言，
 * 而不是靠 contextBuilder 里的一行约定。
 */
class ReflectionsDatabase extends Dexie {
  reflections!: Table<Reflection, string>

  constructor() {
    super('woshiwo-reflections')
    this.version(1).stores({
      reflections: 'id, updatedAt, contradictionId'
    })
  }
}

export const reflectionsDb = new ReflectionsDatabase()
