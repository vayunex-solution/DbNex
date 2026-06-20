import { Link } from 'react-router-dom'
import { Database } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center text-center p-6">
      <div className="animate-slide-up">
        <div className="text-9xl font-black brand-gradient-text mb-4">404</div>
        <h1 className="text-2xl font-bold text-white mb-2">Page Not Found</h1>
        <p className="text-gray-500 mb-8">The page you're looking for doesn't exist in DbNex.</p>
        <Link to="/dashboard" className="btn-primary">
          <Database className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
