import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { useEffect } from 'react'

// Layouts
import AppLayout from '@/layouts/AppLayout'
import AuthLayout from '@/layouts/AuthLayout'

// Pages
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import ProjectsPage from '@/pages/ProjectsPage'
import NewProjectPage from '@/pages/NewProjectPage'
import EditProjectPage from '@/pages/EditProjectPage'
import ComparePage from '@/pages/ComparePage'
import CompareResultsPage from '@/pages/CompareResultsPage'
import ExecutionLogsPage from '@/pages/ExecutionLogsPage'
import HistoryPage from '@/pages/HistoryPage'
import SettingsPage from '@/pages/SettingsPage'
import AuditLogPage from '@/pages/AuditLogPage'
import NotFoundPage from '@/pages/NotFoundPage'

// Protected Route Guard
const ProtectedRoute = ({ children }) => {
  const { token } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  return children
}

const PublicRoute = ({ children }) => {
  const { token } = useAuthStore()
  if (token) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  const { theme } = useThemeStore()

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
    } else if (theme === 'light') {
      root.classList.add('light')
      root.classList.remove('dark')
    } else {
      // System
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', prefersDark)
      root.classList.toggle('light', !prefersDark)
    }
  }, [theme])

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#16162a',
            color: '#f1f5f9',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: '0.75rem',
            fontSize: '0.875rem',
          },
          success: { iconTheme: { primary: '#22c55e', secondary: '#16162a' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#16162a' } },
        }}
      />
      <Routes>
        {/* Auth Routes */}
        <Route path="/" element={<PublicRoute><AuthLayout /></PublicRoute>}>
          <Route index element={<Navigate to="/login" replace />} />
          <Route path="login" element={<LoginPage />} />
        </Route>

        {/* App Routes */}
        <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="dashboard"    element={<DashboardPage />} />
          <Route path="projects"     element={<ProjectsPage />} />
          <Route path="projects/new" element={<NewProjectPage />} />
          <Route path="projects/:id/edit" element={<EditProjectPage />} />
          <Route path="compare"      element={<ComparePage />} />
          <Route path="compare/results" element={<CompareResultsPage />} />
          <Route path="history"      element={<HistoryPage />} />
          <Route path="logs"         element={<ExecutionLogsPage />} />
          <Route path="audit"        element={<AuditLogPage />} />
          <Route path="settings"     element={<SettingsPage />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
