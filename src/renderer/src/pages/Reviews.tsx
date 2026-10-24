import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Lock, Plus, Trash2 } from 'lucide-react'
import Page from '../components/Page'
import { formatDate } from '../lib/format'
import {
  createReflection,
  deleteReflection,
  listReflections,
  updateReflection
} from '../db/repo'


export default function Reviews(): React.JSX.Element {
  const list = useLiveQuery(listReflections, [], [])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [savedAt, setSavedAt] = useState<string>('')

  const active = list.find((item) => item.id === selectedId) ?? list[0]

  useEffect(() => {
    if (!active) {
      setTitle('')
      setContent('')
      return
    }
    setTitle(active.title)
    setContent(active.content)
  }, [active?.id])

  // 自动保存：停止输入 700ms 后落库，无「保存」按钮
  useEffect(() => {
    if (!active) return
    if (title === active.title && content === active.content) return
    const timer = setTimeout(() => {
      void updateReflection(active.id, { title, content }).then(() => {
        setSavedAt(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))
      })
    }, 700)
    return () => clearTimeout(timer)
  }, [title, content, active?.id])

  async function create(): Promise<void> {
    const id = await createReflection()
    setSelectedId(id)
  }

  async function remove(id: string): Promise<void> {
    await deleteReflection(id)
    setSelectedId(null)
  }

  return (
    <Page title="复盘" desc="写给自己看。不分析、不打分、不给建议，只是一个安静的地方。">
      <span className="privacy-note">
        <Lock size={13} strokeWidth={1.75} />
        仅保存在本地，AI 无法读取
      </span>

      {list.length === 0 ? (
        <div className="empty" style={{ marginTop: 24 }}>
          还没有写下的字。
          <span className="empty__hint">等你想说点什么的时候，它就在这里。</span>
          <div className="choices" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn--primary" onClick={() => void create()}>
              <Plus size={14} strokeWidth={2} />
              写第一篇
            </button>
          </div>
        </div>
      ) : (
        <div className="reviews" style={{ marginTop: 24 }}>
          <div className="reviews__list">
            {list.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`reviews__item${
                  active?.id === item.id ? ' reviews__item--active' : ''
                }${item.title.trim() ? '' : ' reviews__item--untitled'}`}
                onClick={() => setSelectedId(item.id)}
              >
                {item.title.trim() || '未命名 · 补个标题'}
              </button>
            ))}
            <button type="button" className="reviews__item" onClick={() => void create()}>
              ＋ 新的一篇
            </button>
          </div>

          <div className="reviews__editor">
            <input
              className="reviews__title"
              placeholder="标题（必填）"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            {!title.trim() ? (
              <p className="reviews__warn">标题必填——导出复盘时，它就是这一篇的文件名</p>
            ) : null}
            <textarea
              className="reviews__content"
              placeholder="想写什么都可以。"
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
            <div className="reviews__hint">
              {savedAt ? `已自动保存 ${savedAt}` : '自动保存'}
              {active ? ` · 创建于 ${formatDate(active.createdAt)}` : ''}
              {active ? (
                <button
                  type="button"
                  className="btn btn--ghost"
                  style={{ marginLeft: 12, height: 24, padding: '0 8px', fontSize: 12 }}
                  onClick={() => void remove(active.id)}
                >
                  <Trash2 size={12} strokeWidth={2} />
                  删除这篇
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </Page>
  )
}
