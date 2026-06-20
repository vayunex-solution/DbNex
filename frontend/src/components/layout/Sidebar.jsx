import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FolderKanban, GitCompare, Clock,
  Terminal, Shield, Settings, LogOut, Database, ChevronRight
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'

const NAV_ITEMS = [
  { label: 'Dashboard',   href: '/dashboard',  icon: LayoutDashboard },
  { label: 'Projects',    href: '/projects',   icon: FolderKanban },
  { label: 'Compare',     href: '/compare',    icon: GitCompare },
  { label: 'History',     href: '/history',    icon: Clock },
  { label: 'Exec Logs',   href: '/logs',       icon: Terminal },
  { label: 'Audit Trail', href: '/audit',      icon: Shield },
  { label: 'Settings',    href: '/settings',   icon: Settings },
]

const FUTURE_MODULES = [
  { label: 'DbNex Sync',   badge: 'Soon' },
  { label: 'DbNex Deploy', badge: 'Soon' },
  { label: 'DbNex Backup', badge: 'Q3' },
]

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    toast.success('Logged out successfully')
    navigate('/login')
  }

  return (
    <div className="h-full flex flex-col bg-surface-900 border-r border-surface-700">
      {/* Brand Header */}
      <div className="p-5 border-b border-surface-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl brand-gradient flex items-center justify-center shadow-glow-primary flex-shrink-0">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold brand-gradient-text leading-none">DbNex</h1>
            <p className="text-2xs text-gray-500 mt-0.5 leading-tight">Database Intelligence</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) =>
              clsx(
                'nav-item group',
                isActive
                  ? 'nav-item-active'
                  : 'nav-item-default'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={clsx('w-4 h-4 flex-shrink-0 transition-colors', isActive ? 'text-primary-400' : 'text-gray-500 group-hover:text-gray-300')} />
                <span className="flex-1 truncate">{item.label}</span>
                {isActive && <ChevronRight className="w-3 h-3 text-primary-400 flex-shrink-0" />}
              </>
            )}
          </NavLink>
        ))}

        {/* Future Modules Section */}
        <div className="pt-4 mt-2 border-t border-surface-700">
          <p className="text-2xs text-gray-600 uppercase tracking-widest font-semibold px-3 mb-2">
            Roadmap
          </p>
          {FUTURE_MODULES.map((mod) => (
            <div
              key={mod.label}
              className="nav-item text-gray-600 cursor-not-allowed opacity-60"
            >
              <span className="w-4 h-4 flex-shrink-0 text-gray-700 rounded border border-surface-500 inline-flex items-center justify-center text-2xs">•</span>
              <span className="flex-1 text-xs truncate">{mod.label}</span>
              <span className="text-2xs bg-surface-600 text-gray-500 px-1.5 py-0.5 rounded-full">{mod.badge}</span>
            </div>
          ))}
        </div>
      </nav>

      {/* User Info + Logout */}
      <div className="p-3 border-t border-surface-700">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-surface-800 mb-2">
          <div className="w-8 h-8 rounded-full brand-gradient flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {user?.firstName?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-200 truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-2xs text-gray-500 truncate">{user?.organization?.name}</p>
          </div>
          <span className="badge badge-primary text-2xs capitalize">{user?.role?.toLowerCase()}</span>
        </div>

        <button
          onClick={handleLogout}
          className="w-full nav-item text-gray-500 hover:text-red-400 hover:bg-red-900/20 text-sm"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  )
}
