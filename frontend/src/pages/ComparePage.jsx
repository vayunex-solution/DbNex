import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { GitCompare, AlertTriangle, Loader2, Database, RefreshCw } from 'lucide-react'
import api from '@/lib/api'
import { useCompareStore } from '@/stores/compareStore'
import toast from 'react-hot-toast'

const RiskBadge = ({ level }) => {
  const classes = { HIGH: 'badge-danger', MEDIUM: 'badge-warning', LOW: 'badge-success' }
  const icons = { HIGH: '⛔', MEDIUM: '⚠️', LOW: '✅' }
  return (
    <span className={`badge ${classes[level] || 'badge-neutral'} text-xs`}>
      {icons[level]} {level}
    </span>
  )
}

export default function ComparePage() {
  const [projects, setProjects] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [isComparing, setIsComparing] = useState(false)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setCompareResult } = useCompareStore()

  useEffect(() => {
    api.get('/projects').then(r => {
      setProjects(r.data.data)
      const preSelected = searchParams.get('projectId')
      if (preSelected) setSelectedId(preSelected)
    })
  }, [])

  const selectedProject = projects.find(p => p.id === selectedId)

  const handleCompare = async () => {
    if (!selectedId) { toast.error('Please select a project first.'); return }
    setIsComparing(true)
    const toastId = toast.loading('Extracting and comparing schemas...')
    try {
      const res = await api.post('/compare', { projectId: selectedId })
      const { summary, results, compareHistoryId } = res.data.data
      setCompareResult({ summary, results }, compareHistoryId)
      toast.success(`Found ${summary.totalDifferences} differences.`, { id: toastId })
      navigate('/compare/results')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Comparison failed.', { id: toastId })
    } finally {
      setIsComparing(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Compare Databases</h1>
        <p className="text-gray-500 text-sm mt-1">Select a project to compare its Source and Destination databases</p>
      </div>

      {/* Project Selector */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <Database className="w-4 h-4 text-primary-400" />
          Select Project
        </h2>

        {projects.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No projects found. <Link to="/projects/new" className="text-primary-400 hover:underline">Create one →</Link></p>
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                  selectedId === p.id
                    ? 'border-primary-500 bg-primary-900/20 shadow-glow-primary'
                    : 'border-surface-600 bg-surface-700/30 hover:border-surface-500 hover:bg-surface-700/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">{p.projectName}</p>
                    {p.description && <p className="text-gray-500 text-xs mt-0.5 truncate">{p.description}</p>}
                  </div>
                  {selectedId === p.id && (
                    <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"/>
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex gap-4 mt-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="text-green-400 font-mono font-bold text-2xs">SRC</span>
                    {p.sourceDatabase}@{p.sourceHost}
                  </span>
                  <span>→</span>
                  <span className="flex items-center gap-1">
                    <span className="text-blue-400 font-mono font-bold text-2xs">DST</span>
                    {p.destDatabase}@{p.destHost}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Info card for selected project */}
      {selectedProject && (
        <div className="card bg-primary-950/30 border-primary-800/50 animate-fade-in">
          <h3 className="text-sm font-semibold text-primary-300 mb-3">Ready to Compare</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Source</p>
              <p className="text-white font-medium">{selectedProject.sourceDatabase}</p>
              <p className="text-gray-500 text-xs">{selectedProject.sourceUsername}@{selectedProject.sourceHost}:{selectedProject.sourcePort}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Destination</p>
              <p className="text-white font-medium">{selectedProject.destDatabase}</p>
              <p className="text-gray-500 text-xs">{selectedProject.destUsername}@{selectedProject.destHost}:{selectedProject.destPort}</p>
            </div>
          </div>
        </div>
      )}

      {/* Warning */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-950/30 border border-amber-700/30">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-amber-300 text-xs leading-relaxed">
          Schema extraction may take 15–60 seconds depending on database size. Do not close this page during comparison.
        </p>
      </div>

      {/* Action Button */}
      <button
        onClick={handleCompare}
        disabled={!selectedId || isComparing}
        className="btn-primary w-full justify-center py-3 text-base"
      >
        {isComparing ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> Comparing Schemas...</>
        ) : (
          <><GitCompare className="w-5 h-5" /> Start Comparison</>
        )}
      </button>
    </div>
  )
}
