import { useEffect, useState } from 'react'
import { Plus, ExternalLink, Image, Loader2, Search, Upload, Paperclip, Trash2, Download, Pencil, TrendingUp, Clock, RefreshCw, RotateCcw, CheckCircle2, AlertTriangle } from 'lucide-react'
import { cn } from '@/utils/cn'
import { toDate } from '@/utils/firestore'
import type { ContentRequest, ContentMediaType, ContentPriority, ContentRequestStatus, User, Attachment } from '@/types'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { useAuthStore } from '@/store/authStore'
import { createDoc, updateDocument, deleteDocument, subscribeToCollection, where } from '@/services/firestore.service'
import { uploadFile, buildPath } from '@/services/storage.service'
import { Pagination } from '@/components/common/Pagination'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

const PAGE_SIZE = 9

const CONTENT_TYPE_LABELS: Record<ContentMediaType, string> = {
  foto: 'Foto',
  video: 'Video',
  desain: 'Desain',
  reels: 'Reels',
  katalog: 'Katalog',
  voice_over: 'Voice Over',
}

const PRIORITY_LABELS: Record<ContentPriority, string> = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' }
const PRIORITY_COLORS: Record<ContentPriority, string> = {
  low: 'bg-gray-100 dark:bg-gray-800 text-gray-700',
  medium: 'bg-amber-100 dark:bg-amber-900 text-amber-700',
  high: 'bg-orange-100 dark:bg-orange-900 text-orange-700',
  urgent: 'bg-red-100 dark:bg-red-900 text-red-700',
}

const STATUS_LABELS: Record<ContentRequestStatus, string> = { baru: 'Baru', diproses: 'Diproses', revisi: 'Revisi', selesai: 'Selesai' }
const STATUS_COLORS: Record<ContentRequestStatus, string> = {
  baru: 'bg-gray-100 dark:bg-gray-800 text-gray-700',
  diproses: 'bg-blue-100 dark:bg-blue-900 text-blue-700',
  revisi: 'bg-amber-100 dark:bg-amber-900 text-amber-700',
  selesai: 'bg-green-100 dark:bg-green-900 text-green-700',
}

interface RequestFormProps {
  mediaUsers: User[]
  initial?: ContentRequest
  onClose: () => void
}

function RequestForm({ mediaUsers, initial, onClose }: RequestFormProps) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [productName, setProductName] = useState(initial?.productName ?? '')
  const [contentType, setContentType] = useState<ContentMediaType>(initial?.contentType ?? 'foto')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [deadline, setDeadline] = useState(initial ? initial.deadline.toISOString().slice(0, 10) : '')
  const [priority, setPriority] = useState<ContentPriority>(initial?.priority ?? 'medium')
  const [assignedTo, setAssignedTo] = useState(initial?.assignedTo ?? '')
  const [status, setStatus] = useState<ContentRequestStatus>(initial?.status ?? 'baru')
  const [revisionNotes, setRevisionNotes] = useState(initial?.revisionNotes ?? '')
  const [files, setFiles] = useState<File[]>([])

  const handleSave = async () => {
    if (!productName.trim() || !deadline || !user) return
    setSaving(true)
    try {
      let requestId = initial?.id ?? ''
      if (initial) {
        await updateDocument('content_requests', initial.id, {
          productName,
          contentType,
          description,
          deadline: new Date(deadline),
          priority,
          assignedTo: assignedTo || undefined,
          status,
          revisionNotes,
        })
      } else {
        requestId = await createDoc('content_requests', {
          requestedBy: user.id,
          assignedTo: assignedTo || undefined,
          productName,
          contentType,
          description,
          priority,
          attachments: [],
          status: 'baru',
          deadline: new Date(deadline),
        })
      }

      if (files.length > 0) {
        const newAttachments: Attachment[] = await Promise.all(
          files.map(async (f) => {
            const url = await uploadFile(buildPath.content(requestId, `${Date.now()}-${f.name}`), f)
            return { url, type: (f.type.includes('png') ? 'png' : f.type.includes('pdf') ? 'pdf' : 'jpg') as Attachment['type'], name: f.name }
          })
        )
        const existing = initial?.attachments ?? []
        await updateDocument('content_requests', requestId, { attachments: [...existing, ...newAttachments] })
      }

      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold mb-4">{initial ? 'Edit Request Konten' : 'Buat Request Konten'}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Nama Project / Produk</label>
            <input value={productName} onChange={(e) => setProductName(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Mis. Zenyer 101A" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Jenis Konten</label>
              <select value={contentType} onChange={(e) => setContentType(e.target.value as ContentMediaType)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {(Object.entries(CONTENT_TYPE_LABELS) as [ContentMediaType, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as ContentPriority)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {(Object.entries(PRIORITY_LABELS) as [ContentPriority, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Brief Konten</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none h-20" placeholder="Penjelasan kebutuhan konten..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Deadline</label>
              <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">PIC Media</label>
              <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Belum ditentukan</option>
                {mediaUsers.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
              </select>
            </div>
          </div>
          {initial && (
            <div>
              <label className="text-sm font-medium block mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as ContentRequestStatus)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {(Object.entries(STATUS_LABELS) as [ContentRequestStatus, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
              </select>
            </div>
          )}
          {initial && (
            <div>
              <label className="text-sm font-medium block mb-1">Catatan Revisi</label>
              <textarea value={revisionNotes} onChange={(e) => setRevisionNotes(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none h-16" placeholder="Masukan dari requester..." />
            </div>
          )}
          {initial && initial.attachments.length > 0 && (
            <div>
              <label className="text-sm font-medium block mb-1">File Tersimpan</label>
              <ul className="space-y-1">
                {initial.attachments.map((att, i) => (
                  <li key={i}>
                    <a href={att.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                      <Paperclip className="h-3 w-3" />{att.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <label className="text-sm font-medium block mb-1">
              {initial ? 'Tambah File Pendukung (opsional)' : 'File Pendukung (opsional, foto/video/logo/materi produk)'}
            </label>
            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors">
              <Upload className="h-6 w-6 text-muted-foreground mb-1" />
              <span className="text-xs text-muted-foreground">Drag & drop atau klik untuk upload (boleh lebih dari satu)</span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
            </label>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f) => (
                  <li key={f.name} className="text-xs text-muted-foreground flex items-center gap-1">
                    <Paperclip className="h-3 w-3" />{f.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button onClick={handleSave} disabled={saving || !productName.trim() || !deadline} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {initial ? 'Simpan' : 'Kirim'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ContentCard({ item, mediaUsers, isMedia, onEdit, onDelete }: {
  item: ContentRequest
  mediaUsers: User[]
  isMedia: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const { user } = useAuthStore()
  const [editingLink, setEditingLink] = useState(false)
  const [link, setLink] = useState('')

  const picName = mediaUsers.find((u) => u.id === item.assignedTo)?.name

  const saveLink = async () => {
    if (!link.trim()) return
    await updateDocument('content_requests', item.id, { storageLink: link, status: 'selesai', assignedTo: user?.id })
    setEditingLink(false)
  }

  const startWork = async () => {
    await updateDocument('content_requests', item.id, { status: 'diproses', assignedTo: user?.id })
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Image className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-medium text-sm">{item.productName}</h3>
            <p className="text-xs text-muted-foreground">{CONTENT_TYPE_LABELS[item.contentType]}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={cn('text-xs px-2 py-0.5 rounded-full', STATUS_COLORS[item.status])}>
            {STATUS_LABELS[item.status]}
          </span>
          <span className={cn('text-xs px-2 py-0.5 rounded-full', PRIORITY_COLORS[item.priority])}>
            {PRIORITY_LABELS[item.priority]}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
      <div className="text-xs text-muted-foreground space-y-0.5">
        <p>Deadline: <span className="text-foreground">{format(item.deadline, 'd MMM yyyy', { locale: localeId })}</span></p>
        <p>PIC Media: <span className="text-foreground">{picName ?? 'Belum ditentukan'}</span></p>
      </div>
      {item.revisionNotes && (
        <p className="text-xs bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 rounded-md p-2">
          Revisi: {item.revisionNotes}
        </p>
      )}
      {item.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {item.attachments.map((att, i) => (
            <a key={i} href={att.url} target="_blank" rel="noreferrer" download className="flex items-center gap-1 text-xs text-primary hover:underline">
              <Download className="h-3 w-3" />{att.name}
            </a>
          ))}
        </div>
      )}
      {item.storageLink && (
        <a href={item.storageLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
          <ExternalLink className="h-3 w-3" /> Lihat File Konten
        </a>
      )}
      {isMedia && !item.storageLink && item.status === 'baru' && (
        <button onClick={startWork} className="text-xs text-primary hover:underline">Mulai Kerjakan</button>
      )}
      {isMedia && !item.storageLink && (item.status === 'diproses' || item.status === 'revisi') && (
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
      <div className="flex items-center gap-2 pt-1 border-t border-border">
        <button onClick={onEdit} title="Edit" className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
        <button onClick={onDelete} className="text-muted-foreground hover:text-destructive ml-auto" title="Hapus">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export function ContentPage() {
  const { user } = useAuthStore()
  const [items, setItems] = useState<ContentRequest[]>([])
  const [mediaUsers, setMediaUsers] = useState<User[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<ContentRequest | undefined>()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<ContentRequestStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<ContentRequest | null>(null)
  const [deleting, setDeleting] = useState(false)
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
    const unsubU = subscribeToCollection('users', [where('role', '==', 'media')], (docs) => {
      setMediaUsers(docs as unknown as User[])
    })
    return () => { unsubscribe(); unsubU() }
  }, [])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDocument('content_requests', deleteTarget.id)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const filtered = items.filter((item) => {
    const matchSearch = item.productName.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || item.status === filterStatus
    return matchSearch && matchStatus
  })
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Request Konten</h1>
          <p className="text-sm text-muted-foreground">Request dan manajemen konten mesin</p>
        </div>
        <button
          onClick={() => { setEditItem(undefined); setShowForm(true) }}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Buat Request
        </button>
      </div>

      {/* KPI Cards */}
      {(() => {
        const revisiCount = items.filter((r) => r.status === 'revisi').length
        const cards = [
          {
            label: 'Total Request',
            count: items.length,
            icon: <TrendingUp className="h-5 w-5" />,
            color: 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400',
            filter: null as ContentRequestStatus | 'all' | null,
          },
          {
            label: 'Baru',
            count: items.filter((r) => r.status === 'baru').length,
            icon: <Clock className="h-5 w-5" />,
            color: 'bg-gray-100 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400',
            filter: 'baru' as ContentRequestStatus | 'all' | null,
          },
          {
            label: 'Diproses',
            count: items.filter((r) => r.status === 'diproses').length,
            icon: <RefreshCw className="h-5 w-5" />,
            color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
            filter: 'diproses' as ContentRequestStatus | 'all' | null,
          },
          {
            label: 'Revisi',
            count: revisiCount,
            icon: <RotateCcw className="h-5 w-5" />,
            color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400',
            filter: 'revisi' as ContentRequestStatus | 'all' | null,
          },
          {
            label: 'Selesai',
            count: items.filter((r) => r.status === 'selesai').length,
            icon: <CheckCircle2 className="h-5 w-5" />,
            color: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400',
            filter: 'selesai' as ContentRequestStatus | 'all' | null,
          },
        ]
        return (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {cards.map((c) => {
                const isActive = c.filter !== null && filterStatus === c.filter
                return (
                  <button
                    key={c.label}
                    onClick={() => {
                      if (!c.filter) return
                      setFilterStatus(isActive ? 'all' : c.filter)
                      setPage(1)
                    }}
                    className={cn(
                      'bg-card border rounded-xl p-4 text-left transition-all',
                      c.filter ? 'cursor-pointer hover:shadow-md' : 'cursor-default',
                      isActive ? 'border-primary ring-1 ring-primary/30' : 'border-border'
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className={cn('p-2 rounded-lg', c.color)}>{c.icon}</span>
                      <span className="text-2xl font-bold">{c.count}</span>
                    </div>
                    <p className="text-sm font-medium">{c.label}</p>
                  </button>
                )
              })}
            </div>
            {revisiCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span><span className="font-semibold">{revisiCount}</span> request konten perlu direvisi</span>
              </div>
            )}
          </>
        )
      })()}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Cari nama produk..."
            className="w-full pl-9 pr-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value as ContentRequestStatus | 'all'); setPage(1) }}
          className="px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Semua Status</option>
          {(Object.entries(STATUS_LABELS) as [ContentRequestStatus, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
        </select>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {paginated.map((item) => (
          <ContentCard
            key={item.id}
            item={item}
            mediaUsers={mediaUsers}
            isMedia={isMedia}
            onEdit={() => { setEditItem(item); setShowForm(true) }}
            onDelete={() => setDeleteTarget(item)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm bg-card border border-border rounded-xl">
            Belum ada request konten
          </div>
        )}
      </div>

      <Pagination page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {showForm && (
        <RequestForm mediaUsers={mediaUsers} initial={editItem} onClose={() => { setShowForm(false); setEditItem(undefined) }} />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Hapus request konten "${deleteTarget.productName}"?`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
