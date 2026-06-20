import { useEffect, useState } from 'react'
import { Clock, GitCompare, CheckCircle2, AlertTriangle } from 'lucide-react'
import api from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'

export default function HistoryPage() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/history').then(r => setHistory(r.data.data)).finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Clock className="w-6 h-6 text-primary-400" /> Compare History
        </h1>
        <p className="text-gray-500 text-sm mt-1">All historical database comparisons</p>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-surface-600 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left py-3 px-4 font-medium">Project</th>
                  <th className="text-left py-3 px-4 font-medium hidden sm:table-cell">Differences</th>
                  <th className="text-left py-3 px-4 font-medium hidden md:table-cell">Risk</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                  <th className="text-left py-3 px-4 font-medium hidden lg:table-cell">Duration</th>
                  <th className="text-left py-3 px-4 font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700">
                {history.map(h => (
                  <tr key={h.id} className="hover:bg-surface-800/50 transition-colors">
                    <td className="py-3 px-4 font-medium text-gray-200">{h.project?.projectName}</td>
                    <td className="py-3 px-4 text-gray-400 hidden sm:table-cell">{h.totalDifferences}</td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <span className={`badge ${h.riskLevel === 'HIGH' ? 'badge-danger' : h.riskLevel === 'MEDIUM' ? 'badge-warning' : 'badge-success'}`}>{h.riskLevel}</span>
                    </td>
                    <td className="py-3 px-4">
                      {h.status === 'COMPLETED'
                        ? <span className="flex items-center gap-1.5 text-green-400 text-xs"><CheckCircle2 className="w-3.5 h-3.5" />Done</span>
                        : h.status === 'FAILED'
                        ? <span className="flex items-center gap-1.5 text-red-400 text-xs"><AlertTriangle className="w-3.5 h-3.5" />Failed</span>
                        : <span className="badge badge-info">Running</span>
                      }
                    </td>
                    <td className="py-3 px-4 text-gray-500 hidden lg:table-cell">{h.durationMs ? `${(h.durationMs / 1000).toFixed(1)}s` : '—'}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{h.createdAt ? formatDistanceToNow(new Date(h.createdAt), { addSuffix: true }) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
