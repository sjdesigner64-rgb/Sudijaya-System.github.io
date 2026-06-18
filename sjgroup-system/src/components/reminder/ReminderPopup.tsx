import { X, Bell, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNotificationStore } from '@/store/notificationStore'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/utils/cn'

export function ReminderPopup() {
  const navigate = useNavigate()
  const { showReminder, setShowReminder, notifications } = useNotificationStore()
  const { user } = useAuthStore()

  if (!showReminder || !user) return null

  const pending = notifications.filter((n) => !n.isRead).slice(0, 5)

  const handleNavigate = (relatedCollection: string, relatedId: string) => {
    const routeMap: Record<string, string> = {
      tasks: '/tasks',
      quotations: '/quotation',
      invoices: '/invoice',
      projects: '/pipeline',
      requests_drawing: '/drawing-request',
      requests_bom: '/bom-request',
      content_requests: '/content',
      meetings: '/meetings',
      after_sales: '/after-sales',
    }
    const route = routeMap[relatedCollection] ?? '/inbox'
    setShowReminder(false)
    navigate(route)
  }

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Selamat Pagi' : hour < 15 ? 'Selamat Siang' : 'Selamat Sore'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
      <div
        className="pointer-events-auto w-full max-w-sm bg-card border border-border rounded-xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Bell className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">{greeting}, {user.name.split(' ')[0]}!</p>
              <p className="text-xs text-muted-foreground">Pengingat tugas hari ini</p>
            </div>
          </div>
          <button
            onClick={() => setShowReminder(false)}
            className="p-1 rounded-md hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 max-h-72 overflow-y-auto space-y-2">
          {pending.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground text-sm">
              Tidak ada tugas pending saat ini.
            </div>
          ) : (
            pending.map((notif) => (
              <div
                key={notif.id}
                className={cn(
                  'flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors',
                  'border-border'
                )}
                onClick={() => handleNavigate(notif.relatedCollection, notif.relatedId)}
              >
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{notif.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{notif.message}</p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 pt-0 flex gap-2">
          <button
            onClick={() => { setShowReminder(false); navigate('/inbox') }}
            className="flex-1 py-2 text-sm border border-border rounded-md hover:bg-accent transition-colors"
          >
            Lihat Semua
          </button>
          <button
            onClick={() => setShowReminder(false)}
            className="flex-1 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
