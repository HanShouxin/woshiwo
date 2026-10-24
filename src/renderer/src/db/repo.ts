import { db, reflectionsDb } from './db'
import type {
  ActionItem,
  ActionStatus,
  ActionType,
  Contradiction,
  Goal,
  GoalHorizon,
  IntegrationCursor,
  ProfileCard,
  Reflection,
  Viewpoint
} from './types'

export const now = (): string => new Date().toISOString()
export const newId = (): string => crypto.randomUUID()

/* ---------------- 设置 ---------------- */

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.appSettings.get(key)
  return row ? (row.value as T) : fallback
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.appSettings.put({ key, value })
}

export const getIntegrationCursor = (): Promise<IntegrationCursor | null> =>
  getSetting<IntegrationCursor | null>('integrationCursor', null)

/* ---------------- 现状档案 ---------------- */

export const listProfileCards = (): Promise<ProfileCard[]> =>
  db.profileCards.orderBy('order').toArray()

export async function addProfileCard(category: string, content: string): Promise<void> {
  const t = now()
  const last = await db.profileCards.orderBy('order').last()
  await db.profileCards.add({
    id: newId(),
    category,
    content,
    order: (last?.order ?? 0) + 1,
    createdAt: t,
    updatedAt: t
  })
}

export async function updateProfileCard(id: string, patch: Partial<ProfileCard>): Promise<void> {
  await db.profileCards.update(id, { ...patch, updatedAt: now() })
}

export const deleteProfileCard = (id: string): Promise<void> => db.profileCards.delete(id)

/** 已有分类（按首次出现顺序） */
export async function listUsedCategories(): Promise<string[]> {
  const cards = await listProfileCards()
  return [...new Set(cards.map((card) => card.category))]
}

/* ---------------- 目标 ---------------- */

export const listGoals = (): Promise<Goal[]> => db.goals.orderBy('order').toArray()

export async function addGoal(title: string, horizon: GoalHorizon): Promise<void> {
  const t = now()
  const last = await db.goals.orderBy('order').last()
  await db.goals.add({
    id: newId(),
    title,
    horizon,
    status: 'active',
    order: (last?.order ?? 0) + 1,
    createdAt: t,
    updatedAt: t
  })
}

export async function updateGoal(id: string, patch: Partial<Goal>): Promise<void> {
  await db.goals.update(id, { ...patch, updatedAt: now() })
}

/**
 * 删除目标：矛盾保留，只解除关联（评审定案）。
 * 目标的标题已快照在矛盾里，历史叙事不会丢。
 */
export async function deleteGoal(id: string): Promise<void> {
  await db.transaction('rw', db.goals, db.contradictions, async () => {
    await db.goals.delete(id)
    const linked = await db.contradictions.where('goalId').equals(id).toArray()
    for (const item of linked) {
      await db.contradictions.update(item.id, { goalId: undefined })
    }
  })
}

export async function setGoalStatus(id: string, status: Goal['status']): Promise<void> {
  await updateGoal(id, {
    status,
    achievedAt: status === 'achieved' ? now() : undefined
  })
}

/* ---------------- 主要矛盾 ---------------- */

export const getCurrentContradiction = (): Promise<Contradiction | undefined> =>
  db.contradictions.where('status').equals('current').first()

export const listArchivedContradictions = (): Promise<Contradiction[]> =>
  db.contradictions
    .filter((item) => item.status !== 'current')
    .toArray()
    .then((list) =>
      list.sort((a, b) => (b.resolvedAt ?? b.supersededAt ?? '').localeCompare(a.resolvedAt ?? a.supersededAt ?? ''))
    )

/**
 * 设定当前主要矛盾。同一时刻只有一个当前矛盾（精力有限的产品化表达）：
 * 若已存在，原矛盾标记为「已被替代」并记录时间，其未完成行动一并归档。
 */
export async function setCurrentContradiction(input: {
  text: string
  goalId?: string
  goalTitleSnapshot?: string
}): Promise<{ replaced: number; id: string }> {
  let replaced = 0
  const id = newId()
  await db.transaction('rw', db.contradictions, db.actions, async () => {
    const existing = await db.contradictions.where('status').equals('current').toArray()
    for (const old of existing) {
      await db.contradictions.update(old.id, { status: 'superseded', supersededAt: now() })
      const steps = await db.actions
        .where('contradictionId')
        .equals(old.id)
        .filter((action) => action.status === 'active' || action.status === 'paused')
        .toArray()
      replaced += steps.length
      for (const step of steps) {
        await db.actions.update(step.id, { status: 'archived', updatedAt: now() })
      }
    }
    await db.contradictions.add({
      id,
      text: input.text,
      status: 'current',
      goalId: input.goalId,
      goalTitleSnapshot: input.goalTitleSnapshot,
      proposedAt: now()
    })
  })
  return { replaced, id }
}

export async function updateContradiction(
  id: string,
  patch: Partial<Contradiction>
): Promise<void> {
  await db.contradictions.update(id, patch)
}

/** 标记已解决 —— 触发感悟沉淀提示（见 Actions 页） */
export async function resolveContradiction(id: string): Promise<void> {
  await db.contradictions.update(id, { status: 'resolved', resolvedAt: now() })
}

/** 删除矛盾：名下行动一并删除，时间线同步移除该节点 */
export async function deleteContradiction(id: string): Promise<void> {
  await db.transaction('rw', db.contradictions, db.actions, async () => {
    await db.actions.where('contradictionId').equals(id).delete()
    await db.contradictions.delete(id)
  })
}

/* ---------------- 行动 ---------------- */

export async function listActionsByType(
  type: ActionType,
  contradictionId?: string
): Promise<ActionItem[]> {
  const rows = await db.actions.where('type').equals(type).toArray()
  const filtered = contradictionId
    ? rows.filter((row) => row.contradictionId === contradictionId)
    : rows.filter((row) => !row.contradictionId)
  return filtered.sort((a, b) => a.order - b.order)
}

export async function addAction(
  type: ActionType,
  text: string,
  contradictionId?: string
): Promise<void> {
  const t = now()
  const last = await db.actions.orderBy('order').last()
  await db.actions.add({
    id: newId(),
    text,
    type,
    status: 'active',
    contradictionId,
    order: (last?.order ?? 0) + 1,
    createdAt: t,
    updatedAt: t
  })
}

export async function updateAction(id: string, patch: Partial<ActionItem>): Promise<void> {
  await db.actions.update(id, { ...patch, updatedAt: now() })
}

export async function setActionStatus(id: string, status: ActionStatus): Promise<void> {
  await updateAction(id, {
    status,
    completedAt: status === 'done' ? now() : undefined
  })
}

export const deleteAction = (id: string): Promise<void> => db.actions.delete(id)

export const listArchiveSteps = async (contradictionId: string): Promise<ActionItem[]> => {
  const rows = await db.actions.where('contradictionId').equals(contradictionId).toArray()
  return rows.filter((row) => row.type === 'step').sort((a, b) => a.order - b.order)
}

/* ---------------- 感悟（我是我） ---------------- */

/** 新感悟排在最上：order 越大越靠前 */
export const listViewpoints = (): Promise<Viewpoint[]> =>
  db.viewpoints.orderBy('order').reverse().toArray()

export async function addViewpoint(content: string, source?: string): Promise<void> {
  const t = now()
  const last = await db.viewpoints.orderBy('order').last()
  await db.viewpoints.add({
    id: newId(),
    content,
    tags: [],
    source,
    order: (last?.order ?? 0) + 1,
    createdAt: t,
    updatedAt: t
  })
}

export async function updateViewpoint(id: string, patch: Partial<Viewpoint>): Promise<void> {
  await db.viewpoints.update(id, { ...patch, updatedAt: now() })
}

export const deleteViewpoint = (id: string): Promise<void> => db.viewpoints.delete(id)

/**
 * 按给定显示顺序（从上到下）重排感悟。
 * order 越大越靠上，所以第一个给最大 order。
 */
export async function reorderViewpoints(orderedIds: string[]): Promise<void> {
  const total = orderedIds.length
  await db.transaction('rw', db.viewpoints, async () => {
    for (let index = 0; index < total; index += 1) {
      await db.viewpoints.update(orderedIds[index], { order: total - index, updatedAt: now() })
    }
  })
}

/* ---------------- 复盘（独立库） ---------------- */

export const listReflections = (): Promise<Reflection[]> =>
  reflectionsDb.reflections.orderBy('updatedAt').reverse().toArray()

export const getReflection = (id: string): Promise<Reflection | undefined> =>
  reflectionsDb.reflections.get(id)

export async function createReflection(contradictionId?: string): Promise<string> {
  const t = now()
  const id = newId()
  await reflectionsDb.reflections.add({
    id,
    title: '',
    content: '',
    contradictionId,
    createdAt: t,
    updatedAt: t
  })
  return id
}

export async function updateReflection(
  id: string,
  patch: Partial<Reflection>
): Promise<void> {
  await reflectionsDb.reflections.update(id, { ...patch, updatedAt: now() })
}

export const deleteReflection = (id: string): Promise<void> => reflectionsDb.reflections.delete(id)

/* ---------------- 概览 ---------------- */

export interface DataOverview {
  sessions: number
  messages: number
  memories: number
  goals: number
  contradictions: number
  actions: number
  viewpoints: number
  profileCards: number
  reflections: number
}

export async function getOverview(): Promise<DataOverview> {
  const [sessions, messages, memories, goals, contradictions, actions, viewpoints, profileCards, reflections] =
    await Promise.all([
      db.chatSessions.count(),
      db.chatMessages.count(),
      db.memories.count(),
      db.goals.count(),
      db.contradictions.count(),
      db.actions.count(),
      db.viewpoints.count(),
      db.profileCards.count(),
      reflectionsDb.reflections.count()
    ])
  return {
    sessions,
    messages,
    memories,
    goals,
    contradictions,
    actions,
    viewpoints,
    profileCards,
    reflections
  }
}
