import Page from '../components/Page'

export default function Actions(): React.JSX.Element {
  return (
    <Page
      title="行动"
      desc="人的精力有限，一次只打一场仗。上面是你眼下的主要矛盾，下面是你需要长期保持的事。"
    >
      <div className="empty">
        还没有当前矛盾。
        <span className="empty__hint">聊聊现状，我们找到那个卡住你的点；或者你自己写一个。</span>
      </div>
    </Page>
  )
}
