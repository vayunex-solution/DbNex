import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FolderKanban, GitCompare, Clock, Terminal, TrendingUp,
  AlertTriangle, CheckCircle2, Plus, ArrowRight, Shield
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import api from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'

const StatCard = ({ icon: Icon, label, value, trend, color = 'primary' }) => {
  const colors = {
    primary: 'text-primary-400 bg-primary-900/30',
    accent: 'text-accent-400 bg-accent-900/30',
    success: 'text-green-400 bg-green-900/30',
    warning: 'text-amber-400 bg-amber-900/30',
  }
  return (
    <div className="card-hover group">
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-xl ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className="flex items-center gap-1 text-green-400 text-xs font-medium">
            <TrendingUp className="w-3 h-3" /> {trend}
          </span>
        )}
      </div>
      <p className="mt-4 text-3xl font-bold text-white">
        {value ?? <span className="skeleton w-12 h-8 inline-block" />}
      </p>
      <p className="text-gray-500 text-sm mt-1">{label}</p>
    </div>
  )
}

const RiskBadge = ({ level }) => {
  const classes = {
    HIGH: 'badge-danger',
    MEDIUM: 'badge-warning',
    LOW: 'badge-success',
    CRITICAL: 'badge bg-purple-900/50 text-purple-300 border border-purple-700/50',
  }
  return <span className={`badge ${classes[level] || 'badge-neutral'}`}>{level}</span>
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState(null)
  const [recentHistory, setRecentHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, historyRes] = await Promise.all([
          api.get('/organizations/stats'),
          api.get('/history?limit=5'),
        ])
        setStats(statsRes.data.data)
        setRecentHistory(historyRes.data.data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl p-6 md:p-8"
        style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(139,92,246,0.15) 50%, rgba(6,182,212,0.1) 100%)', border: '1px solid rgba(99,102,241,0.2)' }}>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-5 pointer-events-none">
          <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
            <circle cx="100" cy="100" r="80" stroke="#6366f1" strokeWidth="20"/>
            <circle cx="100" cy="100" r="50" stroke="#8b5cf6" strokeWidth="10"/>
            <circle cx="100" cy="100" r="20" fill="#06b6d4"/>
          </svg>
        </div>
        <p className="text-gray-400 text-sm">Welcome back,</p>
        <h1 className="text-2xl md:text-3xl font-bold text-white mt-1">
          {user?.firstName} {user?.lastName}
        </h1>
        <p className="text-gray-400 text-sm mt-2">{user?.organization?.name} · <span className="capitalize">{user?.role?.toLowerCase()}</span></p>
        <Link to="/compare" className="btn-primary mt-4 inline-flex">
          <GitCompare className="w-4 h-4" />
          Start New Comparison
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FolderKanban} label="Total Projects"    value={stats?.projectCount}   color="primary" />
        <StatCard icon={GitCompare}   label="Comparisons Run"  value={stats?.compareCount}   color="accent"  />
        <StatCard icon={Terminal}     label="Scripts Executed" value={stats?.executionCount} color="success" />
        <StatCard icon={Shield}       label="Active Users"      value={stats?.userCount}      color="warning" />
      </div>

      {/* Recent History */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary-400" />
            Recent Comparisons
          </h3>
          <Link to="/history" className="btn-ghost btn-sm text-primary-400 hover:text-primary-300">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
          </div>
        ) : recentHistory.length === 0 ? (
          <div className="text-center py-12">
            <GitCompare className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">No comparisons yet.</p>
            <Link to="/compare" className="btn-primary mt-4 inline-flex">
              <Plus className="w-4 h-4" /> Run First Comparison
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-600 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="pb-2 text-left font-medium">Project</th>
                  <th className="pb-2 text-left font-medium hidden sm:table-cell">Differences</th>
                  <th className="pb-2 text-left font-medium hidden md:table-cell">Risk</th>
                  <th className="pb-2 text-left font-medium">Status</th>
                  <th className="pb-2 text-left font-medium hidden lg:table-cell">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700">
                {recentHistory.map((h) => (
                  <tr key={h.id} className="hover:bg-surface-800/50 transition-colors">
                    <td className="py-3 font-medium text-gray-200">{h.project?.projectName}</td>
                    <td className="py-3 text-gray-400 hidden sm:table-cell">{h.totalDifferences} found</td>
                    <td className="py-3 hidden md:table-cell"><RiskBadge level={h.riskLevel} /></td>
                    <td className="py-3">
                      {h.status === 'COMPLETED' ? (
                        <span className="flex items-center gap-1.5 text-green-400 text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Done
                        </span>
                      ) : h.status === 'FAILED' ? (
                        <span className="flex items-center gap-1.5 text-red-400 text-xs">
                          <AlertTriangle className="w-3.5 h-3.5" /> Failed
                        </span>
                      ) : (
                        <span className="badge badge-info">Running</span>
                      )}
                    </td>
                    <td className="py-3 text-gray-500 text-xs hidden lg:table-cell">
                      {formatDistanceToNow(new Date(h.createdAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
