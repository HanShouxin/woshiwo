import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Actions from './pages/Actions'
import Current from './pages/Current'
import Goals from './pages/Goals'
import Growth from './pages/Growth'
import Home from './pages/Home'
import Reviews from './pages/Reviews'
import Self from './pages/Self'
import Settings from './pages/Settings'
import { applyTheme, onSystemThemeChange, readTheme } from './lib/theme'
import type { ThemeMode } from './lib/theme'
import { getSetting } from './db/repo'

export default function App(): React.JSX.Element {
  useEffect(() => {
    // 先用本地缓存立刻上色，避免首屏闪白；再从数据库取权威值覆盖
    applyTheme(readTheme())
    void getSetting<ThemeMode>('theme', readTheme()).then((mode) => applyTheme(mode))

    return onSystemThemeChange(() => {
      if (readTheme() === 'system') applyTheme('system')
    })
  }, [])

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="current" element={<Current />} />
          <Route path="goals" element={<Goals />} />
          <Route path="actions" element={<Actions />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="self" element={<Self />} />
          <Route path="growth" element={<Growth />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
