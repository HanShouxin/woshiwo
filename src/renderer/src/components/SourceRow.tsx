import { useState } from 'react'
import type { SourceRef } from '../db/types'

const TABLE_LABEL: Record<string, string> = {
  profileCards: '现状',
  goals: '目标',
  viewpoints: '感悟',
  memories: '记忆',
  contradictions: '矛盾',
  actions: '行动'
}

/**
 * 来源透明行（定稿 §4.1）：
 * 不打扰地显示「这次回答参考了哪些数据」，点开才看明细。
 */
export default function SourceRow({ sources }: { sources: SourceRef[] }): React.JSX.Element {
  const [open, setOpen] = useState(false)

  const counts = new Map<string, number>()
  for (const item of sources) {
    counts.set(item.table, (counts.get(item.table) ?? 0) + 1)
  }
  const summary = [...counts.entries()]
    .map(([table, count]) => `${TABLE_LABEL[table] ?? table} ${count}`)
    .join(' · ')

  return (
    <div className="source-row">
      <button
        type="button"
        className="source-row__toggle"
        onClick={() => setOpen((value) => !value)}
      >
        参考：{summary}
        <span className="source-row__chevron">{open ? '收起' : '展开'}</span>
      </button>

      {open ? (
        <ul className="source-row__list">
          {sources.map((item) => (
            <li key={`${item.table}-${item.id}`} className="source-row__item">
              <span className="source-row__tag">{TABLE_LABEL[item.table] ?? item.table}</span>
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
