import { Outlet } from 'react-router-dom'

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-48 -left-48 w-96 h-96 bg-primary-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-48 -right-48 w-96 h-96 bg-secondary-600/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-accent-500/10 rounded-full blur-3xl" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}
      />

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl brand-gradient mb-4 shadow-glow-primary">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M6 8h20M6 16h20M6 24h20M12 4v24M20 4v24" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="12" cy="8" r="2" fill="white"/>
              <circle cx="20" cy="16" r="2" fill="white"/>
              <circle cx="12" cy="24" r="2" fill="white"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold brand-gradient-text tracking-tight">DbNex</h1>
          <p className="text-gray-500 text-sm mt-1">Database Intelligence Platform</p>
          <p className="text-gray-600 text-xs mt-1">by Vayunex Solution</p>
        </div>

        <Outlet />

        {/* Footer */}
        <p className="text-center text-gray-600 text-xs mt-6">
          © {new Date().getFullYear()} Vayunex Solution. All rights reserved.
        </p>
      </div>
    </div>
  )
}
