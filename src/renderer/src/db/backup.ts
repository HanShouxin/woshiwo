import { db, reflectionsDb } from './db'
import { CORE_THOUGHT } from '../../../shared/constants'

/** 备份格式（与旧版 woshiwo v2 兼容的顶层结构） */
export interface BackupFile {
  app: 'woshiwo'
  version: 2
  exported_at: string
  tables: Record<string, unknown[]>
}

const MAIN_TABLES = [
  'chatSessions',
  'chatMessages',
  'sessionSummaries',
  'memories',
  'goals',
  'contradictions',
  'actions',
  'viewpoints',
  'profileCards',
  'appSettings'
] as const

/**
 * 导出全部数据。
 * API Key 不在 appSettings 里（它在主进程的加密密钥文件中），所以备份天然不含密钥。
 */
export async function buildBackup(): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {}
  for (const name of MAIN_TABLES) {
    tables[name] = await db.table(name).toArray()
  }
  tables.reflections = await reflectionsDb.reflections.toArray()
  return {
    app: 'woshiwo',
    version: 2,
    exported_at: new Date().toISOString(),
    tables
  }
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2)
}

/** 导入备份：覆盖现有全部数据（调用方必须先做二次确认） */
export async function restoreBackup(raw: string): Promise<Record<string, number>> {
  let parsed: BackupFile
  try {
    parsed = JSON.parse(raw) as BackupFile
  } catch {
    throw new Error('文件不是有效的 JSON')
  }
  if (!parsed || parsed.app !== 'woshiwo' || typeof parsed.tables !== 'object' || !parsed.tables) {
    throw new Error('这不是「我是我」的备份文件')
  }

  const counts: Record<string, number> = {}
  await db.transaction('rw', db.tables, async () => {
    for (const name of MAIN_TABLES) {
      const rows = Array.isArray(parsed.tables[name]) ? (parsed.tables[name] as unknown[]) : []
      await db.table(name).clear()
      if (rows.length > 0) await db.table(name).bulkAdd(rows)
      counts[name] = rows.length
    }
  })

  const reflections = Array.isArray(parsed.tables.reflections)
    ? (parsed.tables.reflections as unknown[])
    : []
  await reflectionsDb.reflections.clear()
  if (reflections.length > 0) await reflectionsDb.reflections.bulkAdd(reflections as never[])
  counts.reflections = reflections.length

  return counts
}

function stamp(): string {
  const now = new Date()
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
}

function dateLabel(iso: string): string {
  const date = new Date(iso)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(
    date.getDate()
  ).padStart(2, '0')}`
}

export function backupFileName(): string {
  return `我是我-备份-${stamp()}.json`
}

export function viewpointsFileName(): string {
  return `我是我-感悟-${stamp()}.md`
}

export function reflectionsFileName(): string {
  return `我是我-复盘-${stamp()}.md`
}

/** 感悟导出：核心思想置顶 + 全部感悟（新的在上） */
export async function exportViewpointsMarkdown(): Promise<string> {
  const items = await db.viewpoints.orderBy('order').reverse().toArray()
  const lines: string[] = [
    '# 我是我 · 感悟',
    '',
    `导出时间：${new Date().toLocaleString('zh-CN')}`,
    '',
    '> ' + CORE_THOUGHT,
    '>',
    '> ——《矛盾论》（毛泽东）',
    ''
  ]

  items.forEach((item, index) => {
    lines.push('---', '', `## ${items.length - index}`, '', item.content, '')
    if (item.source) lines.push(`来源：${item.source}`, '')
    lines.push(`记录于 ${dateLabel(item.createdAt)}`, '')
  })

  if (items.length === 0) lines.push('（还没有感悟）', '')
  return lines.join('\n')
}

/** 复盘导出：纯私人笔记，按时间倒序 */
export async function exportReflectionsMarkdown(): Promise<string> {
  const items = await reflectionsDb.reflections.orderBy('updatedAt').reverse().toArray()
  const lines: string[] = [
    '# 复盘 · 私人笔记',
    '',
    `导出时间：${new Date().toLocaleString('zh-CN')}`,
    ''
  ]

  items.forEach((item) => {
    lines.push('---', '', `## ${item.title.trim() || dateLabel(item.createdAt)}`, '')
    lines.push(`时间：${dateLabel(item.createdAt)}`, '')
    if (item.content.trim()) lines.push(item.content, '')
  })

  if (items.length === 0) lines.push('（还没有复盘）', '')
  return lines.join('\n')
}

/** 清空全部用户数据（Key 由调用方另行删除） */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const name of MAIN_TABLES) {
      await db.table(name).clear()
    }
  })
  await reflectionsDb.reflections.clear()
}
