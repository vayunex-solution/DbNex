import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Filter, Download, Play, AlertTriangle, GitCompare, ChevronDown, ChevronRight, Code2 } from 'lucide-react'
import { useCompareStore } from '@/stores/compareStore'
import MonacoEditor from '@monaco-editor/react'
import api from '@/lib/api'
import toast from 'react-hot-toast'

const CATEGORIES = ['all', 'Table', 'View', 'Procedure', 'Function', 'Trigger', 'Index']
const STATUSES = ['all', 'Different', 'Missing in Source', 'Missing in Destination']
const RISK_LEVELS = ['all', 'HIGH', 'MEDIUM', 'LOW']

const riskClasses = { HIGH: 'badge-danger', MEDIUM: 'badge-warning', LOW: 'badge-success' }
const statusClasses = {
  'Different': 'badge bg-blue-900/50 text-blue-300 border border-blue-700/50',
  'Missing in Source': 'badge-danger',
  'Missing in Destination': 'badge-warning',
}

const categoryColors = {
  Table: 'text-primary-400', View: 'text-accent-400',
  Procedure: 'text-violet-400', Function: 'text-emerald-400',
  Trigger: 'text-amber-400', Index: 'text-gray-400',
}

export default function CompareResultsPage() {
  const { compareResult, compareHistoryId } = useCompareStore()
  const navigate = useNavigate()
  const [filters, setFilters] = useState({ category: 'all', status: 'all', riskLevel: 'all', search: '' })
  const [expandedItem, setExpandedItem] = useState(null)
  const [executingScript, setExecutingScript] = useState(false)
  const [executingItemId, setExecutingItemId] = useState(null)

  if (!compareResult) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <GitCompare className="w-16 h-16 text-gray-700 mb-4" />
        <h2 className="text-xl font-bold text-gray-400">No Comparison Results</h2>
        <p className="text-gray-600 mt-2">Run a comparison first to see results here.</p>
        <Link to="/compare" className="btn-primary mt-6">Start Comparison</Link>
      </div>
    )
  }

  const { summary, results } = compareResult

  const filtered = useMemo(() => {
    return results.filter(r => {
      if (filters.category !== 'all' && r.category !== filters.category) return false
      if (filters.status !== 'all' && r.status !== filters.status) return false
      if (filters.riskLevel !== 'all' && r.riskLevel !== filters.riskLevel) return false
      if (filters.search && !r.objectName.toLowerCase().includes(filters.search.toLowerCase())) return false
      return true
    })
  }, [results, filters])

  const handleDownloadScript = () => {
    const scripts = filtered.map(r => `-- ${r.category}: ${r.objectName} [${r.status}]\n${r.alterScriptSql || ''}`).join('\n\n-- ─────────────────────────────────────\n\n')
    const blob = new Blob([scripts], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dbnex-sync-${Date.now()}.sql`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Script downloaded!')
  }

  const handleExecuteItem = async (item) => {
    if (!item.alterScriptSql?.trim()) { toast.error('No script available for this item.'); return }
    setExecutingItemId(item.objectName)

    try {
      const riskRes = await api.post('/execute/analyze', { scriptSql: item.alterScriptSql })
      const riskReport = riskRes.data.data

      if (riskReport.requiresConfirmation) {
        if (!window.confirm(`⚠️ ${riskReport.overallRisk} RISK DETECTED:\n${riskReport.summary}\n\nDo you want to proceed?`)) {
          setExecutingItemId(null)
          return
        }
      }

      const res = await api.post('/execute/run', {
        projectId: summary.projectId,
        scriptSql: item.alterScriptSql,
        compareHistoryId,
        confirmed: true,
      })

      if (res.data.success) toast.success('Script executed successfully!')
      else toast.error(res.data.message || 'Execution had errors.')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Execution failed.')
    } finally {
      setExecutingItemId(null)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Summary Banner */}
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">Comparison Results</h1>
            <p className="text-gray-500 text-sm mt-1">
              <span className="text-gray-300 font-mono">{summary.sourceDatabaseName}</span>
              <span className="text-gray-600 mx-2">→</span>
              <span className="text-gray-300 font-mono">{summary.destDatabaseName}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`badge text-sm px-3 py-1 ${riskClasses[summary.overallRisk] || 'badge-neutral'}`}>
              {summary.overallRisk} RISK
            </span>
            <span className="text-2xl font-bold text-white">{summary.totalDifferences}</span>
            <span className="text-gray-500 text-sm">differences</span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4 pt-4 border-t border-surface-600">
          {[
            { label: 'Tables Added', value: summary.tablesAdded },
            { label: 'Tables Changed', value: summary.tablesModified },
            { label: 'Tables Missing', value: summary.tablesMissing },
            { label: 'Views', value: summary.viewsChanged },
            { label: 'Procedures', value: summary.proceduresChanged },
            { label: 'Functions', value: summary.functionsChanged },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <p className="text-xl font-bold text-white">{stat.value}</p>
              <p className="text-gray-600 text-2xs mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Warning */}
      {summary.overallRisk !== 'LOW' && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border ${summary.overallRisk === 'HIGH' ? 'bg-red-950/30 border-red-700/30' : 'bg-amber-950/30 border-amber-700/30'}`}>
          <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${summary.overallRisk === 'HIGH' ? 'text-red-400' : 'text-amber-400'}`} />
          <div>
            <p className={`font-semibold text-sm ${summary.overallRisk === 'HIGH' ? 'text-red-300' : 'text-amber-300'}`}>
              {summary.overallRisk} Risk Operations Detected
            </p>
            <p className={`text-xs mt-1 ${summary.overallRisk === 'HIGH' ? 'text-red-400/70' : 'text-amber-400/70'}`}>
              {summary.riskBreakdown?.high} HIGH · {summary.riskBreakdown?.medium} MEDIUM · {summary.riskBreakdown?.low} LOW risk items.
              Review each item carefully before executing.
            </p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <input
            className="input"
            placeholder="Search by object name..."
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          />
        </div>
        <select className="input w-auto" value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c === 'all' ? 'All Types' : c + 's'}</option>)}
        </select>
        <select className="input w-auto" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
          {STATUSES.map(s => <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</option>)}
        </select>
        <select className="input w-auto" value={filters.riskLevel} onChange={e => setFilters(f => ({ ...f, riskLevel: e.target.value }))}>
          {RISK_LEVELS.map(r => <option key={r} value={r}>{r === 'all' ? 'All Risk' : r}</option>)}
        </select>
        <button onClick={handleDownloadScript} className="btn-secondary">
          <Download className="w-4 h-4" /> Export SQL
        </button>
      </div>

      <p className="text-gray-500 text-sm">{filtered.length} item(s) shown</p>

      {/* Results List */}
      <div className="space-y-2">
        {filtered.map((item, idx) => (
          <div
            key={`${item.category}-${item.objectName}`}
            className="card p-0 overflow-hidden transition-all duration-200"
          >
            {/* Row Header */}
            <button
              onClick={() => setExpandedItem(expandedItem === idx ? null : idx)}
              className="w-full flex items-center gap-4 p-4 hover:bg-surface-700/30 transition-colors text-left"
            >
              <span className={`text-xs font-bold font-mono w-16 flex-shrink-0 ${categoryColors[item.category] || 'text-gray-400'}`}>
                {item.category.toUpperCase()}
              </span>
              <span className="flex-1 font-medium text-gray-200 text-sm truncate font-mono">{item.objectName}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`badge text-2xs hidden sm:inline-flex ${statusClasses[item.status] || 'badge-neutral'}`}>{item.status}</span>
                <span className={`badge text-2xs ${riskClasses[item.riskLevel] || 'badge-neutral'}`}>{item.riskLevel}</span>
                {expandedItem === idx
                  ? <ChevronDown className="w-4 h-4 text-gray-500" />
                  : <ChevronRight className="w-4 h-4 text-gray-500" />
                }
              </div>
            </button>

            {/* Expanded Content */}
            {expandedItem === idx && (
              <div className="border-t border-surface-600 animate-fade-in">
                {/* Column Diffs (Tables) */}
                {item.columnDiffs && item.columnDiffs.length > 0 && (
                  <div className="p-4 border-b border-surface-600">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Column Changes</p>
                    <div className="space-y-1">
                      {item.columnDiffs.map((d, i) => (
                        <div key={i} className={`text-xs p-2 rounded-lg font-mono flex items-start gap-2 ${d.type === 'ADD_COLUMN' ? 'bg-green-900/20 text-green-400' : d.type === 'DROP_COLUMN' ? 'bg-red-900/20 text-red-400' : 'bg-amber-900/20 text-amber-400'}`}>
                          <span className="font-bold flex-shrink-0">{d.type === 'ADD_COLUMN' ? '+' : d.type === 'DROP_COLUMN' ? '−' : '~'}</span>
                          <span>{d.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Module Diff Viewer */}
                {item.diffResult && (
                  <div className="p-4 border-b border-surface-600">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Diff View</p>
                    <div className="code-block max-h-64 overflow-y-auto text-xs space-y-0.5">
                      {item.diffResult.map((part, i) => (
                        <div
                          key={i}
                          className={part.type === 'added' ? 'diff-added px-2' : part.type === 'removed' ? 'diff-removed px-2' : 'diff-unchanged px-2 opacity-60'}
                        >
                          {(part.value || '').split('\n').filter((_, i, a) => i < a.length - 1 || part.value.endsWith('\n') || true).map((line, j) => (
                            <div key={j} className="whitespace-pre-wrap">{line || ' '}</div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SQL Script */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <Code2 className="w-3 h-3" /> Sync Script
                    </p>
                    <button
                      onClick={() => handleExecuteItem(item)}
                      disabled={executingItemId === item.objectName}
                      className="btn-primary btn-sm"
                    >
                      {executingItemId === item.objectName ? (
                        <><span className="animate-spin">⌛</span> Running...</>
                      ) : (
                        <><Play className="w-3 h-3" /> Execute</>
                      )}
                    </button>
                  </div>
                  <div className="rounded-lg overflow-hidden border border-surface-600" style={{ height: 180 }}>
                    <MonacoEditor
                      height={180}
                      language="sql"
                      value={item.alterScriptSql || '-- No script available'}
                      theme="vs-dark"
                      options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12, scrollBeyondLastLine: false, lineNumbers: 'off' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="card text-center py-12">
            <p className="text-gray-500">No items match your filters.</p>
          </div>
        )}
      </div>
    </div>
  )
}
