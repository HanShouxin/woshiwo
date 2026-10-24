import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, reflectionsDb } from '../src/renderer/src/db/db'
import {
  buildBackup,
  buildReflectionFiles,
  clearAllData,
  exportViewpointsMarkdown,
  restoreBackup,
  serializeBackup
} from '../src/renderer/src/db/backup'
import {
  addAction,
  addGoal,
  addProfileCard,
  addViewpoint,
  createReflection,
  setCurrentContradiction,
  updateReflection
} from '../src/renderer/src/db/repo'

beforeEach(async () => {
  await Promise.all([db.delete(), reflectionsDb.delete()])
  await db.open()
  await reflectionsDb.open()
})

async function seed(): Promise<void> {
  await addProfileCard('资产', '有一辆电瓶车')
  await addGoal('三个月找到新工作', 'short')
  await setCurrentContradiction({ text: '简历没有竞争力' })
  const current = await db.contradictions.toArray()
  await addAction('step', '重写项目经历', current[0].id)
  await addViewpoint('先动手比想清楚重要', '《矛盾论》')
  const reflectionId = await createReflection()
  await updateReflection(reflectionId, { title: '这周', content: '状态不错' })
}

describe('备份导出与导入', () => {
  it('导出的备份包含全部表，并且在导入后能原样还原', async () => {
    await seed()

    const backup = await buildBackup()
    expect(backup.app).toBe('woshiwo')
    expect(backup.version).toBe(2)
    expect(backup.tables.profileCards).toHaveLength(1)
    expect(backup.tables.viewpoints).toHaveLength(1)
    expect(backup.tables.reflections).toHaveLength(1)

    const raw = serializeBackup(backup)

    // 破坏现有数据
    await clearAllData()
    expect(await db.profileCards.count()).toBe(0)
    expect(await reflectionsDb.reflections.count()).toBe(0)

    // 还原
    const counts = await restoreBackup(raw)
    expect(counts.profileCards).toBe(1)
    expect(counts.reflections).toBe(1)

    expect(await db.profileCards.count()).toBe(1)
    expect(await db.goals.count()).toBe(1)
    expect(await db.contradictions.count()).toBe(1)
    expect(await db.actions.count()).toBe(1)
    expect(await db.viewpoints.count()).toBe(1)
    expect(await reflectionsDb.reflections.count()).toBe(1)

    const viewpoint = (await db.viewpoints.toArray())[0]
    expect(viewpoint.source).toBe('《矛盾论》')
  })

  it('导入非本应用的文件会明确报错，且不破坏现有数据', async () => {
    await seed()
    await expect(restoreBackup('{"app":"other","tables":{}}')).rejects.toThrow('不是「我是我」的备份文件')
    expect(await db.profileCards.count()).toBe(1)
  })

  it('导入坏 JSON 会明确报错', async () => {
    await expect(restoreBackup('not json')).rejects.toThrow('不是有效的 JSON')
  })
})

describe('Markdown 导出', () => {
  it('感悟导出只列正文、来源、时间，不用序号当标题', async () => {
    await seed()
    const md = await exportViewpointsMarkdown()
    expect(md).toContain('# 我是我 · 感悟')
    expect(md).toContain('矛盾论')
    expect(md).toContain('先动手比想清楚重要')
    expect(md).toContain('来源：《矛盾论》')
    expect(md).toContain('记录于')
    expect(md).not.toMatch(/^## \d+$/m)
  })
})

describe('复盘导出（文件夹 + 每篇 txt）', () => {
  it('文件夹名固定，每篇一个 txt，标题作文件名，同名自动加序号', async () => {
    const first = await createReflection()
    await updateReflection(first, { title: '这周', content: '状态不错' })
    const second = await createReflection()
    await updateReflection(second, { title: '这周', content: '第二篇' })

    const bundle = await buildReflectionFiles()
    expect(bundle.folderName).toBe('我是我-复盘笔记')
    expect(bundle.files).toHaveLength(2)

    const names = bundle.files.map((file) => file.name).sort()
    expect(names).toEqual(['这周 (2).txt', '这周.txt'])

    // 同名两篇都拿到独立文件，内容各自对应
    const withFirst = bundle.files.find((file) => file.content.includes('状态不错'))
    expect(withFirst).toBeDefined()
    const lines = (withFirst?.content ?? '').split('\n')
    expect(lines[0]).toBe('这周')
    expect(lines[1]).toContain('时间：')
    expect(lines[2]).toBe('')
  })

  it('没写标题的用记录日期兜底命名，并计入 untitled', async () => {
    await createReflection()
    const bundle = await buildReflectionFiles()
    expect(bundle.untitled).toBe(1)
    expect(bundle.files[0].name).toMatch(/^未命名-\d{8}\.txt$/)
    expect(bundle.files[0].content.startsWith('（未命名）')).toBe(true)
  })

  it('标题里的非法文件名字符会被清理', async () => {
    const id = await createReflection()
    await updateReflection(id, { title: 'a/b:c*d?e', content: 'x' })
    const bundle = await buildReflectionFiles()
    expect(bundle.files[0].name).not.toMatch(/[\\/:*?"<>|]/)
    expect(bundle.files[0].name.endsWith('.txt')).toBe(true)
  })
})
