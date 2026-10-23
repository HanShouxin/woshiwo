import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { DraftPayload } from '../../../shared/constants'

interface DraftCardProps {
  draft: DraftPayload
  /** 示例会话里的草案：只做展示，不可确认 */
  readOnly?: boolean
  onConfirm?: (payload: DraftPayload) => void
}

/**
 * 草案确认卡片（定稿 §5 的灵魂交互）：
 * 矛盾与行动都可以在这里改，改完点「确认写入」才落库；绝不静默写入。
 */
export default function DraftCard({
  draft,
  readOnly,
  onConfirm
}: DraftCardProps): React.JSX.Element {
  const [contradiction, setContradiction] = useState(draft.contradiction)
  const [actions, setActions] = useState(
    draft.actions.length > 0 ? draft.actions : [{ type: 'step' as const, text: '' }]
  )
  const [done, setDone] = useState(false)

  function updateAction(index: number, text: string): void {
    setActions((prev) => prev.map((item, i) => (i === index ? { ...item, text } : item)))
  }

  function removeAction(index: number): void {
    setActions((prev) => prev.filter((_, i) => i !== index))
  }

  function addAction(): void {
    setActions((prev) => [...prev, { type: 'step', text: '' }])
  }

  function confirm(): void {
    const payload: DraftPayload = {
      ...draft,
      contradiction: contradiction.trim(),
      actions: actions
        .filter((item) => item.text.trim())
        .map((item) => ({ type: item.type, text: item.text.trim() }))
    }
    if (!payload.contradiction) return
    onConfirm?.(payload)
    setDone(true)
  }

  return (
    <section className={`draft-card${readOnly ? ' draft-card--readonly' : ''}`}>
      <header className="draft-card__head">
        <span className="draft-card__label">
          {readOnly ? '行动草案 · 示例' : '行动草案 · 待你确认'}
        </span>
        {draft.goal ? <span className="draft-card__goal">服务：{draft.goal}</span> : null}
      </header>

      <label className="draft-card__field">
        <span className="draft-card__field-label">主要矛盾</span>
        <textarea
          className="draft-card__textarea"
          rows={2}
          value={contradiction}
          readOnly={readOnly}
          onChange={(event) => setContradiction(event.target.value)}
        />
      </label>

      <div className="draft-card__field">
        <span className="draft-card__field-label">行动</span>
        {actions.map((action, index) => (
          <div className="draft-card__action" key={index}>
            <span className="draft-card__type">{action.type === 'step' ? '步骤' : '习惯'}</span>
            <input
              className="draft-card__input"
              value={action.text}
              readOnly={readOnly}
              placeholder="写一件本周能做的事"
              onChange={(event) => updateAction(index, event.target.value)}
            />
            {readOnly ? null : (
              <button
                type="button"
                className="draft-card__remove"
                title="移除"
                onClick={() => removeAction(index)}
              >
                <X size={12} strokeWidth={2.5} />
              </button>
            )}
          </div>
        ))}
        {readOnly ? null : (
          <button type="button" className="link-btn" onClick={addAction}>
            ＋ 再加一条
          </button>
        )}
      </div>

      {draft.rationale ? <p className="draft-card__why">依据：{draft.rationale}</p> : null}

      {readOnly ? (
        <p className="draft-card__hint">示例对话里的草案不能直接采纳，你需要开始自己的对话。</p>
      ) : done ? (
        <p className="draft-card__hint">已写入「行动」，当前矛盾已更新。</p>
      ) : (
        <div className="draft-card__actions">
          <button type="button" className="btn btn--primary" onClick={confirm}>
            确认写入
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setDone(true)}
          >
            先不采纳
          </button>
        </div>
      )}
    </section>
  )
}

export function DraftAddIcon(): React.JSX.Element {
  return <Plus size={12} strokeWidth={2.5} />
}
