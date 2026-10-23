import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Page from '../components/Page'
import { applyTheme, readTheme, writeTheme } from '../lib/theme'
import type { ThemeMode } from '../lib/theme'
import { getOverview, getSetting, setSetting } from '../db/repo'
import { listModels, startChat } from '../ai/client'
import { DEFAULT_OLLAMA_BASE } from '../../../shared/constants'
import type { AIProvider, AIConfig, AppInfo } from '../../../shared/constants'

const THEME_OPTIONS: ReadonlyArray<{ value: ThemeMode; label: string }> = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' }
]

const PROVIDERS: ReadonlyArray<{ value: AIProvider; label: string }> = [
  { value: 'openai', label: 'OpenAI 兼容' },
  { value: 'ollama', label: 'Ollama 本地' }
]

const EMPTY_CONFIG: AIConfig = { provider: 'openai', baseUrl: '', model: '' }

/** 把服务商返回的原始报错翻译成一句人话 */
function friendlyError(error?: string): string {
  if (!error) return '未知错误'
  if (error.includes('401') || /api[- ]?key/i.test(error)) {
    return '密钥无效或未被接受（401）。检查 Key 是否完整、是否属于这个平台'
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

  const [config, setConfig] = useState<AIConfig>(EMPTY_CONFIG)
  const [keyInput, setKeyInput] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [models, setModels] = useState<string[]>([])
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
    void getSetting<AIConfig | null>('aiConfig', null).then((saved) => {
      if (alive && saved) setConfig(saved)
    })
    void window.woshiwo?.ai.hasKey().then((exists) => {
      if (alive) setHasKey(exists)
    })
    return () => {
      alive = false
    }
  }, [])

  function chooseTheme(next: ThemeMode): void {
    setTheme(next)
    writeTheme(next)
    void setSetting('theme', next)
  }

  function changeProvider(provider: AIProvider): void {
    // 换服务商 → 表单重置（地址与模型都清空，地址给默认值）
    setConfig({
      provider,
      baseUrl: provider === 'ollama' ? DEFAULT_OLLAMA_BASE : '',
      model: ''
    })
    setModels([])
    setStatus('')
  }

  function changeBaseUrl(value: string): void {
    // 换地址 → 模型名清空重选（不同服务的可用模型不同）
    setConfig((prev) => ({ ...prev, baseUrl: value, model: '' }))
  }

  async function saveConfig(): Promise<void> {
    const baseUrl = config.baseUrl.trim()
    if (!baseUrl) {
      setStatus('请填写接口地址')
      return
    }
    const keyChanged = keyInput.trim().length > 0
    const next: AIConfig = {
      provider: config.provider,
      baseUrl,
      // 换了 Key → 模型名清空重选
      model: keyChanged ? '' : config.model.trim()
    }
    await setSetting('aiConfig', next)
    setConfig(next)

    if (keyChanged) {
      const saved = await window.woshiwo.ai.setKey(keyInput.trim())
      if (!saved) {
        setStatus('密钥保存失败，请重试')
        return
      }
      setHasKey(true)
      setKeyInput('')
      setStatus('密钥已更新，请重新选择模型名')
      return
    }
    if (config.provider === 'ollama' && keyInput.trim() === '' && !hasKey) {
      await window.woshiwo.ai.setKey('')
    }
    setStatus('已保存')
  }

  async function fetchModels(): Promise<void> {
    setBusy(true)
    setStatus('正在获取模型列表…')
    const result = await listModels({ ...config, baseUrl: config.baseUrl.trim() })
    setBusy(false)
    if (result.ok) {
      setModels(result.models)
      setStatus(result.models.length > 0 ? `拿到 ${result.models.length} 个模型` : '没有取到模型')
    } else {
      setStatus(`获取失败：${result.error ?? '检查地址是否正确'}`)
    }
  }

  async function testConnection(): Promise<void> {
    const baseUrl = config.baseUrl.trim()
    const model = config.model.trim()
    if (!baseUrl) {
      setStatus('先填接口地址')
      return
    }
    if (!model) {
      setStatus('先填模型名，再测试')
      return
    }
    if (config.provider === 'openai' && !keyInput.trim() && !hasKey) {
      setStatus('先填密钥，再测试')
      return
    }

    setBusy(true)
    setStatus('正在连接…')

    // 测试前先把当前配置和密钥落到主进程 —— 它手里有 Key，请求才会带上 Authorization
    const next: AIConfig = { provider: config.provider, baseUrl, model }
    await setSetting('aiConfig', next)
    setConfig(next)
    if (keyInput.trim()) {
      const saved = await window.woshiwo.ai.setKey(keyInput.trim())
      if (!saved) {
        setBusy(false)
        setStatus('密钥保存失败，请重试')
        return
      }
      setHasKey(true)
      setKeyInput('')
    }

    const handle = startChat({
      config: next,
      messages: [
        { role: 'system', content: '你是一个连接测试助手，回答保持在一句话以内。' },
        { role: 'user', content: '请用一句话说明你已经就位。' }
      ]
    })
    const result = await handle.done
    setBusy(false)
    if (result.ok) {
      const reply = result.text.trim()
      setStatus(reply ? `连接成功 · ${reply.slice(0, 60)}` : '连接成功，但模型没有返回内容（检查模型名是否为对话模型）')
    } else {
      setStatus(`连接失败：${friendlyError(result.error)}`)
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
          单配置：一个密钥、一个地址、一个模型。同一个密钥下换模型名不影响其他设置；换密钥或换地址需要重新选择模型。
          密钥只保存在本机，不进入数据库与备份。
        </p>

        <div className="segmented" style={{ marginBottom: 14 }}>
          {PROVIDERS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`segmented__item${
                config.provider === item.value ? ' segmented__item--active' : ''
              }`}
              onClick={() => changeProvider(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span className="form-field__label">接口地址</span>
            <input
              className="add-input"
              placeholder={
                config.provider === 'ollama'
                  ? DEFAULT_OLLAMA_BASE
                  : 'https://api.deepseek.com/v1'
              }
              value={config.baseUrl}
              onChange={(event) => changeBaseUrl(event.target.value)}
            />
          </label>

          <label className="form-field">
            <span className="form-field__label">
              密钥 {hasKey ? '· 已保存' : config.provider === 'ollama' ? '· 可选' : '· 必填'}
            </span>
            <input
              className="add-input"
              type="password"
              placeholder={hasKey ? '已保存，如需更换请输入新的' : 'sk-…'}
              value={keyInput}
              onChange={(event) => setKeyInput(event.target.value)}
            />
          </label>

          <label className="form-field">
            <span className="form-field__label">模型名</span>
            <div className="form-inline">
              <input
                className="add-input"
                list="model-options"
                placeholder="例如 deepseek-chat / qwen2.5:7b"
                value={config.model}
                onChange={(event) =>
                  setConfig((prev) => ({ ...prev, model: event.target.value }))
                }
              />
              <datalist id="model-options">
                {models.map((model) => (
                  <option key={model} value={model} />
                ))}
              </datalist>
              <button
                type="button"
                className="btn"
                disabled={busy || !config.baseUrl.trim()}
                onClick={() => void fetchModels()}
              >
                获取列表
              </button>
            </div>
          </label>
        </div>

        <div className="add-row">
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy}
            onClick={() => void saveConfig()}
          >
            保存配置
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy || !config.model.trim()}
            onClick={() => void testConnection()}
          >
            测试连接
          </button>
          {status ? <span className="muted">{status}</span> : null}
        </div>

        {config.provider === 'openai' ? (
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
