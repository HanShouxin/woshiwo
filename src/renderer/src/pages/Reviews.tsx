import { Lock } from 'lucide-react'
import Page from '../components/Page'

export default function Reviews(): React.JSX.Element {
  return (
    <Page
      title="复盘"
      desc="写给自己看。不分析、不打分、不给建议，只是一个安静的地方。"
    >
      <span className="privacy-note">
        <Lock size={13} strokeWidth={1.75} />
        仅保存在本地，AI 无法读取
      </span>

      <div className="empty" style={{ marginTop: 24 }}>
        还没有写下的字。
        <span className="empty__hint">等你想说点什么的时候，它就在这里。</span>
      </div>
    </Page>
  )
}
