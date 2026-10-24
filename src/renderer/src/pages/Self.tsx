import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, X } from 'lucide-react'
import Page from '../components/Page'
import EditableText from '../components/EditableText'
import Modal from '../components/Modal'
import { formatDate } from '../lib/format'
import { addViewpoint, deleteViewpoint, listViewpoints, updateViewpoint } from '../db/repo'
import { CORE_THOUGHT } from '../../../shared/constants'

export default function Self(): React.JSX.Element {
  const viewpoints = useLiveQuery(listViewpoints, [], [])
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [source, setSource] = useState('')

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
        <section className="viewpoints">
          {viewpoints.map((item) => (
            <article className="core-thought viewpoint-card" key={item.id}>
              <button
                type="button"
                className="viewpoint-card__delete"
                title="删除"
                onClick={() => void deleteViewpoint(item.id)}
              >
                <X size={13} strokeWidth={2} />
              </button>

              <span className="core-thought__label">{formatDate(item.createdAt)}</span>

              <EditableText
                multiline
                value={item.content}
                className="viewpoint-card__text"
                onSave={(next) => void updateViewpoint(item.id, { content: next })}
              />

              <div className="viewpoint-card__source">
                <EditableText
                  value={item.source ?? ''}
                  placeholder="＋ 添加来源（选填）"
                  className="source-inline"
                  onSave={(next) => void updateViewpoint(item.id, { source: next })}
                />
              </div>
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
