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

/**
 * 未保存的草稿（模块级，仅内存）。
 * 作用：切换页面回来内容还在；**只有点「保存」才写入本地数据库**。
 */
let pendingDraft: { id: string | null; title: string; content: string } | null = null

export default function Reviews(): React.JSX.Element {
  const list = useLiveQuery(listReflections, [], [])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState('')
  /** 是否处于编辑态——空态与编辑器之间的开关，不能靠"有没有内容"推断 */
  const [editing, setEditing] = useState(false)

  const active = selectedId ? list.find((item) => item.id === selectedId) : undefined

  // 回到本页时恢复未保存的草稿
  useEffect(() => {
    if (!pendingDraft) return
    setSelectedId(pendingDraft.id)
    setTitle(pendingDraft.title)
    setContent(pendingDraft.content)
    setDirty(true)
    setEditing(true)
    setStatus('')
  }, [])

  function remember(next: { title: string; content: string }): void {
    pendingDraft = { id: selectedId, ...next }
    setDirty(true)
  }

  function openSaved(id: string): void {
    if (dirty && !window.confirm('当前修改还没保存，切换后会丢失。确定切换吗？')) return
    const item = list.find((entry) => entry.id === id)
    if (!item) return
    pendingDraft = null
    setSelectedId(id)
    setTitle(item.title)
    setContent(item.content)
    setDirty(false)
    setEditing(true)
    setStatus('')
  }

  function startNew(): void {
    if (dirty && !window.confirm('当前修改还没保存，新建后会丢失。确定新建吗？')) return
    pendingDraft = null
    setSelectedId(null)
    setTitle('')
    setContent('')
    setDirty(false)
    setEditing(true)
    setStatus('')
  }

  async function save(): Promise<void> {
    const nextTitle = title.trim()
    if (!nextTitle) {
      setStatus('标题必填')
      return
    }
    if (selectedId) {
      await updateReflection(selectedId, { title: nextTitle, content })
    } else {
      const id = await createReflection()
      await updateReflection(id, { title: nextTitle, content })
      setSelectedId(id)
    }
    pendingDraft = null
    setDirty(false)
    setStatus(`已保存 · ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`)
  }

  async function remove(id: string): Promise<void> {
    if (!window.confirm('删除这篇复盘？删除后无法恢复。')) return
    await deleteReflection(id)
    pendingDraft = null
    setSelectedId(null)
    setTitle('')
    setContent('')
    setDirty(false)
    // 删完之后如果一篇都不剩，回到空态
    setEditing(list.filter((item) => item.id !== id).length > 0)
    setStatus('')
  }

  const hasList = list.length > 0

  return (
    <Page title="复盘" desc="写给自己看。不分析、不打分、不给建议，只是一个安静的地方。">
      <span className="privacy-note">
        <Lock size={13} strokeWidth={1.75} />
        仅保存在本地，AI 无法读取
      </span>

      {!hasList && !editing ? (
        <div className="empty" style={{ marginTop: 24 }}>
          还没有写下的字。
          <span className="empty__hint">等你想说点什么的时候，它就在这里。</span>
          <div className="choices" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn--primary" onClick={startNew}>
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
                  selectedId === item.id ? ' reviews__item--active' : ''
                }${item.title.trim() ? '' : ' reviews__item--untitled'}`}
                onClick={() => openSaved(item.id)}
              >
                {item.title.trim() || '未命名'}
              </button>
            ))}
            <button type="button" className="reviews__item" onClick={startNew}>
              ＋ 新的一篇
            </button>
          </div>

          <div className="reviews__editor">
            <input
              className="reviews__title"
              placeholder="标题（必填）"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value)
                remember({ title: event.target.value, content })
                setStatus('')
              }}
            />
            {!title.trim() ? (
              <p className="reviews__warn">标题必填——导出复盘时，它就是这一篇的文件名</p>
            ) : null}

            <textarea
              className="reviews__content"
              placeholder="想写什么都可以。"
              value={content}
              onChange={(event) => {
                setContent(event.target.value)
                remember({ title, content: event.target.value })
                setStatus('')
              }}
            />

            <div className="reviews__foot">
              <span className={`reviews__status${dirty ? ' reviews__status--dirty' : ''}`}>
                {dirty
                  ? '有未保存的修改'
                  : status || (active ? `创建于 ${formatDate(active.createdAt)}` : '新的一篇')}
              </span>

              <div className="reviews__foot-actions">
                {active ? (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ fontSize: 12, height: 28, padding: '0 10px' }}
                    onClick={() => void remove(active.id)}
                  >
                    <Trash2 size={12} strokeWidth={2} />
                    删除
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={!dirty || !title.trim()}
                  onClick={() => void save()}
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Page>
  )
}
