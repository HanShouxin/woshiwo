import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, X } from 'lucide-react'
import Page from '../components/Page'
import EditableText from '../components/EditableText'
import Modal from '../components/Modal'
import { addProfileCard, deleteProfileCard, listProfileCards, updateProfileCard } from '../db/repo'
import { CATEGORY_PRESETS, DEFAULT_CATEGORY } from '../db/presets'

export default function Current(): React.JSX.Element {
  const cards = useLiveQuery(listProfileCards, [], [])
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState(DEFAULT_CATEGORY)
  const [content, setContent] = useState('')
  const [customMode, setCustomMode] = useState(false)
  const [customCategory, setCustomCategory] = useState('')

  const used = [...new Set(cards.map((card) => card.category))]
  const options = [...new Set([...used, ...CATEGORY_PRESETS.map((item) => item.category)])]
  const example =
    CATEGORY_PRESETS.find((item) => item.category === category)?.example ?? '用一句话写下来'

  function openModal(): void {
    setOpen(true)
    setContent('')
    setCustomMode(false)
    setCustomCategory('')
  }

  function closeModal(): void {
    setOpen(false)
    setContent('')
    setCustomMode(false)
    setCustomCategory('')
  }

  async function submit(): Promise<void> {
    const finalCategory = (customMode ? customCategory : category).trim()
    if (!finalCategory || !content.trim()) return
    await addProfileCard(finalCategory, content.trim())
    closeModal()
  }

  return (
    <Page
      title="现状"
      desc="记录你现在拥有什么、处于什么状态。写得越具体，AI 对你的处境判断越准。"
      wide
    >
      {cards.length === 0 ? (
        <div className="empty">
          还没有记录。
          <span className="empty__hint">从一张卡片开始——比如「资产：有一辆电瓶车」。</span>
          <div className="choices" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn--primary" onClick={openModal}>
              <Plus size={14} strokeWidth={2} />
              记一笔
            </button>
          </div>
        </div>
      ) : (
        <div className="card-grid">
          {cards.map((card) => (
            <article className="info-card" key={card.id}>
              <button
                type="button"
                className="row__action row__action--danger info-card__delete"
                title="删除"
                onClick={() => void deleteProfileCard(card.id)}
              >
                <X size={13} strokeWidth={2} />
              </button>
              <span className="info-card__head">
                <span className="info-card__category">{card.category}</span>
                <span className="info-card__mark">{card.category.slice(0, 1)}</span>
              </span>
              <div className="info-card__body">
                <EditableText
                  multiline
                  value={card.content}
                  onSave={(next) => void updateProfileCard(card.id, { content: next })}
                />
              </div>
            </article>
          ))}

          <button type="button" className="info-card info-card--add" onClick={openModal}>
            <Plus size={16} strokeWidth={1.75} />
            <span>再记一笔</span>
          </button>
        </div>
      )}

      {open ? (
        <Modal
          title="记一笔"
          onClose={closeModal}
          footer={
            <>
              <button type="button" className="btn btn--ghost" onClick={closeModal}>
                取消
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!content.trim() || (customMode && !customCategory.trim())}
                onClick={() => void submit()}
              >
                添加
              </button>
            </>
          }
        >
          <div className="form-field">
            <span className="form-field__label">分类</span>
            <div className="category-bar">
              {options.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`chip${!customMode && category === item ? ' chip--active' : ''}`}
                  onClick={() => {
                    setCustomMode(false)
                    setCategory(item)
                  }}
                >
                  {item}
                </button>
              ))}
              <button
                type="button"
                className={`chip chip--ghost${customMode ? ' chip--active' : ''}`}
                onClick={() => setCustomMode(true)}
              >
                ＋ 自定义
              </button>
            </div>

            {customMode ? (
              <input
                className="add-input"
                autoFocus
                placeholder="两字分类，比如「爱好」"
                maxLength={6}
                value={customCategory}
                onChange={(event) => setCustomCategory(event.target.value)}
              />
            ) : null}
          </div>

          <label className="form-field">
            <span className="form-field__label">内容</span>
            <textarea
              className="modal__textarea"
              autoFocus={!customMode}
              rows={3}
              placeholder={customMode ? '用一句话写下来' : example}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void submit()
              }}
            />
          </label>
        </Modal>
      ) : null}
    </Page>
  )
}
