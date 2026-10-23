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

export default function Sidebar(): React.JSX.Element {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__brand-name">我是我</span>
        <span className="sidebar__brand-sub">V2.0</span>
      </div>

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
