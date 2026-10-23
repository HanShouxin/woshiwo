import Page from '../components/Page'

export default function Growth(): React.JSX.Element {
  return (
    <Page
      title="见证成长"
      desc="你解决过的每一个矛盾，都会留在这条线上。不需要自己维护，它自己长。"
    >
      <div className="empty">
        你的轨迹将在这里慢慢生长。
        <span className="empty__hint">解决掉第一个主要矛盾之后，这条线的第一个节点就会出现。</span>
      </div>
    </Page>
  )
}
