import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Plus, X } from 'lucide-react'
import Page from '../components/Page'
import EditableText from '../components/EditableText'
import { formatDate } from '../lib/format'
import {
  addAction,
  addViewpoint,
  deleteAction,
  deleteContradiction,
  getCurrentContradiction,
  listActionsByType,
  listGoals,
  resolveContradiction,
  setActionStatus,
  setCurrentContradiction,
  updateAction,
  updateContradiction
} from '../db/repo'

export default function Actions(): React.JSX.Element {
  const current = useLiveQuery(getCurrentContradiction, [], undefined)
  const steps = useLiveQuery(
    () => (current ? listActionsByType('step', current.id) : Promise.resolve([])),
    [current?.id],
    []
  )
  const habits = useLiveQuery(() => listActionsByType('habit'), [], [])
  const goals = useLiveQuery(listGoals, [], [])

  const [writing, setWriting] = useState(false)
  const [contradictionDraft, setContradictionDraft] = useState('')
  const [goalDraft, setGoalDraft] = useState('')
  const [stepDraft, setStepDraft] = useState('')
  const [habitDraft, setHabitDraft] = useState('')
  const [resolveMode, setResolveMode] = useState(false)
  const [insight, setInsight] = useState('')

  async function createContradiction(): Promise<void> {
    const text = contradictionDraft.trim()
    if (!text) return
    const goal = goals.find((item) => item.id === goalDraft)
    await setCurrentContradiction({
      text,
      goalId: goal?.id,
      goalTitleSnapshot: goal?.title
    })
    setContradictionDraft('')
    setGoalDraft('')
    setWriting(false)
  }

  async function finishResolve(saveInsight: boolean): Promise<void> {
    if (!current) return
    if (saveInsight && insight.trim()) {
      await addViewpoint(insight.trim(), `来自矛盾的解决：${current.text}`)
    }
    await resolveContradiction(current.id)
    setResolveMode(false)
    setInsight('')
  }

  function addHabit(): void {
    if (!habitDraft.trim()) return
    void addAction('habit', habitDraft.trim())
    setHabitDraft('')
  }

  return (
    <Page
      title="行动"
      desc="人的精力有限，一次只打一场仗。左边是你眼下的主要矛盾，右边是你需要长期保持的事。"
      wide
    >
      <div className="split">
        <div className="split__main">
          {!current ? (
            <>
              <div className="empty" style={{ marginTop: 0 }}>
                还没有当前矛盾。
                <span className="empty__hint">
                  聊聊现状，我们找到那个卡住你的点；或者你自己写一个。
                </span>
                <div className="choices" style={{ justifyContent: 'center' }}>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => setWriting(true)}
                  >
                    自己写一个
                  </button>
                  <Link to="/" className="btn">
                    和 AI 一起找
                  </Link>
                </div>
              </div>

              {writing ? (
                <div style={{ marginTop: 18 }}>
                  <div className="add-row" style={{ marginTop: 0 }}>
                    <input
                      className="add-input"
                      autoFocus
                      placeholder="现在最卡住你的是什么？"
                      value={contradictionDraft}
                      onChange={(event) => setContradictionDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void createContradiction()
                      }}
                    />
                  </div>
                  <div className="add-row">
                    {goals.length > 0 ? (
                      <select
                        className="add-input"
                        style={{ flex: '0 0 auto', width: 200 }}
                        value={goalDraft}
                        onChange={(event) => setGoalDraft(event.target.value)}
                      >
                        <option value="">不关联目标</option>
                        {goals.map((goal) => (
                          <option key={goal.id} value={goal.id}>
                            {goal.title}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => void createContradiction()}
                    >
                      设定为当前矛盾
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => setWriting(false)}
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <section className="contradiction">
                <span className="contradiction__label">当前主要矛盾</span>
                <div className="contradiction__text">
                  <EditableText
                    value={current.text}
                    onSave={(next) => void updateContradiction(current.id, { text: next })}
                  />
                </div>
                <div className="contradiction__meta">
                  {current.goalTitleSnapshot ? (
                    <span className="contradiction__goal">服务：{current.goalTitleSnapshot}</span>
                  ) : null}
                  <span>提出于 {formatDate(current.proposedAt)}</span>
                  <div className="contradiction__actions">
                    <button type="button" className="btn" onClick={() => setResolveMode(true)}>
                      标记已解决
                    </button>
                    <button
                      type="button"
                      className="row__action row__action--danger"
                      title="删除这个矛盾（及其行动）"
                      onClick={() => void deleteContradiction(current.id)}
                      style={{ opacity: 1, marginTop: 0 }}
                    >
                      <X size={14} strokeWidth={2} />
                    </button>
                  </div>
                </div>

                {resolveMode ? (
                  <div className="add-row" style={{ marginTop: 16 }}>
                    <input
                      className="add-input"
                      autoFocus
                      placeholder="这次经历有什么值得记住的？（可跳过）"
                      value={insight}
                      onChange={(event) => setInsight(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void finishResolve(true)
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => void finishResolve(true)}
                    >
                      保存并完成
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => void finishResolve(false)}
                    >
                      跳过
                    </button>
                  </div>
                ) : null}
              </section>

              <section className="split__section">
                <h2 className="group__title">
                  当前步骤
                  <span className="group__count">{steps.length}</span>
                </h2>
                {steps.map((step, index) => (
                  <div className="row" key={step.id}>
                    <span className="step-index">步骤 {index + 1}</span>
                    <button
                      type="button"
                      className={`check${step.status === 'done' ? ' check--done' : ''}`}
                      title={step.status === 'done' ? '撤销完成' : '完成'}
                      onClick={() =>
                        void setActionStatus(step.id, step.status === 'done' ? 'active' : 'done')
                      }
                    >
                      <Check size={11} strokeWidth={3} />
                    </button>
                    <EditableText
                      value={step.text}
                      className={step.status === 'done' ? 'text-done' : undefined}
                      onSave={(next) => void updateAction(step.id, { text: next })}
                    />
                    <button
                      type="button"
                      className="row__action row__action--danger"
                      title="删除"
                      onClick={() => void deleteAction(step.id)}
                    >
                      <X size={14} strokeWidth={2} />
                    </button>
                  </div>
                ))}
                <div className="add-row">
                  <input
                    className="add-input"
                    placeholder="解决它，下一步做什么？"
                    value={stepDraft}
                    onChange={(event) => setStepDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' || !stepDraft.trim()) return
                      void addAction('step', stepDraft.trim(), current.id)
                      setStepDraft('')
                    }}
                  />
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      if (!stepDraft.trim()) return
                      void addAction('step', stepDraft.trim(), current.id)
                      setStepDraft('')
                    }}
                  >
                    添加
                  </button>
                </div>
              </section>
            </>
          )}
        </div>

        <aside className="split__side">
          <section className="panel panel--side">
            <header className="panel__head">
              <h2 className="panel__title">
                长期习惯
                <span className="panel__count">{habits.length}</span>
              </h2>
              <p className="panel__hint">不为某个矛盾，只为走得更远</p>
            </header>

            <div className="habit-list">
              {habits.map((habit) => (
                <div className="habit-chip" key={habit.id}>
                  <EditableText
                    value={habit.text}
                    className="habit-chip__input"
                    onSave={(next) => void updateAction(habit.id, { text: next })}
                  />
                  <button
                    type="button"
                    className="habit-chip__remove"
                    title="删除"
                    onClick={() => void deleteAction(habit.id)}
                  >
                    <X size={11} strokeWidth={2.5} />
                  </button>
                </div>
              ))}
            </div>

            <div className="add-row">
              <input
                className="add-input"
                placeholder="＋ 添加一个习惯"
                value={habitDraft}
                onChange={(event) => setHabitDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') addHabit()
                }}
              />
              <button type="button" className="btn btn--ghost" onClick={addHabit}>
                <Plus size={14} strokeWidth={2} />
              </button>
            </div>
          </section>
        </aside>
      </div>
    </Page>
  )
}
