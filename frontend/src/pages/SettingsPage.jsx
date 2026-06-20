import { useThemeStore } from '@/stores/themeStore'
import { useAuthStore } from '@/stores/authStore'
import { useState } from 'react'
import { Sun, Moon, Monitor, Shield, Key, Database } from 'lucide-react'
import api from '@/lib/api'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { theme, setTheme } = useThemeStore()
  const { user } = useAuthStore()
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [saving, setSaving] = useState(false)

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (pwForm.newPassword !== pwForm.confirmPassword) { toast.error('Passwords do not match.'); return }
    if (pwForm.newPassword.length < 8) { toast.error('Password must be at least 8 characters.'); return }
    setSaving(true)
    try {
      await api.post('/auth/change-password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword })
      toast.success('Password changed. Please log in again.')
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password.')
    } finally {
      setSaving(false)
    }
  }

  const themes = [
    { value: 'dark', label: 'Dark', icon: Moon, desc: 'Comfortable for extended use' },
    { value: 'light', label: 'Light', icon: Sun, desc: 'Clean and bright interface' },
    { value: 'system', label: 'System', icon: Monitor, desc: 'Follow OS preference' },
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary-400" /> Account
        </h3>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl brand-gradient flex items-center justify-center text-white text-xl font-bold">
            {user?.firstName?.[0]}
          </div>
          <div>
            <p className="font-semibold text-white">{user?.firstName} {user?.lastName}</p>
            <p className="text-gray-500 text-sm">{user?.email}</p>
            <p className="text-gray-600 text-xs mt-0.5">{user?.organization?.name} · <span className="capitalize">{user?.role?.toLowerCase()}</span></p>
          </div>
        </div>
      </div>

      {/* Theme */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <Sun className="w-4 h-4 text-accent-400" /> Theme
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {themes.map(t => (
            <button
              key={t.value}
              onClick={() => setTheme(t.value)}
              className={`p-4 rounded-xl border text-center transition-all duration-200 ${
                theme === t.value
                  ? 'border-primary-500 bg-primary-900/20 shadow-glow-primary'
                  : 'border-surface-600 bg-surface-700/30 hover:border-surface-500'
              }`}
            >
              <t.icon className={`w-5 h-5 mx-auto mb-2 ${theme === t.value ? 'text-primary-400' : 'text-gray-500'}`} />
              <p className={`text-sm font-medium ${theme === t.value ? 'text-white' : 'text-gray-400'}`}>{t.label}</p>
              <p className="text-gray-600 text-2xs mt-0.5 hidden sm:block">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Change Password */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <Key className="w-4 h-4 text-amber-400" /> Change Password
        </h3>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label className="label">Current Password</label>
            <input type="password" className="input" value={pwForm.currentPassword} onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} />
          </div>
          <div>
            <label className="label">New Password</label>
            <input type="password" className="input" value={pwForm.newPassword} onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} />
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input type="password" className="input" value={pwForm.confirmPassword} onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))} />
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            <Key className="w-4 h-4" /> {saving ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>

      {/* About */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-primary-400" /> About DbNex
        </h3>
        <div className="space-y-1 text-sm text-gray-500">
          <p>Product: <span className="text-gray-300">DbNex — Database Intelligence Platform</span></p>
          <p>Version: <span className="text-gray-300">1.0.0</span></p>
          <p>Vendor: <span className="text-gray-300">Vayunex Solution</span></p>
          <p>Ecosystem: <span className="text-gray-300">PayNex · JwelNex · SocialNex · InventoryNex · FlowNex · <span className="text-primary-400 font-medium">DbNex</span></span></p>
        </div>
        <p className="text-xs text-gray-700 mt-4">© {new Date().getFullYear()} Vayunex Solution. All rights reserved.</p>
      </div>
    </div>
  )
}
