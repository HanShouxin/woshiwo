import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { X } from 'lucide-react'
import Page from '../components/Page'
import EditableText from '../components/EditableText'
import { addProfileCard, deleteProfileCard, listProfileCards, updateProfileCard } from '../db/repo'
import { CATEGORY_PRESETS, DEFAULT_CATEGORY } from '../db/presets'
import type { ProfileCard } from '../db/types'

export default function Current(): React.JSX.Element {
  const cards = useLiveQuery(listProfileCards, [], [])
  const [category, setCategory] = useState(DEFAULT_CATEGORY)
  const [content, setContent] = useState('')
  const [customMode, setCustomMode] = useState(false)
  const [customCategory, setCustomCategory] = useState('')

  const used = [...new Set(cards.map((card) => card.category))]
  const options = [...new Set([...used, ...CATEGORY_PRESETS.map((item) => item.category)])]
  const example =
    CATEGORY_PRESETS.find((item) => item.category === category)?.example ?? '用一句话写下来'

  const grouped = new Map<string, ProfileCard[]>()
  for (const card of cards) {
    const bucket = grouped.get(card.category) ?? []
    bucket.push(card)
    grouped.set(card.category, bucket)
  }

  async function submit(): Promise<void> {
    const finalCategory = (customMode ? customCategory : category).trim()
    if (!finalCategory || !content.trim()) return
    await addProfileCard(finalCategory, content.trim())
    setContent('')
    if (customMode) {
      setCustomCategory('')
      setCustomMode(false)
    }
  }

  return (
    <Page
      title="现状"
      desc="记录你现在拥有什么、处于什么状态。写得越具体，AI 对你的处境判断越准。"
    >
      {cards.length === 0 ? (
        <div className="empty">
          还没有记录。
          <span className="empty__hint">从下面挑一个分类，写一句就够——比如「有一辆电瓶车」。</span>
        </div>
      ) : null}

      {[...grouped.entries()].map(([groupName, items]) => (
        <section className="group" key={groupName}>
          <h2 className="group__title">
            {groupName}
            <span className="group__count">{items.length}</span>
          </h2>
          {items.map((card) => (
            <div className="row" key={card.id}>
              <EditableText
                value={card.content}
                onSave={(next) => void updateProfileCard(card.id, { content: next })}
              />
              <button
                type="button"
                className="row__action row__action--danger"
                title="删除"
                onClick={() => void deleteProfileCard(card.id)}
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>
          ))}
        </section>
      ))}

      <div className="add-row" style={{ marginTop: 28 }}>
        {customMode ? (
          <input
            className="add-input"
            style={{ flex: '0 0 108px' }}
            placeholder="两字分类"
            maxLength={6}
            value={customCategory}
            onChange={(event) => setCustomCategory(event.target.value)}
          />
        ) : (
          <select
            className="add-input"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {options.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        )}
        <input
          className="add-input"
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
          onClick={() => setCustomMode((value) => !value)}
        >
          {customMode ? '预设' : '自定义'}
        </button>
      </div>
    </Page>
  )
}
