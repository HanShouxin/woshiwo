import Page from '../components/Page'
import { CORE_THOUGHT } from '../../../shared/constants'

export default function Self(): React.JSX.Element {
  return (
    <Page title="我是我" desc="值得长期记住的认识。它们会影响我之后怎么帮你看问题。">
      <figure className="core-thought">
        <span className="core-thought__label">核心思想</span>
        <blockquote className="core-thought__text">{CORE_THOUGHT}</blockquote>
      </figure>

      <div className="empty">
        还没有感悟。
        <span className="empty__hint">
          随手记一句今天想明白的事。也可以粘贴一段文字，让我帮你提炼。
        </span>
      </div>
    </Page>
  )
}
