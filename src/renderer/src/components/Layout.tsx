import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout(): React.JSX.Element {
  return (
    <div className="app">
      <div className="titlebar-drag" />
      <Sidebar />
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
