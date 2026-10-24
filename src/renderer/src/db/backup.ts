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

function timeLabel(iso: string): string {
  const date = new Date(iso)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${dateLabel(iso)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function backupFileName(): string {
  return `我是我-备份-${stamp()}.json`
}

export function viewpointsFileName(): string {
  return `我是我-感悟-${stamp()}.md`
}

/** 复盘导出：一个文件夹，每篇独立 txt */
export const REFLECTIONS_FOLDER = '我是我-复盘笔记'

export interface ExportFile {
  name: string
  content: string
}

export interface ReflectionsBundle {
  folderName: string
  files: ExportFile[]
  /** 没有填标题的篇数（导出时用记录日期兜底命名） */
  untitled: number
}

/** Windows 文件名不允许的字符一律换成空格，去掉结尾的点与空格 */
function sanitizeFileName(raw: string): string {
  return raw
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.\s]+$/g, '')
    .slice(0, 80)
}

/**
 * 生成复盘导出包。
 * 文件名 = 用户填的标题；同名时按系统习惯追加 (2)(3)；没标题的用记录日期兜底。
 * 文件内容 = 标题 / 时间 / 空行 / 正文。
 */
export async function buildReflectionFiles(): Promise<ReflectionsBundle> {
  const items = await reflectionsDb.reflections.orderBy('updatedAt').reverse().toArray()
  const used = new Set<string>()
  const files: ExportFile[] = []
  let untitled = 0

  for (const item of items) {
    const rawTitle = item.title.trim()
    if (!rawTitle) untitled += 1

    const fallback = `未命名-${dateLabel(item.createdAt).replace(/\./g, '')}`
    const base = sanitizeFileName(rawTitle) || fallback

    // 文件名去重（Windows 不区分大小写，统一用小写比较）
    let name = base
    let index = 2
    while (used.has(name.toLowerCase())) {
      name = `${base} (${index})`
      index += 1
    }
    used.add(name.toLowerCase())

    const content = [
      rawTitle || '（未命名）',
      `时间：${timeLabel(item.createdAt)}`,
      '',
      item.content.trim()
    ].join('\n')

    files.push({ name: `${name}.txt`, content })
  }

  return { folderName: REFLECTIONS_FOLDER, files, untitled }
}

/** 感悟导出：核心思想置顶 + 全部感悟（新的在上），每条只列 正文 / 来源 / 时间 */
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

  items.forEach((item) => {
    lines.push('---', '', item.content, '')
    if (item.source) lines.push(`来源：${item.source}`, '')
    lines.push(`记录于 ${dateLabel(item.createdAt)}`, '')
  })

  if (items.length === 0) lines.push('（还没有感悟）', '')
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
