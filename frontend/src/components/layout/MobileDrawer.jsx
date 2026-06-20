import { X } from 'lucide-react'
import { useEffect } from 'react'
import Sidebar from './Sidebar'

export default function MobileDrawer({ open, onClose }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-surface-900 shadow-2xl lg:hidden transition-transform duration-300 ease-out ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="absolute top-3 right-3">
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-surface-700">
            <X className="w-4 h-4" />
          </button>
        </div>
        <Sidebar />
      </div>
    </>
  )
}
