import { useEffect, useState } from 'react'
import { Shield } from 'lucide-react'
import api from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'

export default function AuditLogPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/audit').then(r => setLogs(r.data.data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary-400" /> Audit Trail
        </h1>
        <p className="text-gray-500 text-sm mt-1">Enterprise-grade activity log for all organization actions</p>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-surface-600 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left py-3 px-4 font-medium">Action</th>
                  <th className="text-left py-3 px-4 font-medium hidden sm:table-cell">Entity</th>
                  <th className="text-left py-3 px-4 font-medium">Description</th>
                  <th className="text-left py-3 px-4 font-medium hidden md:table-cell">User</th>
                  <th className="text-left py-3 px-4 font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-surface-800/40 transition-colors">
                    <td className="py-2.5 px-4">
                      <span className="badge badge-primary text-2xs font-mono">{log.action}</span>
                    </td>
                    <td className="py-2.5 px-4 text-gray-500 text-xs hidden sm:table-cell">{log.entity}</td>
                    <td className="py-2.5 px-4 text-gray-300 text-xs max-w-xs truncate">{log.description}</td>
                    <td className="py-2.5 px-4 text-gray-500 text-xs hidden md:table-cell">
                      {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System'}
                    </td>
                    <td className="py-2.5 px-4 text-gray-600 text-xs">
                      {log.createdAt ? formatDistanceToNow(new Date(log.createdAt), { addSuffix: true }) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && (
              <div className="text-center py-12 text-gray-500">No audit logs found.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
