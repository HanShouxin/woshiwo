import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, reflectionsDb } from '../src/renderer/src/db/db'
import {
  addAction,
  addGoal,
  addProfileCard,
  addViewpoint,
  createReflection,
  deleteContradiction,
  deleteGoal,
  getCurrentContradiction,
  listActionsByType,
  listProfileCards,
  listViewpoints,
  reorderViewpoints,
  resolveContradiction,
  setCurrentContradiction
} from '../src/renderer/src/db/repo'

beforeEach(async () => {
  await Promise.all([db.delete(), reflectionsDb.delete()])
  await db.open()
  await reflectionsDb.open()
})

describe('矛盾生命周期', () => {
  it('设定第二个矛盾时，旧矛盾被替代、旧步骤归档，且同一时刻只有一个当前矛盾', async () => {
    await setCurrentContradiction({ text: '简历缺乏亮点，投递没有回音' })
    const first = await getCurrentContradiction()
    expect(first?.text).toContain('简历')

    await addAction('step', '重写项目经历', first?.id)

    await setCurrentContradiction({ text: '面试表达不清晰' })

    const current = await db.contradictions.where('status').equals('current').toArray()
    expect(current).toHaveLength(1)
    expect(current[0].text).toContain('面试')

    const old = await db.contradictions.get(first?.id as string)
    expect(old?.status).toBe('superseded')
    expect(old?.supersededAt).toBeTruthy()

    const oldSteps = await listActionsByType('step', first?.id)
    expect(oldSteps[0]?.status).toBe('archived')
  })

  it('标记已解决后，矛盾进入历史（不再是当前）', async () => {
    await setCurrentContradiction({ text: '拖延导致进度停滞' })
    const item = await getCurrentContradiction()
    await resolveContradiction(item?.id as string)

    expect(await getCurrentContradiction()).toBeUndefined()
    const archived = await db.contradictions.get(item?.id as string)
    expect(archived?.status).toBe('resolved')
    expect(archived?.resolvedAt).toBeTruthy()
  })

  it('删除矛盾会连带删除其名下行动', async () => {
    await setCurrentContradiction({ text: '临时矛盾' })
    const item = await getCurrentContradiction()
    await addAction('step', '临时步骤', item?.id)

    await deleteContradiction(item?.id as string)

    const steps = await db.actions.where('contradictionId').equals(item?.id as string).toArray()
    expect(steps).toHaveLength(0)
    expect(await db.contradictions.get(item?.id as string)).toBeUndefined()
  })
})

describe('目标与矛盾的关联', () => {
  it('删除目标时矛盾保留，关联解除，但目标标题快照不丢', async () => {
    await addGoal('三个月找到新工作', 'short')
    const goal = (await db.goals.toArray())[0]
    await setCurrentContradiction({
      text: '简历没有竞争力',
      goalId: goal.id,
      goalTitleSnapshot: goal.title
    })
    const item = await getCurrentContradiction()

    await deleteGoal(goal.id)

    const kept = await db.contradictions.get(item?.id as string)
    expect(kept).toBeDefined()
    expect(kept?.goalId).toBeUndefined()
    expect(kept?.goalTitleSnapshot).toBe('三个月找到新工作')
  })
})

describe('现状与感悟', () => {
  it('现状按 category 分组存储，条目独立（一卡一条）', async () => {
    await addProfileCard('资产', '有一辆电瓶车')
    await addProfileCard('资产', '存款 1 万元')
    await addProfileCard('作息', '经常凌晨 1 点后睡')

    const cards = await listProfileCards()
    expect(cards).toHaveLength(3)
    expect(cards.filter((card) => card.category === '资产')).toHaveLength(2)
  })

  it('新感悟排在最前', async () => {
    await addViewpoint('第一条')
    await addViewpoint('第二条')
    const list = await listViewpoints()
    expect(list[0].content).toBe('第二条')
  })

  it('拖拽重排后按新顺序返回', async () => {
    await addViewpoint('A')
    await addViewpoint('B')
    await addViewpoint('C')

    const before = await listViewpoints()
    expect(before.map((item) => item.content)).toEqual(['C', 'B', 'A'])

    // 把最早的 A 拖到最上方
    const ids = before.map((item) => item.id)
    await reorderViewpoints([ids[2], ids[0], ids[1]])

    const after = await listViewpoints()
    expect(after.map((item) => item.content)).toEqual(['A', 'C', 'B'])
  })
})

describe('复盘隔离', () => {
  it('复盘数据存在独立数据库，主库表清单里没有 reflections', async () => {
    const mainTables = db.tables.map((table) => table.name)
    expect(mainTables).not.toContain('reflections')

    const id = await createReflection()
    await reflectionsDb.reflections.update(id, { title: '隐私', content: '不给你看' })

    const rows = await reflectionsDb.reflections.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0].content).toBe('不给你看')
  })
})
