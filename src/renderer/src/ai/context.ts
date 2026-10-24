import { MAX_CONTEXT_MESSAGES } from '../../../shared/constants'
import type { ChatTurn } from '../../../shared/constants'
import { db } from '../db/db'
import { getCurrentContradiction, listGoals, listProfileCards, listViewpoints } from '../db/repo'
import type { SourceRef } from '../db/types'
import { SYSTEM_PROMPT } from './systemPrompt'

/**
 * 上下文组装（定稿 §6.4 的优先级）：
 * 系统提示词 > 当前矛盾与目标 > 画像/现状 > 最近 20 条 > 相关感悟 > 有效记忆。
 * 全部现场读库 —— 用户改完档案，下一次请求立刻生效，没有缓存副本。
 */

function block(title: string, lines: string[]): string {
  if (lines.length === 0) return ''
  return `【${title}】\n${lines.join('\n')}`
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

export async function buildContext(input: {
  history: ChatTurn[]
}): Promise<{ turns: ChatTurn[]; sources: SourceRef[] }> {
  const [contradiction, goals, cards, viewpoints, memories] = await Promise.all([
    getCurrentContradiction(),
    listGoals(),
    listProfileCards(),
    listViewpoints(),
    db.memories.where('status').equals('valid').toArray()
  ])

  const sources: SourceRef[] = []
  const brief = (text: string, limit = 24): string =>
    text.length > limit ? `${text.slice(0, limit)}…` : text

  const parts: string[] = []
  parts.push(`今天是 ${formatDate(new Date())}。`)

  if (contradiction) {
    const goalNote = contradiction.goalTitleSnapshot
      ? `（服务于目标：${contradiction.goalTitleSnapshot}）`
      : ''
    parts.push(`【当前主要矛盾】\n${contradiction.text}${goalNote}`)
    sources.push({
      table: 'contradictions',
      id: contradiction.id,
      label: brief(contradiction.text)
    })
  }

  const activeGoals = goals.filter((goal) => goal.status === 'active')
  const goalLines = [
    ...activeGoals
      .filter((goal) => goal.horizon === 'short')
      .map((goal, index) => `短期${index + 1}：${goal.title}`),
    ...activeGoals
      .filter((goal) => goal.horizon === 'long')
      .map((goal, index) => `长期${index + 1}：${goal.title}`)
  ]
  const goalBlock = block('用户设立的目标（按优先级排序）', goalLines)
  if (goalBlock) {
    parts.push(goalBlock)
    activeGoals.forEach((goal) =>
      sources.push({ table: 'goals', id: goal.id, label: brief(goal.title) })
    )
  }

  const grouped = new Map<string, string[]>()
  for (const card of cards.slice(0, 60)) {
    const bucket = grouped.get(card.category) ?? []
    bucket.push(card.content)
    grouped.set(card.category, bucket)
  }
  const cardLines = [...grouped.entries()].map(
    ([category, items]) => `${category}：${items.join('；')}`
  )
  const cardBlock = block('现状档案（用户维护的最新事实）', cardLines)
  if (cardBlock) {
    parts.push(cardBlock)
    cards.slice(0, 60).forEach((card) =>
      sources.push({
        table: 'profileCards',
        id: card.id,
        label: `${card.category} · ${brief(card.content)}`
      })
    )
  }

  const recentViewpoints = viewpoints.slice(0, 12)
  const insightLines = recentViewpoints.map((item, index) => `${index + 1}. ${item.content}`)
  const insightBlock = block('用户的感悟（最近的在前）', insightLines)
  if (insightBlock) {
    parts.push(insightBlock)
    recentViewpoints.forEach((item) =>
      sources.push({ table: 'viewpoints', id: item.id, label: brief(item.content) })
    )
  }

  const recentMemories = memories
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 20)
  const memoryLines = recentMemories.map(
    (item) => `- ${item.content}${item.source === 'auto' ? '（自动提炼，未确认）' : ''}`
  )
  const memoryBlock = block(
    '长期记忆（历史对话提炼，可能过时；与现状档案冲突时以档案为准）',
    memoryLines
  )
  if (memoryBlock) {
    parts.push(memoryBlock)
    recentMemories.forEach((item) =>
      sources.push({ table: 'memories', id: item.id, label: brief(item.content) })
    )
  }

  const system: ChatTurn = {
    role: 'system',
    content: `${SYSTEM_PROMPT}\n\n---\n\n# 当前上下文\n\n${parts.join('\n\n')}`
  }

  return {
    turns: [system, ...input.history.slice(-MAX_CONTEXT_MESSAGES)],
    sources
  }
}

/** 供「本次发送」透明展示用：只给计数，不含内容 */
export async function contextSummary(): Promise<string> {
  const [cards, goals, viewpoints, memories] = await Promise.all([
    db.profileCards.count(),
    db.goals.count(),
    db.viewpoints.count(),
    db.memories.where('status').equals('valid').count()
  ])
  const parts = [
    cards > 0 ? `现状 ${cards} 条` : '',
    goals > 0 ? `目标 ${goals} 条` : '',
    viewpoints > 0 ? `感悟 ${viewpoints} 条` : '',
    memories > 0 ? `记忆 ${memories} 条` : ''
  ].filter(Boolean)
  return parts.length > 0 ? `参考：${parts.join(' · ')}` : ''
}
