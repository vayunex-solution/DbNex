import { Menu, Bell, Sun, Moon, Monitor } from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'
import { useAuthStore } from '@/stores/authStore'
import { useLocation } from 'react-router-dom'

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/projects': 'Projects',
  '/projects/new': 'New Project',
  '/compare': 'Compare Databases',
  '/compare/results': 'Comparison Results',
  '/history': 'Compare History',
  '/logs': 'Execution Logs',
  '/audit': 'Audit Trail',
  '/settings': 'Settings',
}

const ThemeButton = ({ mode, icon: Icon, current, onChange }) => (
  <button
    onClick={() => onChange(mode)}
    className={`p-1.5 rounded-lg transition-all ${current === mode ? 'bg-primary-600/30 text-primary-400' : 'text-gray-500 hover:text-gray-300 hover:bg-surface-700'}`}
    title={mode}
  >
    <Icon className="w-4 h-4" />
  </button>
)

export default function Header({ onMenuClick }) {
  const { theme, setTheme } = useThemeStore()
  const { user } = useAuthStore()
  const location = useLocation()

  const title = PAGE_TITLES[location.pathname] || 'DbNex'

  return (
    <header className="h-14 flex items-center gap-4 px-4 md:px-6 bg-surface-900/80 backdrop-blur-md border-b border-surface-700 sticky top-0 z-40">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-surface-700 transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Page Title */}
      <div className="flex-1">
        <h2 className="text-base font-semibold text-gray-100 hidden sm:block">{title}</h2>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {/* Theme Switcher */}
        <div className="hidden sm:flex items-center gap-0.5 bg-surface-800 rounded-lg p-1 border border-surface-600">
          <ThemeButton mode="light" icon={Sun} current={theme} onChange={setTheme} />
          <ThemeButton mode="dark" icon={Moon} current={theme} onChange={setTheme} />
          <ThemeButton mode="system" icon={Monitor} current={theme} onChange={setTheme} />
        </div>

        {/* Notification Bell (placeholder) */}
        <button className="p-2 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-surface-700 transition-colors relative">
          <Bell className="w-4 h-4" />
        </button>

        {/* User Avatar (mobile) */}
        <div className="lg:hidden w-8 h-8 rounded-full brand-gradient flex items-center justify-center text-white text-sm font-bold">
          {user?.firstName?.[0]?.toUpperCase() || 'U'}
        </div>
      </div>
    </header>
  )
}
