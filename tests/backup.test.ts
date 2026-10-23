import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, reflectionsDb } from '../src/renderer/src/db/db'
import {
  buildBackup,
  clearAllData,
  exportReflectionsMarkdown,
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
  it('感悟导出含核心思想与来源', async () => {
    await seed()
    const md = await exportViewpointsMarkdown()
    expect(md).toContain('# 我是我 · 感悟')
    expect(md).toContain('矛盾论')
    expect(md).toContain('先动手比想清楚重要')
    expect(md).toContain('来源：《矛盾论》')
  })

  it('复盘导出含标题与时间', async () => {
    await seed()
    const md = await exportReflectionsMarkdown()
    expect(md).toContain('# 复盘 · 私人笔记')
    expect(md).toContain('这周')
    expect(md).toContain('状态不错')
  })
})
