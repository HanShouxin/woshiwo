import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, GripVertical, X } from 'lucide-react'
import Page from '../components/Page'
import EditableText from '../components/EditableText'
import Modal from '../components/Modal'
import { formatDate } from '../lib/format'
import { moveItem } from '../lib/reorder'
import {
  addViewpoint,
  deleteViewpoint,
  listViewpoints,
  reorderViewpoints,
  updateViewpoint
} from '../db/repo'
import { CORE_THOUGHT } from '../../../shared/constants'

export default function Self(): React.JSX.Element {
  const viewpoints = useLiveQuery(listViewpoints, [], [])
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [source, setSource] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [overAfter, setOverAfter] = useState(false)

  async function handleDrop(targetId: string): Promise<void> {
    const fromId = draggingId
    const after = overAfter
    setDraggingId(null)
    setOverId(null)
    setOverAfter(false)
    if (!fromId || fromId === targetId) return

    const next = moveItem(
      viewpoints.map((item) => item.id),
      fromId,
      targetId,
      after
    )
    if (next) await reorderViewpoints(next)
  }

  function closeModal(): void {
    setOpen(false)
    setDraft('')
    setSource('')
  }

  async function submit(): Promise<void> {
    const text = draft.trim()
    if (!text) return
    await addViewpoint(text, source.trim() || undefined)
    closeModal()
  }

  return (
    <Page title="我是我" desc="值得长期记住的认识。它们会影响我之后怎么帮你看问题。">
      <figure className="core-thought">
        <span className="core-thought__label">核心思想</span>
        <blockquote className="core-thought__text">{CORE_THOUGHT}</blockquote>
        <figcaption className="core-thought__source">——《矛盾论》（毛泽东）</figcaption>
      </figure>

      <div className="self-actions">
        <button type="button" className="btn btn--primary" onClick={() => setOpen(true)}>
          <Plus size={14} strokeWidth={2} />
          记一条感悟
        </button>
      </div>

      {viewpoints.length === 0 ? (
        <div className="empty" style={{ marginTop: 20 }}>
          还没有感悟。
          <span className="empty__hint">随手记一句就够，不用写得漂亮。</span>
        </div>
      ) : (
        <section className="feed">
          {viewpoints.map((item) => (
            <article
              className={`feed-item${draggingId === item.id ? ' feed-item--dragging' : ''}${
                overId === item.id && draggingId !== item.id
                  ? overAfter
                    ? ' feed-item--over-after'
                    : ' feed-item--over-before'
                  : ''
              }`}
              key={item.id}
              onDragOver={(event) => {
                if (!draggingId) return
                event.preventDefault()
                // 指针在条目上半区 → 插到它前面；下半区 → 插到它后面
                const rect = event.currentTarget.getBoundingClientRect()
                setOverId(item.id)
                setOverAfter(event.clientY - rect.top > rect.height / 2)
              }}
              onDragLeave={() => setOverId((prev) => (prev === item.id ? null : prev))}
              onDrop={(event) => {
                event.preventDefault()
                void handleDrop(item.id)
              }}
            >
              <button
                type="button"
                className="feed-item__grip"
                draggable
                title="拖动调整顺序"
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', item.id)
                  setDraggingId(item.id)
                }}
                onDragEnd={() => {
                  setDraggingId(null)
                  setOverId(null)
                }}
              >
                <GripVertical size={13} strokeWidth={2} />
              </button>

              <button
                type="button"
                className="feed-item__delete"
                title="删除"
                onClick={() => void deleteViewpoint(item.id)}
              >
                <X size={13} strokeWidth={2} />
              </button>

              <EditableText
                multiline
                value={item.content}
                className="feed-item__text"
                onSave={(next) => void updateViewpoint(item.id, { content: next })}
              />

              <footer className="feed-item__foot">
                <span className="feed-item__date">{formatDate(item.createdAt)}</span>
                <EditableText
                  value={item.source ?? ''}
                  placeholder="＋ 来源（选填）"
                  className="feed-item__source"
                  onSave={(next) => void updateViewpoint(item.id, { source: next })}
                />
              </footer>
            </article>
          ))}
        </section>
      )}

      {open ? (
        <Modal
          title="记一条感悟"
          onClose={closeModal}
          footer={
            <>
              <button type="button" className="btn btn--ghost" onClick={closeModal}>
                取消
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!draft.trim()}
                onClick={() => void submit()}
              >
                记下
              </button>
            </>
          }
        >
          <label className="form-field">
            <span className="form-field__label">感悟</span>
            <textarea
              className="modal__textarea"
              autoFocus
              rows={4}
              placeholder="今天想明白了什么？"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void submit()
              }}
            />
          </label>

          <label className="form-field">
            <span className="form-field__label">来源（选填）</span>
            <input
              className="add-input"
              placeholder="比如《矛盾论》、某次谈话、一本书"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void submit()
              }}
            />
          </label>
        </Modal>
      ) : null}
    </Page>
  )
}
