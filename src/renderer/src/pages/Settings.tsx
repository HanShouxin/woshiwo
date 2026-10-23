import { useEffect, useState } from 'react'
import Page from '../components/Page'
import { applyTheme, readTheme, writeTheme } from '../lib/theme'
import type { ThemeMode } from '../lib/theme'
import type { AppInfo } from '../../../shared/constants'

const THEME_OPTIONS: ReadonlyArray<{ value: ThemeMode; label: string }> = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' }
]

export default function Settings(): React.JSX.Element {
  const [theme, setTheme] = useState<ThemeMode>(readTheme)
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    let alive = true
    void window.woshiwo?.appInfo().then((data) => {
      if (alive) setInfo(data)
    })
    return () => {
      alive = false
    }
  }, [])

  function chooseTheme(next: ThemeMode): void {
    setTheme(next)
    writeTheme(next)
  }

  return (
    <Page title="设置" desc="一次配好，之后基本不用再进来。">
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
          支持 OpenAI 兼容接口与本地 Ollama。密钥只保存在本机，不进入数据库与备份。
        </p>
        <div className="field-row">
          <span className="field-row__label">当前状态</span>
          <span className="field-row__value muted">未配置 · 将在下一阶段接入</span>
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">数据与备份</h2>
        <p className="section__desc">
          所有数据保存在本机。换电脑或重装前，记得导出一份备份。
        </p>
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
