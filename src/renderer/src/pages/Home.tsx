import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SETTINGS_PATH } from '../../../shared/constants'

const PROMPTS = [
  '最近有点迷茫，不知道应该先做什么。',
  '我有几个想实现的愿望，想理清优先顺序。',
  '我想回顾之前的计划，看看接下来该做什么。'
] as const

export default function Home(): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const [notice, setNotice] = useState('')

  function handleSend(): void {
    if (!draft.trim()) return
    setNotice('还没有接入 AI 模型。先在设置里配置模型，我们就能开始了。')
  }

  return (
    <div className="home">
      <div className="home__body">
        <h1 className="home__title">今天，先从你最在意的事开始。</h1>
        <p className="home__subtitle">
          不必一开始就想清楚。把真实想法告诉我，我们一起理清现状，找到下一步。
        </p>

        <div className="home__prompts">
          {PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="prompt-chip"
              onClick={() => {
                setDraft(prompt)
                setNotice('')
              }}
            >
              {prompt}
            </button>
          ))}
        </div>

        {notice ? (
          <p className="muted" style={{ marginTop: 20 }}>
            {notice}
          </p>
        ) : null}
      </div>

      <div className="composer">
        <div className="composer__box">
          <textarea
            className="composer__input"
            placeholder="说一件最近困扰你的事…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                handleSend()
              }
            }}
          />
          <div className="composer__bar">
            <button type="button" className="btn btn--ghost">
              ＋ 新对话
            </button>
            <button type="button" className="btn btn--ghost">
              历史对话
            </button>
            <div className="composer__bar-right">
              <Link to={SETTINGS_PATH} className="model-status">
                <span className="model-status__dot" />
                未配置 AI · 去设置
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
