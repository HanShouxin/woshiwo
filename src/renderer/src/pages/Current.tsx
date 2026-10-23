import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, X } from 'lucide-react'
import Page from '../components/Page'
import EditableText from '../components/EditableText'
import { addProfileCard, deleteProfileCard, listProfileCards, updateProfileCard } from '../db/repo'
import { CATEGORY_PRESETS, DEFAULT_CATEGORY } from '../db/presets'

export default function Current(): React.JSX.Element {
  const cards = useLiveQuery(listProfileCards, [], [])
  const [category, setCategory] = useState(DEFAULT_CATEGORY)
  const [content, setContent] = useState('')
  const [customMode, setCustomMode] = useState(false)
  const [customCategory, setCustomCategory] = useState('')
  const [composing, setComposing] = useState(false)

  const used = [...new Set(cards.map((card) => card.category))]
  const options = [...new Set([...used, ...CATEGORY_PRESETS.map((item) => item.category)])]
  const example =
    CATEGORY_PRESETS.find((item) => item.category === category)?.example ?? '用一句话写下来'

  async function submit(): Promise<void> {
    const finalCategory = (customMode ? customCategory : category).trim()
    if (!finalCategory || !content.trim()) return
    await addProfileCard(finalCategory, content.trim())
    setContent('')
    if (customMode) {
      setCustomCategory('')
      setCustomMode(false)
    }
    setComposing(false)
  }

  return (
    <Page
      title="现状"
      desc="记录你现在拥有什么、处于什么状态。写得越具体，AI 对你的处境判断越准。"
      wide
    >
      {cards.length === 0 && !composing ? (
        <div className="empty">
          还没有记录。
          <span className="empty__hint">从一张卡片开始——比如「资产：有一辆电瓶车」。</span>
          <div className="choices" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn--primary" onClick={() => setComposing(true)}>
              <Plus size={14} strokeWidth={2} />
              记一笔
            </button>
          </div>
        </div>
      ) : null}

      {cards.length > 0 ? (
        <div className="card-grid">
          {cards.map((card) => (
            <article className="info-card" key={card.id}>
              <header className="info-card__head">
                <span className="info-card__category">{card.category}</span>
                <button
                  type="button"
                  className="row__action row__action--danger info-card__delete"
                  title="删除"
                  onClick={() => void deleteProfileCard(card.id)}
                >
                  <X size={13} strokeWidth={2} />
                </button>
              </header>
              <div className="info-card__body">
                <EditableText
                  multiline
                  value={card.content}
                  onSave={(next) => void updateProfileCard(card.id, { content: next })}
                />
              </div>
            </article>
          ))}

          <button
            type="button"
            className="info-card info-card--add"
            onClick={() => setComposing(true)}
          >
            <Plus size={18} strokeWidth={1.75} />
            <span>再记一笔</span>
          </button>
        </div>
      ) : null}

      {composing ? (
        <div className="compose-panel">
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

          <div className="add-row">
            <input
              className="add-input"
              autoFocus={!customMode}
              placeholder={example}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void submit()
              }}
            />
            <button type="button" className="btn btn--primary" onClick={() => void submit()}>
              添加
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setComposing(false)
                setCustomMode(false)
                setCustomCategory('')
              }}
            >
              取消
            </button>
          </div>
        </div>
      ) : null}
    </Page>
  )
}
