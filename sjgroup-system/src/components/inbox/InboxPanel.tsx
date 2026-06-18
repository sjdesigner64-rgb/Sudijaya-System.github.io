import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { Bell, Check, CheckCheck, Inbox } from 'lucide-react'
import { useNotificationStore } from '@/store/notificationStore'
import { updateDocument } from '@/services/firestore.service'
import { cn } from '@/utils/cn'
import type { NotificationType } from '@/types'

const TYPE_LABELS: Record<NotificationType, string> = {
  task: 'Tugas',
  reminder: 'Pengingat',
  invoice: 'Invoice',
  quotation: 'Quotation',
  dp_received: 'DP Masuk',
  warranty: 'Garansi',
  drawing_request: 'Request Gambar',
  bom_request: 'Request BOM',
  content_request: 'Request Konten',
  meeting: 'Meeting',
}

const TYPE_COLORS: Partial<Record<NotificationType, string>> = {
  dp_received: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
  invoice: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
  task: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
  warranty: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
}

type Tab = 'unread' | 'all' | 'tasks'

export function InboxPanel() {
  const [tab, setTab] = useState<Tab>('unread')
  const { notifications, markAsRead, markAllAsRead } = useNotificationStore()

  const filtered = notifications.filter((n) => {
    if (tab === 'unread') return !n.isRead
    if (tab === 'tasks') return n.type === 'task'
    return true
  })

  const handleMarkRead = async (id: string) => {
    markAsRead(id)
    await updateDocument('notifications', id, { isRead: true })
  }

  const handleMarkAllRead = async () => {
    markAllAsRead()
    // In production: batch update
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Inbox</h1>
          <p className="text-sm text-muted-foreground">Notifikasi dan tugas masuk</p>
        </div>
        {notifications.some((n) => !n.isRead) && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <CheckCheck className="h-4 w-4" />
            Tandai semua dibaca
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['unread', 'all', 'tasks'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t === 'unread' ? 'Belum Dibaca' : t === 'all' ? 'Semua' : 'Tugas Masuk'}
            {t === 'unread' && notifications.filter((n) => !n.isRead).length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] rounded-full">
                {notifications.filter((n) => !n.isRead).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-muted-foreground">
            <Inbox className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">Tidak ada notifikasi</p>
          </div>
        ) : (
          filtered.map((notif) => (
            <div
              key={notif.id}
              className={cn(
                'flex gap-3 p-3 rounded-xl border transition-colors cursor-pointer hover:bg-muted/30',
                notif.isRead ? 'border-border' : 'border-primary/30 bg-primary/5'
              )}
              onClick={() => !notif.isRead && handleMarkRead(notif.id)}
            >
              <div className="mt-0.5 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bell className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={cn('text-sm', !notif.isRead && 'font-semibold')}>{notif.title}</p>
                  {!notif.isRead && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMarkRead(notif.id) }}
                      className="shrink-0 p-0.5 text-primary hover:bg-primary/10 rounded"
                      title="Tandai dibaca"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full',
                    TYPE_COLORS[notif.type] ?? 'bg-secondary text-secondary-foreground'
                  )}>
                    {TYPE_LABELS[notif.type]}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {notif.createdAt
                      ? formatDistanceToNow(notif.createdAt, { addSuffix: true, locale: localeId })
                      : ''}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
