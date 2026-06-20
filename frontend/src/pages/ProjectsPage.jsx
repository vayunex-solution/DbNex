import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, GitCompare, Trash2, Edit3, Wifi, WifiOff, Search, FolderOpen } from 'lucide-react'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

export default function ProjectsPage() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const navigate = useNavigate()

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects')
      setProjects(res.data.data)
    } catch { toast.error('Failed to load projects.') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchProjects() }, [])

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete project "${name}"? This is irreversible.`)) return
    setDeletingId(id)
    try {
      await api.delete(`/projects/${id}`)
      toast.success(`Project "${name}" deleted.`)
      setProjects(p => p.filter(x => x.id !== id))
    } catch { toast.error('Failed to delete project.') }
    finally { setDeletingId(null) }
  }

  const filtered = projects.filter(p =>
    p.projectName.toLowerCase().includes(search.toLowerCase()) ||
    p.sourceDatabase?.toLowerCase().includes(search.toLowerCase()) ||
    p.destDatabase?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your saved database connection pairs</p>
        </div>
        <Link to="/projects/new" className="btn-primary self-start sm:self-auto">
          <Plus className="w-4 h-4" /> New Project
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          className="input pl-9"
          placeholder="Search projects by name or database..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-52 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <FolderOpen className="w-16 h-16 text-gray-700 mx-auto mb-4" />
          <p className="text-gray-400 font-medium text-lg">
            {search ? 'No projects match your search.' : 'No projects yet.'}
          </p>
          {!search && (
            <Link to="/projects/new" className="btn-primary mt-4 inline-flex">
              <Plus className="w-4 h-4" /> Create First Project
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(project => (
            <div key={project.id} className="card-hover group flex flex-col">
              {/* Card Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white truncate text-base">{project.projectName}</h3>
                  {project.description && (
                    <p className="text-gray-500 text-xs mt-1 line-clamp-2">{project.description}</p>
                  )}
                </div>
              </div>

              {/* DB Info */}
              <div className="space-y-2.5 flex-1">
                <div className="flex items-center gap-2 text-xs bg-surface-700/50 rounded-lg p-2.5">
                  <span className="text-green-400 font-mono font-bold text-2xs">SRC</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-300 font-medium truncate">{project.sourceDatabase}</p>
                    <p className="text-gray-600 truncate">{project.sourceHost}:{project.sourcePort}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs bg-surface-700/50 rounded-lg p-2.5">
                  <span className="text-blue-400 font-mono font-bold text-2xs">DST</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-300 font-medium truncate">{project.destDatabase}</p>
                    <p className="text-gray-600 truncate">{project.destHost}:{project.destPort}</p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-surface-600">
                <p className="text-gray-600 text-xs">
                  {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
                </p>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => navigate(`/compare?projectId=${project.id}`)}
                    className="btn-primary btn-sm"
                    title="Run Comparison"
                  >
                    <GitCompare className="w-3.5 h-3.5" />
                    Compare
                  </button>
                  <button
                    onClick={() => navigate(`/projects/${project.id}/edit`)}
                    className="btn-secondary btn-sm p-2"
                    title="Edit"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(project.id, project.projectName)}
                    disabled={deletingId === project.id}
                    className="btn-ghost btn-sm p-2 hover:text-red-400 hover:bg-red-900/20"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
