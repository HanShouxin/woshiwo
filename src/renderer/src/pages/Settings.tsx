import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Eye, EyeOff, List, Trash2 } from 'lucide-react'
import Page from '../components/Page'
import { applyTheme, readTheme, writeTheme } from '../lib/theme'
import type { ThemeMode } from '../lib/theme'
import { getOverview, getSetting, setSetting } from '../db/repo'
import { startChat } from '../ai/client'
import { DEFAULT_OLLAMA_BASE, OPENAI_BASE_PLACEHOLDER } from '../../../shared/constants'
import type { AIProvider, AIConfigEntry, AppInfo } from '../../../shared/constants'

const THEME_OPTIONS: ReadonlyArray<{ value: ThemeMode; label: string }> = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' }
]

const PROVIDERS: ReadonlyArray<{ value: AIProvider; label: string }> = [
  { value: 'openai', label: 'OpenAI 兼容' },
  { value: 'ollama', label: 'Ollama 本地' }
]

interface FormState {
  name: string
  provider: AIProvider
  baseUrl: string
  model: string
}

const EMPTY_FORM: FormState = { name: '', provider: 'openai', baseUrl: '', model: '' }

/** 把服务商返回的原始报错翻译成一句人话 */
function friendlyError(error?: string): string {
  if (!error) return '未知错误'
  if (error.includes('401') || /api[- ]?key/i.test(error)) {
    return '密钥无效或未被接受（401）。检查 API-KEY 是否完整、是否属于这个平台'
  }
  if (error.includes('403')) return '密钥没有访问该模型的权限（403）'
  if (error.includes('404')) return '接口地址或模型名不对（404）。地址通常以 /v1 结尾'
  if (error.includes('429')) return '请求太频繁或额度不足（429）'
  if (error.includes('ECONNREFUSED') || error.includes('fetch failed')) {
    return '连不上这个地址。本地 Ollama 请确认服务已启动'
  }
  return error
}

export default function Settings(): React.JSX.Element {
  const stored = useLiveQuery(() => getSetting<ThemeMode>('theme', 'system'), [], 'system')
  const overview = useLiveQuery(getOverview, [], undefined)
  const [theme, setTheme] = useState<ThemeMode>(readTheme)
  const [info, setInfo] = useState<AppInfo | null>(null)

  const [configs, setConfigs] = useState<AIConfigEntry[]>([])
  const [activeId, setActiveId] = useState('')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [keySaved, setKeySaved] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (stored) setTheme(stored)
  }, [stored])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    let alive = true
    void window.woshiwo?.appInfo().then((data) => {
      if (alive) setInfo(data)
    })

    void (async () => {
      const list = await getSetting<AIConfigEntry[]>('aiConfigs', [])
      const savedId = await getSetting<string>('activeConfigId', '')
      if (!alive) return
      setConfigs(list)
      const active = list.find((item) => item.id === savedId) ?? list[0]
      if (!active) return
      setActiveId(active.id)
      setForm({
        name: active.name,
        provider: active.provider,
        baseUrl: active.baseUrl,
        model: active.model
      })
      // 回读已保存的 Key 填进输入框：点眼睛就能看、能复制
      const key = await window.woshiwo.ai.getKey(active.id)
      if (alive) {
        setApiKey(key)
        setKeySaved(key.length > 0)
      }
    })()

    return () => {
      alive = false
    }
  }, [])

  function chooseTheme(next: ThemeMode): void {
    setTheme(next)
    writeTheme(next)
    void setSetting('theme', next)
  }

  /** 切换服务商只改 provider：已填的内容一律保留，不丢数据 */
  function changeProvider(provider: AIProvider): void {
    setForm((prev) => ({
      ...prev,
      provider,
      baseUrl:
        prev.baseUrl ||
        (provider === 'ollama' ? DEFAULT_OLLAMA_BASE : '')
    }))
    setStatus('')
  }

  async function selectConfig(entry: AIConfigEntry): Promise<void> {
    setActiveId(entry.id)
    setForm({
      name: entry.name,
      provider: entry.provider,
      baseUrl: entry.baseUrl,
      model: entry.model
    })
    setShowKey(false)
    setPickerOpen(false)
    setStatus('')
    const key = await window.woshiwo.ai.getKey(entry.id)
    setApiKey(key)
    setKeySaved(key.length > 0)
    await setSetting('activeConfigId', entry.id)
  }

  async function newConfig(): Promise<void> {
    setActiveId('')
    setForm(EMPTY_FORM)
    setApiKey('')
    setShowKey(false)
    setKeySaved(false)
    setPickerOpen(false)
    setStatus('')
    await setSetting('activeConfigId', '')
  }

  async function testConnection(): Promise<void> {
    const baseUrl = form.baseUrl.trim()
    const model = form.model.trim()
    if (!baseUrl) {
      setStatus('先填接口地址')
      return
    }
    if (!model) {
      setStatus('先填模型名')
      return
    }
    if (form.provider === 'openai' && !apiKey.trim() && !keySaved) {
      setStatus('先填 API-KEY')
      return
    }

    setBusy(true)
    setStatus('正在连接…')

    // 测试用临时 Key（不落盘）；若已经保存过 Key，就用已保存的那份
    const handle = startChat({
      config: { provider: form.provider, baseUrl, model },
      configId: activeId || undefined,
      tempKey: apiKey.trim() || undefined,
      messages: [
        { role: 'system', content: '你是一个连接测试助手，回答保持在一句话以内。' },
        { role: 'user', content: '请用一句话说明你已经就位。' }
      ]
    })
    const result = await handle.done
    setBusy(false)

    if (result.ok) {
      const reply = result.text.trim()
      setStatus(
        reply
          ? `连接成功 · ${reply.slice(0, 60)}`
          : '连接成功，但模型没有返回内容（检查模型名是否为对话模型）'
      )
    } else {
      setStatus(`连接失败：${friendlyError(result.error)}`)
    }
  }

  async function saveConfig(): Promise<void> {
    const name = form.name.trim()
    const baseUrl = form.baseUrl.trim()
    const model = form.model.trim()
    if (!name) {
      setStatus('给这个配置起个名字，下次才选得回来')
      return
    }
    if (!baseUrl) {
      setStatus('接口地址不能为空')
      return
    }
    if (!model) {
      setStatus('模型名不能为空')
      return
    }

    const id = activeId || crypto.randomUUID()
    const entry: AIConfigEntry = {
      id,
      name,
      provider: form.provider,
      baseUrl,
      model,
      updatedAt: new Date().toISOString()
    }
    const next = [...configs]
    const index = next.findIndex((item) => item.id === id)
    if (index >= 0) next[index] = entry
    else next.push(entry)

    await setSetting('aiConfigs', next)
    await setSetting('activeConfigId', id)
    setConfigs(next)
    setActiveId(id)

    if (apiKey.trim()) {
      const ok = await window.woshiwo.ai.setKey(id, apiKey.trim())
      if (!ok) {
        setStatus('密钥保存失败，请重试')
        return
      }
      setKeySaved(true)
    }

    setStatus('已保存，之后会自动使用这个配置')
  }

  async function removeConfig(id: string): Promise<void> {
    const next = configs.filter((item) => item.id !== id)
    await setSetting('aiConfigs', next)
    setConfigs(next)
    await window.woshiwo.ai.deleteKey(id)
    if (activeId === id) {
      await newConfig()
    }
  }

  const rows: ReadonlyArray<{ label: string; value: number | undefined }> = [
    { label: '现状档案', value: overview?.profileCards },
    { label: '目标', value: overview?.goals },
    { label: '矛盾', value: overview?.contradictions },
    { label: '行动', value: overview?.actions },
    { label: '感悟', value: overview?.viewpoints },
    { label: '复盘', value: overview?.reflections },
    { label: '对话', value: overview?.sessions },
    { label: '长期记忆', value: overview?.memories }
  ]

  return (
    <Page title="设置" desc="一次配好，之后基本不用再进来。" wide>
      <section className="section">
        <h2 className="section__title">外观</h2>
        <p className="section__desc">界面的明暗。</p>
        <div className="segmented">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`segmented__item${
                theme === option.value ? ' segmented__item--active' : ''
              }`}
              onClick={() => chooseTheme(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">AI 模型连接</h2>
        <p className="section__desc">
          填好之后先测试连接，通过再保存。保存时给它起个名字，以后可以随时从这里选回来。
          API-KEY 只保存在本机，不进入数据库与备份。
        </p>

        <div className="ai-card">
          <div className="ai-provider-row">
            <div className="segmented">
              {PROVIDERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`segmented__item${
                    form.provider === item.value ? ' segmented__item--active' : ''
                  }`}
                  onClick={() => changeProvider(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="config-picker">
              <button
                type="button"
                className="btn"
                onClick={() => setPickerOpen((value) => !value)}
              >
                <List size={13} strokeWidth={2} />
                已保存配置{configs.length > 0 ? ` (${configs.length})` : ''}
              </button>

              {pickerOpen ? (
                <div className="config-pop">
                  {configs.length === 0 ? (
                    <p className="config-pop__empty">还没有保存过配置</p>
                  ) : (
                    configs.map((entry) => (
                      <div key={entry.id} className="config-row">
                        <button
                          type="button"
                          className="config-row__main"
                          onClick={() => void selectConfig(entry)}
                        >
                          <span className="config-row__name">
                            {entry.name}
                            {entry.id === activeId ? ' · 使用中' : ''}
                          </span>
                          <span className="config-row__meta">
                            {entry.provider === 'ollama' ? 'Ollama' : 'OpenAI 兼容'} · {entry.model}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="config-row__del"
                          title="删除这个配置"
                          onClick={() => void removeConfig(entry.id)}
                        >
                          <Trash2 size={13} strokeWidth={2} />
                        </button>
                      </div>
                    ))
                  )}
                  <button type="button" className="config-row__new" onClick={() => void newConfig()}>
                    ＋ 新建配置
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="ai-form">
            <label className="form-field">
              <span className="form-field__label">配置名称</span>
              <input
                className="add-input"
                placeholder="比如 百炼 / 公司 Ollama"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </label>

            <label className="form-field">
              <span className="form-field__label">模型名</span>
              <input
                className="add-input"
                placeholder={form.provider === 'ollama' ? 'qwen2.5:7b' : 'deepseek-chat'}
                value={form.model}
                onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))}
              />
            </label>

            <label className="form-field">
              <span className="form-field__label">接口地址</span>
              <input
                className="add-input"
                placeholder={
                  form.provider === 'ollama' ? DEFAULT_OLLAMA_BASE : OPENAI_BASE_PLACEHOLDER
                }
                value={form.baseUrl}
                onChange={(event) => setForm((prev) => ({ ...prev, baseUrl: event.target.value }))}
              />
            </label>

            <label className="form-field">
              <span className="form-field__label">
                API-KEY
                {keySaved ? ' · 已保存（点眼睛查看）' : form.provider === 'ollama' ? ' · 可选' : ''}
              </span>
              <div className="pwd-wrap">
                <input
                  className="add-input"
                  type={showKey ? 'text' : 'password'}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="sk-…"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                />
                <button
                  type="button"
                  className="pwd-eye"
                  title={showKey ? '隐藏' : '显示'}
                  onClick={() => setShowKey((value) => !value)}
                >
                  {showKey ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
                </button>
              </div>
            </label>
          </div>

          <div className="ai-actions">
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void testConnection()}
            >
              测试连接
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy}
              onClick={() => void saveConfig()}
            >
              保存配置
            </button>
            {status ? <span className="muted">{status}</span> : null}
          </div>
        </div>

        {form.provider === 'openai' ? (
          <p className="muted" style={{ marginTop: 10 }}>
            使用远程模型时，对话上下文会发送到你填写的服务商；想让数据完全不出设备，请用本地 Ollama。
          </p>
        ) : null}
      </section>

      <section className="section">
        <h2 className="section__title">数据</h2>
        <p className="section__desc">所有数据保存在本机，这是你目前拥有的全部记录。</p>
        {rows.map((row) => (
          <div className="field-row" key={row.label}>
            <span className="field-row__label">{row.label}</span>
            <span className="field-row__value">{row.value ?? '—'}</span>
          </div>
        ))}
        <div className="field-row">
          <span className="field-row__label">数据目录</span>
          <span className="field-row__value muted">{info?.dataDir ?? '读取中…'}</span>
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">关于</h2>
        <div className="field-row">
          <span className="field-row__label">版本</span>
          <span className="field-row__value">{info?.version ?? '—'}</span>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          数据不出设备；只有在你配置了远程模型时，对话上下文才会发送到你选择的服务商。
        </p>
      </section>
    </Page>
  )
}
