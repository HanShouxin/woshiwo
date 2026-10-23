import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowUp } from 'lucide-react'
import { parseDraftBlocks } from '../ai/draft'
import { ensureSampleSession } from '../ai/sampleSession'
import DraftCard from '../components/DraftCard'
import {
  appendMessage,
  createSession,
  listMessages,
  listSessions,
  updateMessage
} from '../db/chatRepo'
import { addAction, setCurrentContradiction } from '../db/repo'
import { SETTINGS_PATH } from '../../../shared/constants'
import type { DraftPayload } from '../../../shared/constants'

const PROMPTS = [
  '最近有点迷茫，不知道应该先做什么。',
  '我有几个想实现的愿望，想理清优先顺序。',
  '我想回顾之前的计划，看看接下来该做什么。'
] as const

const NO_MODEL_NOTICE = '这句话已经记下了。还没有接入 AI 模型——去设置里配置一个，我们就能接着往下分析。'

/** 把 **粗体** 和换行渲染成可读段落 */
function renderText(text: string): React.JSX.Element[] {
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line, index) => (
      <p className="msg__p" key={index}>
        {line.split(/(\*\*[^*]+\*\*)/g).map((part, partIndex) =>
          part.startsWith('**') && part.endsWith('**') ? (
            <strong key={partIndex}>{part.slice(2, -2)}</strong>
          ) : (
            <span key={partIndex}>{part}</span>
          )
        )}
      </p>
    ))
}

export default function Home(): React.JSX.Element {
  const sessions = useLiveQuery(listSessions, [], [])
  const [activeId, setActiveId] = useState<string | null>(null)
  const messages = useLiveQuery(
    () => (activeId ? listMessages(activeId) : Promise.resolve([])),
    [activeId],
    []
  )
  const [input, setInput] = useState('')
  const [notice, setNotice] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    void ensureSampleSession()
  }, [])

  useEffect(() => {
    if (!activeId && sessions.length > 0) setActiveId(sessions[0].id)
  }, [sessions, activeId])

  const activeSession = sessions.find((session) => session.id === activeId)
  const isSample = activeSession?.kind === 'sample'
  const isEmpty = messages.length === 0

  async function newChat(): Promise<void> {
    const id = await createSession()
    setActiveId(id)
    setInput('')
    setNotice('')
    setHistoryOpen(false)
  }

  async function send(): Promise<void> {
    const text = input.trim()
    if (!text) return

    let sessionId = activeId
    // 示例会话不写入用户内容：从示例直接进入自己的对话
    if (!sessionId || isSample) {
      sessionId = await createSession(text.slice(0, 16))
      setActiveId(sessionId)
    }

    await appendMessage({ sessionId, role: 'user', content: text })
    setInput('')
    setNotice(NO_MODEL_NOTICE)
  }

  async function applyDraft(payload: DraftPayload, messageId: string): Promise<void> {
    const { id } = await setCurrentContradiction({
      text: payload.contradiction,
      goalTitleSnapshot: payload.goal
    })
    for (const action of payload.actions) {
      await addAction(action.type, action.text, action.type === 'step' ? id : undefined)
    }
    await updateMessage(messageId, { draftState: 'confirmed' })
  }

  return (
    <div className="chat">
      <div className="chat__scroll">
        <div className="chat__inner">
          {isEmpty ? (
            <div className="chat__welcome">
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
                      setInput(prompt)
                      setNotice('')
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => {
              const parsed = parseDraftBlocks(message.content)
              return (
                <div className={`msg msg--${message.role}`} key={message.id}>
                  {message.role === 'user' ? (
                    <div className="msg__bubble">{message.content}</div>
                  ) : (
                    <>
                      {parsed.text ? <div className="msg__body">{renderText(parsed.text)}</div> : null}
                      {parsed.drafts.map((draft, index) => (
                        <DraftCard
                          key={index}
                          draft={draft}
                          readOnly={isSample}
                          onConfirm={(payload) => void applyDraft(payload, message.id)}
                        />
                      ))}
                      {isSample ? <p className="msg__source">参考：示例数据</p> : null}
                    </>
                  )}
                </div>
              )
            })
          )}

          {notice ? <p className="chat__notice">{notice}</p> : null}
        </div>
      </div>

      <div className="chat__composer">
        <div className="chat__composer-inner">
          <div className="composer__box">
            <textarea
              className="composer__input"
              placeholder={isSample ? '开始你自己的对话…' : '说一件最近困扰你的事…'}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void send()
                }
              }}
            />
            <div className="composer__bar">
              <button type="button" className="btn btn--ghost" onClick={() => void newChat()}>
                ＋ 新对话
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setHistoryOpen((value) => !value)}
              >
                历史对话
              </button>

              {historyOpen ? (
                <div className="history-pop">
                  {sessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      className={`history-pop__item${
                        session.id === activeId ? ' history-pop__item--active' : ''
                      }`}
                      onClick={() => {
                        setActiveId(session.id)
                        setHistoryOpen(false)
                        setNotice('')
                      }}
                    >
                      <span className="history-pop__title">{session.title}</span>
                      {session.kind === 'sample' ? (
                        <span className="history-pop__kind">示例</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="composer__bar-right">
                <Link to={SETTINGS_PATH} className="model-status">
                  <span className="model-status__dot" />
                  未配置 AI · 去设置
                </Link>
                <button
                  type="button"
                  className={`send-btn${input.trim() ? ' send-btn--ready' : ''}`}
                  title="发送（Enter）"
                  disabled={!input.trim()}
                  onClick={() => void send()}
                >
                  <ArrowUp size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
