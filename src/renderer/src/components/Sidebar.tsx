import { NavLink } from 'react-router-dom'
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
 * 品牌印记：一笔未合拢的圆 + 中心一点。
 * 圆是自性，点是「我」；缺口留白，取「今日方知」的那个瞬间。
 */
function BrandMark(): React.JSX.Element {
  return (
    <svg viewBox="0 0 28 28" width="25" height="25" aria-hidden="true">
      <circle
        cx="14"
        cy="14"
        r="10.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeDasharray="55 10"
        transform="rotate(-38 14 14)"
      />
      <circle cx="14" cy="14" r="2.9" fill="currentColor" />
    </svg>
  )
}

export default function Sidebar(): React.JSX.Element {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="brand-mark">
          <BrandMark />
        </span>
        <span className="sidebar__brand-name">我是我</span>
      </div>

      <p className="sidebar__motto">
        钱塘江上潮信来
        <br />
        今日方知我是我
      </p>

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
