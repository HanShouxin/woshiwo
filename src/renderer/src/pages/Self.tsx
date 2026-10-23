import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { X } from 'lucide-react'
import Page from '../components/Page'
import EditableText from '../components/EditableText'
import { addViewpoint, deleteViewpoint, listViewpoints, updateViewpoint } from '../db/repo'
import { CORE_THOUGHT } from '../../../shared/constants'

export default function Self(): React.JSX.Element {
  const viewpoints = useLiveQuery(listViewpoints, [], [])
  const [draft, setDraft] = useState('')
  const [source, setSource] = useState('')
  const [showSource, setShowSource] = useState(false)

  async function submit(): Promise<void> {
    const text = draft.trim()
    if (!text) return
    await addViewpoint(text, source.trim() || undefined)
    setDraft('')
    setSource('')
    setShowSource(false)
  }

  return (
    <Page title="我是我" desc="值得长期记住的认识。它们会影响我之后怎么帮你看问题。">
      <figure className="core-thought">
        <span className="core-thought__label">核心思想</span>
        <blockquote className="core-thought__text">{CORE_THOUGHT}</blockquote>
        <figcaption className="core-thought__source">——《矛盾论》（毛泽东）</figcaption>
      </figure>

      <div className="add-block">
        <div className="add-row" style={{ marginTop: 0 }}>
          <input
            className="add-input"
            placeholder="今天想明白了什么？"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) void submit()
            }}
          />
          <button type="button" className="btn btn--primary" onClick={() => void submit()}>
            记下
          </button>
        </div>
        {showSource ? (
          <input
            className="add-input source-field"
            autoFocus
            placeholder="来源（选填），比如《矛盾论》"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submit()
            }}
          />
        ) : (
          <button type="button" className="link-btn" onClick={() => setShowSource(true)}>
            ＋ 添加来源
          </button>
        )}
      </div>

      {viewpoints.length === 0 ? (
        <div className="empty" style={{ marginTop: 24 }}>
          还没有感悟。
          <span className="empty__hint">随手记一句就够，不用写得漂亮。</span>
        </div>
      ) : (
        <section className="viewpoints">
          {viewpoints.map((item) => (
            <article className="viewpoint" key={item.id}>
              <div className="row">
                <EditableText
                  multiline
                  value={item.content}
                  onSave={(next) => void updateViewpoint(item.id, { content: next })}
                />
                <button
                  type="button"
                  className="row__action row__action--danger"
                  title="删除"
                  onClick={() => void deleteViewpoint(item.id)}
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </div>
              <EditableText
                value={item.source ?? ''}
                placeholder="＋ 添加来源（选填）"
                className="viewpoint__source"
                onSave={(next) => void updateViewpoint(item.id, { source: next })}
              />
            </article>
          ))}
        </section>
      )}
    </Page>
  )
}
