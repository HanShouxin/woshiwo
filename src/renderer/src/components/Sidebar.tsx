import { Link, NavLink } from 'react-router-dom'
import {
  BookOpen,
  Feather,
  Home,
  ListChecks,
  Settings,
  Target,
  TrendingUp,
  User
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { NAV_ITEMS, SETTINGS_PATH } from '../../../shared/constants'

const ICONS: Record<string, LucideIcon> = {
  '/': Home,
  '/current': User,
  '/goals': Target,
  '/actions': ListChecks,
  '/reviews': BookOpen,
  '/self': Feather,
  '/growth': TrendingUp
}

/**
 * 品牌印记：一点在上，两道潮纹在下。
 * 「钱塘江上潮信来」—— 潮是外部的势，点是潮里的自己；
 * 只有潮来时，人才照见「我是我」。
 */
function BrandMark(): React.JSX.Element {
  return (
    <svg viewBox="0 0 28 28" width="26" height="26" aria-hidden="true">
      <circle cx="14" cy="7.6" r="2.5" fill="currentColor" />
      <path
        d="M4 16.4 q 3 -3.4 6 0 t 6 0 t 6 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M7 21.6 q 2.4 -2.6 4.8 0 t 4.8 0 t 4.4 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.42"
      />
    </svg>
  )
}

export default function Sidebar(): React.JSX.Element {
  return (
    <aside className="sidebar">
      <Link to="/" className="sidebar__brand" title="回到首页">
        <span className="brand-mark">
          <BrandMark />
        </span>
        <span className="sidebar__brand-name">我是我</span>
      </Link>

      <p className="sidebar__motto">钱塘江上潮信来，今日方知我是我。</p>

      <nav className="nav">
        {NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.path] ?? Home
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
            >
              <Icon size={16} strokeWidth={1.75} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className="sidebar__footer">
        <NavLink
          to={SETTINGS_PATH}
          className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
        >
          <Settings size={16} strokeWidth={1.75} />
          <span>设置</span>
        </NavLink>
      </div>
    </aside>
  )
}
