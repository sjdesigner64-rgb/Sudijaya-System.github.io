import { useEffect, useState } from 'react'
import { Plus, Calendar, MapPin, Users, Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { Meeting, MeetingStatus, User } from '@/types'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { toDate } from '@/utils/firestore'
import { useAuthStore } from '@/store/authStore'
import { createDoc, subscribeToCollection } from '@/services/firestore.service'

const STATUS_COLORS: Record<MeetingStatus, string> = {
  scheduled: 'bg-blue-100 dark:bg-blue-900 text-blue-700',
  done: 'bg-green-100 dark:bg-green-900 text-green-700',
  cancelled: 'bg-red-100 dark:bg-red-900 text-red-700',
}

function NewMeetingForm({ users, onClose }: { users: User[]; onClose: () => void }) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [location, setLocation] = useState('')
  const [agenda, setAgenda] = useState('')
  const [participantIds, setParticipantIds] = useState<string[]>([])

  const toggleParticipant = (id: string) =>
    setParticipantIds((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id])

  const handleSave = async () => {
    if (!title.trim() || !scheduledAt || !user) return
    setSaving(true)
    try {
      await createDoc('meetings', {
        title,
        createdBy: user.id,
        participants: participantIds,
        scheduledAt: new Date(scheduledAt),
        location,
        agenda,
        status: 'scheduled',
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold mb-4">Buat Jadwal Meeting</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Judul Meeting</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Tanggal & Waktu</label>
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Lokasi</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Agenda</label>
            <textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none h-20" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Peserta</label>
            <div className="flex flex-wrap gap-2">
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleParticipant(u.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs border transition-colors',
                    participantIds.includes(u.id) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-foreground'
                  )}
                >
                  {u.name}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button onClick={handleSave} disabled={saving || !title.trim() || !scheduledAt} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Simpan
          </button>
        </div>
      </div>
    </div>
  )
}

export function MeetingsPage() {
  const { user } = useAuthStore()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [showForm, setShowForm] = useState(false)
  const canCreate = user?.role === 'admin' || user?.role === 'super_admin'

  useEffect(() => {
    const unsubM = subscribeToCollection('meetings', [], (docs) => {
      setMeetings(
        docs.map((d) => ({ ...d, scheduledAt: toDate(d.scheduledAt as never) ?? new Date() })) as unknown as Meeting[]
      )
    })
    const unsubU = subscribeToCollection('users', [], (docs) => {
      setUsers(docs as unknown as User[])
    })
    return () => { unsubM(); unsubU() }
  }, [])

  const participantNames = (ids: string[]) =>
    ids.map((id) => users.find((u) => u.id === id)?.name ?? id).join(', ')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Jadwal Meeting</h1>
          <p className="text-sm text-muted-foreground">Jadwal meeting antar departemen</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Buat Meeting
          </button>
        )}
      </div>

      <div className="space-y-3">
        {meetings.map((meeting) => (
          <div key={meeting.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-medium">{meeting.title}</h3>
              <span className={cn('text-xs px-2 py-0.5 rounded-full', STATUS_COLORS[meeting.status])}>
                {meeting.status === 'scheduled' ? 'Terjadwal' : meeting.status === 'done' ? 'Selesai' : 'Dibatalkan'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{meeting.agenda}</p>
            <div className="grid sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {format(meeting.scheduledAt, "d MMM yyyy, HH:mm", { locale: localeId })}
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {meeting.location}
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {participantNames(meeting.participants)}
              </div>
            </div>
          </div>
        ))}
        {meetings.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm bg-card border border-border rounded-xl">
            Belum ada jadwal meeting
          </div>
        )}
      </div>

      {showForm && <NewMeetingForm users={users} onClose={() => setShowForm(false)} />}
    </div>
  )
}
