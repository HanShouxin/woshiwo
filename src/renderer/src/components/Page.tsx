import type { ReactNode } from 'react'

interface PageProps {
  title: string
  desc?: string
  wide?: boolean
  children?: ReactNode
}

export default function Page({ title, desc, wide, children }: PageProps): React.JSX.Element {
  return (
    <div className={`page${wide ? ' page--wide' : ''}`}>
      <header className="page__head">
        <h1 className="page__title">{title}</h1>
        {desc ? <p className="page__desc">{desc}</p> : null}
      </header>
      {children}
    </div>
  )
}
