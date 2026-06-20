// EditProjectPage — same form as NewProjectPage but pre-loaded
import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Save, ArrowLeft } from 'lucide-react'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import NewProjectPage from './NewProjectPage'

// EditProjectPage delegates back to NewProjectPage pattern but pre-fills.
// Simple implementation for now.
export default function EditProjectPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get(`/projects/${id}`).then(r => {
      const p = r.data.data
      setProject(p)
      setForm({
        projectName: p.projectName, description: p.description || '',
        sourceHost: p.sourceHost, sourcePort: p.sourcePort, sourceDatabase: p.sourceDatabase,
        sourceUsername: p.sourceUsername, sourcePassword: '',
        sourceEncryptConnection: p.sourceEncryptConnection, sourceTrustServerCert: p.sourceTrustServerCert,
        destHost: p.destHost, destPort: p.destPort, destDatabase: p.destDatabase,
        destUsername: p.destUsername, destPassword: '',
        destEncryptConnection: p.destEncryptConnection, destTrustServerCert: p.destTrustServerCert,
      })
    }).catch(() => toast.error('Project not found.'))
  }, [id])

  const setField = (field, val) => setForm(f => ({ ...f, [field]: val }))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put(`/projects/${id}`, form)
      toast.success('Project updated!')
      navigate('/projects')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed.')
    } finally {
      setSaving(false)
    }
  }

  if (!form) return <div className="card"><div className="skeleton h-64 rounded-xl" /></div>

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/projects" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Edit Project</h1>
          <p className="text-gray-500 text-sm">{project?.projectName}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Project Name / Description */}
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-gray-300">Project Details</h3>
          <div>
            <label className="label">Project Name *</label>
            <input className="input" value={form.projectName} onChange={e => setField('projectName', e.target.value)} required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description} onChange={e => setField('description', e.target.value)} />
          </div>
        </div>

        {/* Source DB */}
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-green-400">Source Database</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><label className="label">Host</label><input className="input" value={form.sourceHost} onChange={e => setField('sourceHost', e.target.value)} /></div>
            <div><label className="label">Port</label><input className="input" type="number" value={form.sourcePort} onChange={e => setField('sourcePort', parseInt(e.target.value))} /></div>
            <div><label className="label">Database</label><input className="input" value={form.sourceDatabase} onChange={e => setField('sourceDatabase', e.target.value)} /></div>
            <div><label className="label">Username</label><input className="input" value={form.sourceUsername} onChange={e => setField('sourceUsername', e.target.value)} /></div>
            <div><label className="label">New Password (leave blank to keep)</label><input className="input" type="password" placeholder="Leave blank to keep existing" value={form.sourcePassword} onChange={e => setField('sourcePassword', e.target.value)} /></div>
          </div>
        </div>

        {/* Dest DB */}
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-blue-400">Destination Database</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><label className="label">Host</label><input className="input" value={form.destHost} onChange={e => setField('destHost', e.target.value)} /></div>
            <div><label className="label">Port</label><input className="input" type="number" value={form.destPort} onChange={e => setField('destPort', parseInt(e.target.value))} /></div>
            <div><label className="label">Database</label><input className="input" value={form.destDatabase} onChange={e => setField('destDatabase', e.target.value)} /></div>
            <div><label className="label">Username</label><input className="input" value={form.destUsername} onChange={e => setField('destUsername', e.target.value)} /></div>
            <div><label className="label">New Password (leave blank to keep)</label><input className="input" type="password" placeholder="Leave blank to keep existing" value={form.destPassword} onChange={e => setField('destPassword', e.target.value)} /></div>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Link to="/projects" className="btn-secondary">Cancel</Link>
          <button type="submit" disabled={saving} className="btn-primary">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Update Project'}
          </button>
        </div>
      </form>
    </div>
  )
}
