import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDown, ArrowUp, Square } from 'lucide-react'
import { parseDraftBlocks } from '../ai/draft'
import { ensureSampleSession } from '../ai/sampleSession'
import { abortChat, startChat } from '../ai/client'
import { buildContext } from '../ai/context'
import { getIntegrationStatus, subscribeIntegration } from '../ai/integrate'
import DraftCard from '../components/DraftCard'
import SourceRow from '../components/SourceRow'
import {
  appendMessage,
  createSession,
  listMessages,
  listSessions,
  updateMessage
} from '../db/chatRepo'
import { addAction, getSetting, setCurrentContradiction } from '../db/repo'
import { SETTINGS_PATH } from '../../../shared/constants'
import type { AIConfigEntry, DraftPayload } from '../../../shared/constants'

const PROMPTS = [
  '最近有点迷茫，不知道应该先做什么。',
  '我有几个想实现的愿望，想理清优先顺序。',
  '我想回顾之前的计划，看看接下来该做什么。'
] as const

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
  const [liveText, setLiveText] = useState('')
  const [streamId, setStreamId] = useState<string | null>(null)
  const liveRef = useRef('')
  const streamRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  /** 用户是否停在底部：在底部时新消息自动跟随，往上翻时不打扰 */
  const stickToBottom = useRef(true)
  const [showJump, setShowJump] = useState(false)

  // 设置页保存配置后这里会自动更新（appSettings 变化会触发 live query）
  const config = useLiveQuery(
    async () => {
      const list = await getSetting<AIConfigEntry[]>('aiConfigs', [])
      const savedId = await getSetting<string>('activeConfigId', '')
      return list.find((item) => item.id === savedId) ?? list[0] ?? null
    },
    [],
    null
  )

  useEffect(() => {
    void ensureSampleSession()
    return () => {
      // 离开页面时停掉未完成的请求，避免后台空转
      if (streamRef.current) abortChat(streamRef.current)
    }
  }, [])

  useEffect(() => {
    if (!activeId && sessions.length > 0) setActiveId(sessions[0].id)
  }, [sessions, activeId])

  function scrollToBottom(smooth = true): void {
    const element = scrollRef.current
    if (!element) return
    element.scrollTo({ top: element.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
    stickToBottom.current = true
    setShowJump(false)
  }

  function handleScroll(): void {
    const element = scrollRef.current
    if (!element) return
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight
    stickToBottom.current = distance < 90
    setShowJump(distance > 180)
  }

  // 换会话：直接落到最新
  useEffect(() => {
    stickToBottom.current = true
    scrollToBottom(false)
  }, [activeId])

  // 新消息 / 流式输出：只有本来就停在底部时才跟随
  useEffect(() => {
    if (stickToBottom.current) scrollToBottom(false)
  }, [messages.length, liveText])

  const activeSession = sessions.find((session) => session.id === activeId)
  const isSample = activeSession?.kind === 'sample'
  const isEmpty = messages.length === 0 && !liveText
  const modelReady = Boolean(config?.model && config?.baseUrl)
  const integrating =
    useSyncExternalStore(subscribeIntegration, getIntegrationStatus) === 'running'

  async function newChat(): Promise<void> {
    const id = await createSession()
    setActiveId(id)
    setInput('')
    setNotice('')
    setHistoryOpen(false)
  }

  async function send(): Promise<void> {
    const text = input.trim()
    if (!text || streamId) return

    let sessionId = activeId
    // 示例会话不写用户内容：从这里直接进入自己的对话
    if (!sessionId || isSample) {
      sessionId = await createSession(text.slice(0, 16))
      setActiveId(sessionId)
    }

    const history = messages.map((message) => ({
      role: message.role,
      content: message.content
    }))

    await appendMessage({ sessionId, role: 'user', content: text })
    setInput('')
    setNotice('')

    if (!config || !modelReady) {
      setNotice('这句话已经记下了。还没有接入 AI 模型——去设置里配置一个，我们就能接着往下分析。')
      return
    }

    const { turns, sources } = await buildContext({
      history: [...history, { role: 'user', content: text }]
    })

    liveRef.current = ''
    setLiveText('')
    const handle = startChat({
      config,
      configId: config.id,
      messages: turns,
      onDelta: (chunk) => {
        liveRef.current += chunk
        setLiveText(liveRef.current)
      }
    })
    setStreamId(handle.requestId)
    streamRef.current = handle.requestId

    const result = await handle.done
    setStreamId(null)
    streamRef.current = null
    const partial = liveRef.current
    setLiveText('')
    liveRef.current = ''

    if (result.ok) {
      await appendMessage({ sessionId, role: 'assistant', content: result.text, sources })
    } else if (result.aborted) {
      if (partial.trim()) {
        await appendMessage({
          sessionId,
          role: 'assistant',
          content: `${partial}\n\n（已停止生成）`,
          status: 'interrupted'
        })
      }
    } else {
      setNotice(`请求失败：${result.error ?? '未知错误'}`)
      if (partial.trim()) {
        await appendMessage({
          sessionId,
          role: 'assistant',
          content: partial,
          status: 'interrupted'
        })
      }
    }
  }

  function stop(): void {
    if (streamId) abortChat(streamId)
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
      <div className="chat__scroll" ref={scrollRef} onScroll={handleScroll}>
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
                      {parsed.text ? (
                        <div className="msg__body">{renderText(parsed.text)}</div>
                      ) : null}
                      {parsed.drafts.map((draft, index) => (
                        <DraftCard
                          key={index}
                          draft={draft}
                          readOnly={isSample}
                          onConfirm={(payload) => void applyDraft(payload, message.id)}
                        />
                      ))}
                      {message.sources && message.sources.length > 0 ? (
                        <SourceRow sources={message.sources} />
                      ) : isSample ? (
                        <p className="msg__source">参考：示例数据</p>
                      ) : null}
                    </>
                  )}
                </div>
              )
            })
          )}

          {liveText ? (
            <div className="msg msg--assistant">
              <div className="msg__body">{renderText(liveText)}</div>
            </div>
          ) : null}

          {streamId ? (
            <p className="msg__source" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="typing-dot" />
              正在思考…
            </p>
          ) : null}

          {notice ? <p className="chat__notice">{notice}</p> : null}
        </div>
      </div>

      <div className="chat__composer">
        {showJump ? (
          <button
            type="button"
            className="jump-btn"
            title="回到最新"
            onClick={() => scrollToBottom()}
          >
            <ArrowDown size={15} strokeWidth={2} />
          </button>
        ) : null}
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
                {integrating ? (
                  <span className="model-status" title="正在把上次对话整理成长期记忆">
                    <span className="typing-dot" />
                    整理上次对话
                  </span>
                ) : null}
                <Link to={SETTINGS_PATH} className="model-status">
                  <span
                    className="model-status__dot"
                    style={modelReady ? { background: 'var(--accent)' } : undefined}
                  />
                  {modelReady
                    ? `${config?.name} · ${config?.model}`
                    : '未配置 AI · 去设置'}
                </Link>
                {streamId ? (
                  <button type="button" className="send-btn send-btn--ready" title="停止" onClick={stop}>
                    <Square size={12} strokeWidth={2.5} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`send-btn${input.trim() ? ' send-btn--ready' : ''}`}
                    title="发送（Enter）"
                    disabled={!input.trim()}
                    onClick={() => void send()}
                  >
                    <ArrowUp size={16} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
