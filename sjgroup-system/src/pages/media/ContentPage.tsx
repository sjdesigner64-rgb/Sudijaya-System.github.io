import { useEffect, useState } from 'react'
import { Plus, ExternalLink, Image, Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { toDate } from '@/utils/firestore'
import type { ContentRequest, TaskStatus } from '@/types'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { useAuthStore } from '@/store/authStore'
import { createDoc, updateDocument, subscribeToCollection } from '@/services/firestore.service'

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: 'bg-gray-100 dark:bg-gray-800 text-gray-700',
  in_progress: 'bg-blue-100 dark:bg-blue-900 text-blue-700',
  done: 'bg-green-100 dark:bg-green-900 text-green-700',
}
const STATUS_LABELS: Record<TaskStatus, string> = { pending: 'Pending', in_progress: 'Diproses', done: 'Selesai' }

function RequestForm({ onClose }: { onClose: () => void }) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [productName, setProductName] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')

  const handleSave = async () => {
    if (!productName.trim() || !deadline || !user) return
    setSaving(true)
    try {
      await createDoc('content_requests', {
        requestedBy: user.id,
        productName,
        description,
        status: 'pending',
        deadline: new Date(deadline),
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5">
        <h3 className="font-semibold mb-4">Buat Request Konten</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Nama Produk / Mesin</label>
            <input value={productName} onChange={(e) => setProductName(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Nama produk..." />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Keterangan Konten</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none h-24" placeholder="Deskripsi konten yang dibutuhkan, angle, platform target..." />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Deadline</label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button onClick={handleSave} disabled={saving || !productName.trim() || !deadline} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Kirim
          </button>
        </div>
      </div>
    </div>
  )
}

function ContentCard({ item, isMedia }: { item: ContentRequest; isMedia: boolean }) {
  const { user } = useAuthStore()
  const [editingLink, setEditingLink] = useState(false)
  const [link, setLink] = useState('')

  const saveLink = async () => {
    if (!link.trim()) return
    await updateDocument('content_requests', item.id, { storageLink: link, status: 'done', assignedTo: user?.id })
    setEditingLink(false)
  }

  const startWork = async () => {
    await updateDocument('content_requests', item.id, { status: 'in_progress', assignedTo: user?.id })
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Image className="h-4 w-4 text-primary" />
          </div>
          <h3 className="font-medium text-sm">{item.productName}</h3>
        </div>
        <span className={cn('text-xs px-2 py-0.5 rounded-full', STATUS_COLORS[item.status])}>
          {STATUS_LABELS[item.status]}
        </span>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
      <div className="text-xs text-muted-foreground space-y-0.5">
        <p>Deadline: <span className="text-foreground">{format(item.deadline, 'd MMM yyyy', { locale: localeId })}</span></p>
      </div>
      {item.storageLink && (
        <a href={item.storageLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
          <ExternalLink className="h-3 w-3" /> Lihat File Konten
        </a>
      )}
      {isMedia && !item.storageLink && item.status === 'pending' && (
        <button onClick={startWork} className="text-xs text-primary hover:underline">Mulai Kerjakan</button>
      )}
      {isMedia && !item.storageLink && item.status === 'in_progress' && (
        editingLink ? (
          <div className="flex gap-1">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Link Google Drive..."
              className="flex-1 px-2 py-1 border border-input rounded text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button onClick={saveLink} className="text-xs text-primary hover:underline">Simpan</button>
          </div>
        ) : (
          <button onClick={() => setEditingLink(true)} className="text-xs text-primary hover:underline">+ Input Link Konten</button>
        )
      )}
    </div>
  )
}

export function ContentPage() {
  const { user } = useAuthStore()
  const [items, setItems] = useState<ContentRequest[]>([])
  const [showForm, setShowForm] = useState(false)
  const isMedia = user?.role === 'media' || user?.role === 'super_admin'

  useEffect(() => {
    const unsubscribe = subscribeToCollection('content_requests', [], (docs) => {
      setItems(
        docs.map((d) => ({
          ...d,
          deadline: toDate(d.deadline as never) ?? new Date(),
          createdAt: toDate(d.createdAt as never) ?? new Date(),
        })) as unknown as ContentRequest[]
      )
    })
    return unsubscribe
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Konten Media</h1>
          <p className="text-sm text-muted-foreground">Request dan manajemen konten mesin</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Buat Request
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <ContentCard key={item.id} item={item} isMedia={isMedia} />
        ))}
        {items.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm bg-card border border-border rounded-xl">
            Belum ada request konten
          </div>
        )}
      </div>

      {showForm && <RequestForm onClose={() => setShowForm(false)} />}
    </div>
  )
}
