import Page from '../components/Page'

export default function Goals(): React.JSX.Element {
  return (
    <Page title="目标" desc="你想到达哪里。短期看三个月，长期看三年。">
      <div className="empty">
        还没有目标。
        <span className="empty__hint">写下你想做成的事，哪怕只是「三个月后想看到健身效果」。</span>
      </div>
    </Page>
  )
}
