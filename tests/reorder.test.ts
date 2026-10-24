import { describe, expect, it } from 'vitest'
import { moveItem } from '../src/renderer/src/lib/reorder'

const ids = ['A', 'B', 'C']

describe('拖拽重排', () => {
  it('把上方的条目拖到下方条目之后', () => {
    // 把 A 拖到 B 下半区 → A 落到 B 后面
    expect(moveItem(ids, 'A', 'B', true)).toEqual(['B', 'A', 'C'])
  })

  it('把上方的条目拖到下方条目之前', () => {
    expect(moveItem(ids, 'A', 'C', false)).toEqual(['B', 'A', 'C'])
  })

  it('把下方的条目拖到最上方', () => {
    expect(moveItem(ids, 'C', 'A', false)).toEqual(['C', 'A', 'B'])
  })

  it('把下方的条目拖到最下方（末尾追加）', () => {
    // C 拖到 B 的下半区
    expect(moveItem(ids, 'C', 'B', true)).toEqual(['A', 'B', 'C'])
  })

  it('拖到自己身上不产生变化', () => {
    expect(moveItem(ids, 'B', 'B', true)).toBeNull()
  })

  it('id 不在列表里时返回 null', () => {
    expect(moveItem(ids, 'X', 'A', false)).toBeNull()
  })

  it('两元素互换', () => {
    expect(moveItem(['A', 'B'], 'A', 'B', true)).toEqual(['B', 'A'])
    expect(moveItem(['A', 'B'], 'B', 'A', false)).toEqual(['B', 'A'])
  })
})
