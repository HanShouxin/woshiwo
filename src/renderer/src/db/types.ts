/** 数据模型类型定义 —— 与《设计定稿 v2.2》§8 及评审定案一致。 */

export type ID = string

/** ISO 8601 时间字符串 */
export type Timestamp = string

export interface ChatSession {
  id: ID
  title: string
  /** 预置示例会话不参与记忆整合，草案卡片不可点 */
  kind: 'normal' | 'sample'
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface SourceRef {
  table: string
  id: ID
  label: string
}

export type MessageStatus = 'ok' | 'streaming' | 'interrupted' | 'failed'

export interface ChatMessage {
  id: ID
  sessionId: ID
  /** 会话内单调自增；记忆整合游标按 seq 区间幂等推进，删消息不回退 */
  seq: number
  role: 'user' | 'assistant'
  content: string
  status: MessageStatus
  /** 来源透明行展开用的引用明细 */
  sources?: SourceRef[]
  draftState?: 'pending' | 'confirmed' | 'dismissed'
  createdAt: Timestamp
}

export interface SessionSummary {
  id: ID
  sessionId: ID
  content: string
  coversUpToSeq: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type MemoryStatus = 'valid' | 'pending' | 'invalid' | 'superseded'
export type MemoryType = 'fact' | 'preference' | 'decision' | 'other'

export interface Memory {
  id: ID
  content: string
  type: MemoryType
  status: MemoryStatus
  source: 'auto' | 'user'
  /** 被哪条新记忆替代 */
  supersededBy?: ID
  sessionId?: ID
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type GoalHorizon = 'short' | 'long'
export type GoalStatus = 'active' | 'achieved' | 'dropped'

export interface Goal {
  id: ID
  title: string
  horizon: GoalHorizon
  status: GoalStatus
  dueDate?: Timestamp
  /** 排序即优先级信号 */
  order: number
  achievedAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type ContradictionStatus = 'current' | 'resolved' | 'superseded'

export interface Contradiction {
  id: ID
  text: string
  status: ContradictionStatus
  goalId?: ID
  /** 目标被删除后仍能显示「当时服务的目标」 */
  goalTitleSnapshot?: string
  /** 为什么此刻是它（依据备注） */
  rationale?: string
  proposedAt: Timestamp
  resolvedAt?: Timestamp
  supersededAt?: Timestamp
}

export type ActionType = 'step' | 'habit'
/** 取消 = 归档保留，不是删除 */
export type ActionStatus = 'active' | 'done' | 'paused' | 'archived'

export interface ActionItem {
  id: ID
  text: string
  type: ActionType
  status: ActionStatus
  /** 步骤类行动关联所属矛盾；长期习惯可为空 */
  contradictionId?: ID
  order: number
  note?: string
  dueDate?: Timestamp
  completedAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Viewpoint {
  id: ID
  content: string
  tags: string[]
  source?: string
  order: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** 一行 = 一条记录（评审 #14 定案） */
export interface ProfileCard {
  id: ID
  /** 两字分类标签 */
  category: string
  content: string
  order: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface AppSetting {
  key: string
  value: unknown
}

/** 复盘笔记 —— 存在独立数据库中，AI 上下文永不触达 */
export interface Reflection {
  id: ID
  title: string
  content: string
  contradictionId?: ID
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** 记忆整合游标（存 appSettings.integrationCursor） */
export interface IntegrationCursor {
  sessionId: ID
  lastSeq: number
}
