import { useEffect, useState } from 'react'
import { Terminal, CheckCircle2, AlertTriangle, Clock, ChevronDown, ChevronRight } from 'lucide-react'
import api from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'

const StatusBadge = ({ status }) => {
  const map = {
    SUCCESS: 'badge-success', PARTIAL: 'badge-warning',
    FAILED: 'badge-danger', PENDING: 'badge-neutral', RUNNING: 'badge-info',
  }
  return <span className={`badge ${map[status] || 'badge-neutral'}`}>{status}</span>
}

export default function ExecutionLogsPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    api.get('/execute/logs').then(r => setLogs(r.data.data)).finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Terminal className="w-6 h-6 text-primary-400" /> Execution Logs
        </h1>
        <p className="text-gray-500 text-sm mt-1">History of all executed synchronization scripts</p>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : logs.length === 0 ? (
        <div className="card text-center py-16">
          <Terminal className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">No scripts have been executed yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(log => (
            <div key={log.id} className="card p-0 overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                className="w-full flex flex-wrap items-center gap-4 p-4 hover:bg-surface-700/30 transition-colors text-left"
              >
                <StatusBadge status={log.status} />
                <span className="text-gray-300 font-medium text-sm flex-1">{log.project?.projectName}</span>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{log.successBatches}/{log.totalBatches} batches</span>
                  <span className={`badge ${log.riskLevel === 'HIGH' ? 'badge-danger' : log.riskLevel === 'MEDIUM' ? 'badge-warning' : 'badge-success'}`}>{log.riskLevel}</span>
                  {log.durationMs && <span>{(log.durationMs / 1000).toFixed(1)}s</span>}
                  <span className="hidden sm:inline">{log.createdAt ? formatDistanceToNow(new Date(log.createdAt), { addSuffix: true }) : ''}</span>
                  {expandedId === log.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
              </button>

              {expandedId === log.id && (
                <div className="border-t border-surface-600 p-4 animate-fade-in">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Batch Execution Log</p>
                  {log.batchLogs ? (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {(Array.isArray(log.batchLogs) ? log.batchLogs : []).map((batch, i) => (
                        <div key={i} className={`flex items-start gap-3 p-2.5 rounded-lg text-xs font-mono ${batch.status === 'SUCCESS' ? 'bg-green-900/20' : 'bg-red-900/20'}`}>
                          <span className={batch.status === 'SUCCESS' ? 'text-green-400' : 'text-red-400'}>
                            {batch.status === 'SUCCESS' ? '✓' : '✗'} #{batch.batchNumber}
                          </span>
                          <span className="text-gray-400 flex-1 truncate">{batch.sql}</span>
                          {batch.error && <span className="text-red-400 text-2xs">{batch.error}</span>}
                          {batch.durationMs && <span className="text-gray-600">{batch.durationMs}ms</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600 text-sm">No detailed batch logs available.</p>
                  )}
                  {log.errorMessage && (
                    <div className="mt-3 p-3 bg-red-900/20 rounded-lg border border-red-700/30">
                      <p className="text-red-400 text-xs">{log.errorMessage}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
