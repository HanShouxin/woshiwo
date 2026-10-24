/**
 * 拖拽重排的纯逻辑（与 UI 解耦，便于测试）。
 *
 * @param ids     当前显示顺序（上 → 下）
 * @param fromId  被拖动的条目
 * @param targetId 放置目标
 * @param after   是否插到目标之后（鼠标在目标下半区时为 true）
 * @returns 新顺序；无变化或参数非法时返回 null
 */
export function moveItem(
  ids: string[],
  fromId: string,
  targetId: string,
  after: boolean
): string[] | null {
  if (fromId === targetId) return null
  const from = ids.indexOf(fromId)
  const to = ids.indexOf(targetId)
  if (from < 0 || to < 0) return null

  const rest = ids.filter((id) => id !== fromId)
  // 目标被移除后位置会前移，插入点要相应修正
  const rawInsert = after ? to + 1 : to
  const insertAt = from < rawInsert ? rawInsert - 1 : rawInsert

  const next = [...rest]
  next.splice(insertAt, 0, fromId)
  return next
}
