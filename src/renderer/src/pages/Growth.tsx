import { useLiveQuery } from 'dexie-react-hooks'
import Page from '../components/Page'
import { formatDate } from '../lib/format'
import { listArchivedContradictions, listGoals } from '../db/repo'


interface TimelineEvent {
  key: string
  date: string
  title: string
  meta?: string
  muted?: boolean
}

export default function Growth(): React.JSX.Element {
  const archived = useLiveQuery(listArchivedContradictions, [], [])
  const goals = useLiveQuery(listGoals, [], [])

  const events: TimelineEvent[] = [
    ...archived.map((item) => ({
      key: item.id,
      date: item.resolvedAt ?? item.supersededAt ?? item.proposedAt,
      title: item.text,
      meta:
        item.status === 'resolved'
          ? `已解决${item.goalTitleSnapshot ? ` · 当时服务「${item.goalTitleSnapshot}」` : ''}`
          : `已被新的矛盾替代${item.goalTitleSnapshot ? ` · 当时服务「${item.goalTitleSnapshot}」` : ''}`,
      muted: item.status === 'superseded'
    })),
    ...goals
      .filter((goal) => goal.status === 'achieved' && goal.achievedAt)
      .map((goal) => ({
        key: goal.id,
        date: goal.achievedAt as string,
        title: goal.title,
        meta: `目标达成 · ${goal.horizon === 'short' ? '短期' : '长期'}`,
        muted: true
      }))
  ].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <Page
      title="见证成长"
      desc="你解决过的每一个矛盾，都会留在这条线上。不需要自己维护，它自己长。"
    >
      {events.length === 0 ? (
        <div className="empty">
          你的轨迹将在这里慢慢生长。
          <span className="empty__hint">解决掉第一个主要矛盾之后，这条线的第一个节点就会出现。</span>
        </div>
      ) : (
        <div className="timeline">
          {events.map((event) => (
            <div
              className={`timeline__item${event.muted ? ' timeline__item--muted' : ''}`}
              key={event.key}
            >
              <div className="timeline__date">{formatDate(event.date)}</div>
              <p className="timeline__title">{event.title}</p>
              {event.meta ? <div className="timeline__meta">{event.meta}</div> : null}
            </div>
          ))}
        </div>
      )}
    </Page>
  )
}
