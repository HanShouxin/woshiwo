import Page from '../components/Page'

export default function Current(): React.JSX.Element {
  return (
    <Page
      title="现状"
      desc="记录你现在拥有什么、处于什么状态。写得越具体，AI 对你的处境判断越准。"
    >
      <div className="empty">
        还没有记录。
        <span className="empty__hint">
          从一张卡片开始：技能、职业、收入、身体、兴趣…… 写一句就够。
        </span>
      </div>
    </Page>
  )
}
