import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Save, ArrowLeft, Server, Wifi } from 'lucide-react'
import api from '@/lib/api'
import toast from 'react-hot-toast'

const initialForm = {
  projectName: '', description: '',
  sourceHost: '', sourcePort: 1433, sourceDatabase: '', sourceUsername: '', sourcePassword: '',
  sourceEncryptConnection: false, sourceTrustServerCert: true,
  destHost: '', destPort: 1433, destDatabase: '', destUsername: '', destPassword: '',
  destEncryptConnection: false, destTrustServerCert: true,
}

const DbSection = ({ prefix, title, color, form, onChange, onTest, testing }) => {
  const f = (field) => `${prefix}${field}`
  return (
    <div className="card space-y-4">
      <h3 className={`text-sm font-semibold flex items-center gap-2 ${color}`}>
        <Server className="w-4 h-4" /> {title}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="label">Host / Server</label>
          <input className="input" placeholder="192.168.1.1 or SQLSERVER\INSTANCE" value={form[f('Host')]} onChange={e => onChange(f('Host'), e.target.value)} />
        </div>
        <div>
          <label className="label">Port</label>
          <input className="input" type="number" value={form[f('Port')]} onChange={e => onChange(f('Port'), parseInt(e.target.value))} />
        </div>
        <div>
          <label className="label">Database Name</label>
          <input className="input" placeholder="MyDatabase" value={form[f('Database')]} onChange={e => onChange(f('Database'), e.target.value)} />
        </div>
        <div>
          <label className="label">Username</label>
          <input className="input" placeholder="sa" value={form[f('Username')]} onChange={e => onChange(f('Username'), e.target.value)} />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" placeholder="••••••••" value={form[f('Password')]} onChange={e => onChange(f('Password'), e.target.value)} />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
          <input type="checkbox" checked={form[f('TrustServerCert')]} onChange={e => onChange(f('TrustServerCert'), e.target.checked)} className="rounded" />
          Trust Server Certificate
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
          <input type="checkbox" checked={form[f('EncryptConnection')]} onChange={e => onChange(f('EncryptConnection'), e.target.checked)} className="rounded" />
          Encrypt Connection
        </label>
      </div>
      <button type="button" onClick={onTest} disabled={testing} className="btn-secondary btn-sm">
        <Wifi className="w-4 h-4" /> {testing ? 'Testing...' : 'Test Connection'}
      </button>
    </div>
  )
}

export default function NewProjectPage() {
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [testingSource, setTestingSource] = useState(false)
  const [testingDest, setTestingDest] = useState(false)
  const navigate = useNavigate()

  const setField = (field, val) => setForm(f => ({ ...f, [field]: val }))

  const testConnection = async (type) => {
    const isSource = type === 'source'
    const setter = isSource ? setTestingSource : setTestingDest
    setter(true)
    try {
      const res = await api.post('/projects/test-connection', {
        host: isSource ? form.sourceHost : form.destHost,
        port: isSource ? form.sourcePort : form.destPort,
        database: isSource ? form.sourceDatabase : form.destDatabase,
        username: isSource ? form.sourceUsername : form.destUsername,
        password: isSource ? form.sourcePassword : form.destPassword,
        encryptConnection: isSource ? form.sourceEncryptConnection : form.destEncryptConnection,
        trustServerCert: isSource ? form.sourceTrustServerCert : form.destTrustServerCert,
      })
      if (res.data.success) toast.success(`Connected! Server: ${res.data.data.serverName}`)
      else toast.error(res.data.message || 'Connection failed.')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Connection test failed.')
    } finally {
      setter(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.projectName?.trim()) { toast.error('Project name is required.'); return }
    setSaving(true)
    try {
      await api.post('/projects', form)
      toast.success('Project created!')
      navigate('/projects')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create project.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/projects" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-white">New Project</h1>
          <p className="text-gray-500 text-sm">Configure a new database comparison project</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-gray-300">Project Details</h3>
          <div>
            <label className="label">Project Name *</label>
            <input className="input" placeholder="e.g. Production vs Staging" value={form.projectName} onChange={e => setField('projectName', e.target.value)} required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} placeholder="Optional description..." value={form.description} onChange={e => setField('description', e.target.value)} />
          </div>
        </div>

        <DbSection prefix="source" title="Source Database" color="text-green-400"
          form={form} onChange={setField}
          onTest={() => testConnection('source')} testing={testingSource}
        />

        <DbSection prefix="dest" title="Destination Database" color="text-blue-400"
          form={form} onChange={setField}
          onTest={() => testConnection('dest')} testing={testingDest}
        />

        <div className="flex gap-3 justify-end">
          <Link to="/projects" className="btn-secondary">Cancel</Link>
          <button type="submit" disabled={saving} className="btn-primary">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Project'}
          </button>
        </div>
      </form>
    </div>
  )
}
