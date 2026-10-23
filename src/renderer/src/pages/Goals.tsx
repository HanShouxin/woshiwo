import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, X } from 'lucide-react'
import Page from '../components/Page'
import EditableText from '../components/EditableText'
import { addGoal, deleteGoal, listGoals, setGoalStatus, updateGoal } from '../db/repo'
import type { GoalHorizon } from '../db/types'

const SECTIONS: ReadonlyArray<{ horizon: GoalHorizon; title: string; hint: string }> = [
  { horizon: 'short', title: '短期', hint: '三个月内想看到的变化' },
  { horizon: 'long', title: '长期', hint: '三年后想成为的样子' }
]

export default function Goals(): React.JSX.Element {
  const goals = useLiveQuery(listGoals, [], [])
  const [drafts, setDrafts] = useState<Record<GoalHorizon, string>>({ short: '', long: '' })

  async function submit(horizon: GoalHorizon): Promise<void> {
    const text = drafts[horizon].trim()
    if (!text) return
    await addGoal(text, horizon)
    setDrafts((prev) => ({ ...prev, [horizon]: '' }))
  }

  return (
    <Page title="目标" desc="你想到达哪里。目标只是方向，真正要打的那一仗在「行动」里。" wide>
      <div className="split split--equal">
        {SECTIONS.map((section) => {
          const items = goals.filter((goal) => goal.horizon === section.horizon)
          return (
            <section className="panel" key={section.horizon}>
              <header className="panel__head">
                <h2 className="panel__title">
                  {section.title}
                  <span className="panel__count">{items.length}</span>
                </h2>
                <p className="panel__hint">{section.hint}</p>
              </header>

              {items.length === 0 ? (
                <p className="panel__empty">还没有{section.title}目标</p>
              ) : (
                items.map((goal) => (
                  <div className="row" key={goal.id}>
                    <EditableText
                      value={goal.title}
                      className={goal.status === 'achieved' ? 'text-done' : undefined}
                      onSave={(next) => void updateGoal(goal.id, { title: next })}
                    />
                    <button
                      type="button"
                      className="row__action"
                      title={goal.status === 'achieved' ? '取消达成' : '标记达成'}
                      onClick={() =>
                        void setGoalStatus(
                          goal.id,
                          goal.status === 'achieved' ? 'active' : 'achieved'
                        )
                      }
                      style={
                        goal.status === 'achieved'
                          ? { opacity: 1, color: 'var(--accent)' }
                          : undefined
                      }
                    >
                      <Check size={14} strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      className="row__action row__action--danger"
                      title="删除"
                      onClick={() => void deleteGoal(goal.id)}
                    >
                      <X size={14} strokeWidth={2} />
                    </button>
                  </div>
                ))
              )}

              <div className="add-row">
                <input
                  className="add-input"
                  placeholder={section.hint}
                  value={drafts[section.horizon]}
                  onChange={(event) =>
                    setDrafts((prev) => ({ ...prev, [section.horizon]: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void submit(section.horizon)
                  }}
                />
                <button
                  type="button"
                  className="btn"
                  onClick={() => void submit(section.horizon)}
                >
                  添加
                </button>
              </div>
            </section>
          )
        })}
      </div>
    </Page>
  )
}
