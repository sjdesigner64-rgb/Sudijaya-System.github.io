import { useEffect, useRef, useState } from 'react'
import { Plus, ExternalLink, Image, Loader2, Search, Upload, Paperclip, Trash2, Download, Pencil, TrendingUp, Clock, RefreshCw, RotateCcw, CheckCircle2, AlertTriangle, FileText } from 'lucide-react'
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
  foto: 'Foto', video: 'Video', desain: 'Desain',
  reels: 'Reels', katalog: 'Katalog', voice_over: 'Voice Over',
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

// ─── Form Request (Sales & Admin) ─────────────────────────────────────────────
// Sales: hanya isi metadata (productName, contentType, description, deadline, priority, PIC)
//        TIDAK ada upload file
// Admin: bisa isi semua + upload referensi + ubah status
function RequestForm({
  mediaUsers, initial, isAdmin, onClose,
}: {
  mediaUsers: User[]
  initial?: ContentRequest
  isAdmin: boolean
  onClose: () => void
}) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [productName, setProductName] = useState(initial?.productName ?? '')
  const [contentType, setContentType] = useState<ContentMediaType>(initial?.contentType ?? 'foto')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [deadline, setDeadline] = useState(
    initial ? (toDate(initial.deadline as never) ?? new Date()).toISOString().slice(0, 10) : ''
  )
  const [priority, setPriority] = useState<ContentPriority>(initial?.priority ?? 'medium')
  const [assignedTo, setAssignedTo] = useState(initial?.assignedTo ?? '')
  const [status, setStatus] = useState<ContentRequestStatus>(initial?.status ?? 'baru')
  const [revisionNotes, setRevisionNotes] = useState(initial?.revisionNotes ?? '')
  // Upload referensi hanya untuk admin
  const [files, setFiles] = useState<File[]>([])

  const handleSave = async () => {
    setSubmitted(true)
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
          assignedTo: assignedTo || null,
          ...(isAdmin ? { status, revisionNotes } : {}),
        })
      } else {
        requestId = await createDoc('content_requests', {
          requestedBy: user.id,
          assignedTo: assignedTo || null,
          productName,
          contentType,
          description,
          priority,
          attachments: [],
          status: 'baru',
          deadline: new Date(deadline),
        })
      }

      // Upload referensi: hanya admin
      if (isAdmin && files.length > 0) {
        const newAttachments: Attachment[] = await Promise.all(
          files.map(async (f) => {
            const url = await uploadFile(buildPath.content(requestId, `ref-${Date.now()}-${f.name}`), f)
            const ext = f.name.split('.').pop()?.toLowerCase()
            const type: Attachment['type'] = ext === 'pdf' ? 'pdf' : ext === 'png' ? 'png' : 'jpg'
            return { url, type, name: f.name }
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
      <div className="bg-card border border-border rounded-xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="px-5 pt-5 pb-3 shrink-0 border-b border-border">
          <h3 className="font-semibold">{initial ? 'Edit Request Konten' : 'Buat Request Konten'}</h3>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Nama Produk / Project <span className="text-red-500">*</span></label>
            <input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className={`w-full px-3 py-2 border ${submitted && !productName.trim() ? 'border-red-400' : 'border-input'} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`}
              placeholder="Mis. Zenyer 101A"
            />
            {submitted && !productName.trim() && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Jenis Konten</label>
              <select value={contentType} onChange={(e) => setContentType(e.target.value as ContentMediaType)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {(Object.entries(CONTENT_TYPE_LABELS) as [ContentMediaType, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Prioritas</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as ContentPriority)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {(Object.entries(PRIORITY_LABELS) as [ContentPriority, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Brief Konten</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Penjelasan kebutuhan konten, angle foto, tone, dll..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Deadline <span className="text-red-500">*</span></label>
              <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                className={`w-full px-3 py-2 border ${submitted && !deadline ? 'border-red-400' : 'border-input'} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`} />
              {submitted && !deadline && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">PIC Media</label>
              <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">— Belum ditentukan —</option>
                {mediaUsers.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
              </select>
            </div>
          </div>

          {/* Status & revisionNotes: hanya admin */}
          {initial && isAdmin && (
            <>
              <div>
                <label className="text-sm font-medium block mb-1">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as ContentRequestStatus)}
                  className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                  {(Object.entries(STATUS_LABELS) as [ContentRequestStatus, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Catatan Revisi</label>
                <textarea value={revisionNotes} onChange={(e) => setRevisionNotes(e.target.value)} rows={2}
                  className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="Masukan dari requester..." />
              </div>
            </>
          )}

          {/* Upload referensi: hanya admin */}
          {isAdmin && (
            <>
              {initial && (initial.attachments ?? []).length > 0 && (
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
                  {initial ? 'Tambah File Referensi (opsional)' : 'File Referensi (opsional)'}
                </label>
                <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors">
                  <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">Foto / video / PDF referensi — boleh lebih dari satu</span>
                  <input type="file" multiple className="hidden"
                    onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
                </label>
                {files.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {files.map((f) => (
                      <li key={f.name} className="text-xs text-muted-foreground flex items-center gap-1">
                        <Paperclip className="h-3 w-3" />{f.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
        <div className="px-5 pb-5 pt-3 shrink-0 border-t border-border flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {initial ? 'Simpan' : 'Kirim Request'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Upload Konten (Media saja) ──────────────────────────────────────────────
function MediaUploadSection({ item }: { item: ContentRequest }) {
  const { user } = useAuthStore()
  const [uploading, setUploading] = useState(false)
  const [editingLink, setEditingLink] = useState(false)
  const [link, setLink] = useState(item.storageLink ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (fileList: FileList) => {
    const files = Array.from(fileList)
    if (files.length === 0) return
    setUploading(true)
    try {
      const newAttachments: Attachment[] = await Promise.all(
        files.map(async (f) => {
          const url = await uploadFile(buildPath.content(item.id, `hasil-${Date.now()}-${f.name}`), f)
          const ext = f.name.split('.').pop()?.toLowerCase()
          const type: Attachment['type'] = ext === 'pdf' ? 'pdf' : ext === 'png' ? 'png' : 'jpg'
          return { url, type, name: f.name }
        })
      )
      const existing = item.attachments ?? []
      const updates: Record<string, unknown> = {
        attachments: [...existing, ...newAttachments],
        assignedTo: item.assignedTo || user?.id,
      }
      // Auto-ubah status jadi diproses saat upload pertama
      if (item.status === 'baru') updates.status = 'diproses'
      await updateDocument('content_requests', item.id, updates)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const saveLink = async () => {
    if (!link.trim()) return
    await updateDocument('content_requests', item.id, {
      storageLink: link.trim(),
      status: 'selesai',
      assignedTo: item.assignedTo || user?.id,
    })
    setEditingLink(false)
  }

  const startWork = async () => {
    await updateDocument('content_requests', item.id, {
      status: 'diproses',
      assignedTo: user?.id,
    })
  }

  return (
    <div className="space-y-2">
      {/* Mulai kerjakan (hanya jika masih baru) */}
      {item.status === 'baru' && (
        <button onClick={startWork}
          className="text-xs text-primary hover:underline flex items-center gap-1">
          Mulai Kerjakan
        </button>
      )}

      {/* Upload file konten */}
      <label className={cn(
        'inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border cursor-pointer transition-colors',
        uploading ? 'text-muted-foreground border-border cursor-not-allowed'
          : 'text-primary border-primary/40 hover:bg-primary/5'
      )}>
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {uploading ? 'Mengupload...' : 'Upload Konten'}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          disabled={uploading}
          onChange={(e) => { if (e.target.files) handleUpload(e.target.files) }}
        />
      </label>

      {/* Input link storage / Google Drive */}
      {(item.status === 'diproses' || item.status === 'revisi' || item.status === 'selesai') && (
        editingLink ? (
          <div className="flex gap-1 flex-wrap">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Link Google Drive / storage..."
              className="flex-1 min-w-[160px] px-2 py-1 border border-input rounded text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button onClick={saveLink} className="text-xs text-primary hover:underline whitespace-nowrap">Simpan & Selesai</button>
            <button onClick={() => { setEditingLink(false); setLink(item.storageLink ?? '') }}
              className="text-xs text-muted-foreground hover:underline">Batal</button>
          </div>
        ) : (
          <button onClick={() => setEditingLink(true)}
            className="text-xs text-primary hover:underline">
            {item.storageLink ? '↻ Ganti Link Konten' : '+ Input Link Konten'}
          </button>
        )
      )}
    </div>
  )
}

// ─── Status Inline (Media saja) ──────────────────────────────────────────────
function StatusSelectMedia({ item }: { item: ContentRequest }) {
  const [saving, setSaving] = useState(false)

  const handleChange = async (newStatus: ContentRequestStatus) => {
    if (newStatus === item.status || saving) return
    setSaving(true)
    try {
      await updateDocument('content_requests', item.id, { status: newStatus })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-1">
      {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      <select
        value={item.status}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value as ContentRequestStatus)}
        className={cn(
          'text-xs px-2 py-0.5 rounded-full border border-transparent cursor-pointer focus:outline-none disabled:opacity-50',
          STATUS_COLORS[item.status]
        )}
      >
        {(Object.entries(STATUS_LABELS) as [ContentRequestStatus, string][]).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
    </div>
  )
}

// ─── Request Revisi (Sales saja) ─────────────────────────────────────────────
function RevisionSection({ item }: { item: ContentRequest }) {
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState(item.revisionNotes ?? '')

  const submitRevision = async () => {
    if (!notes.trim()) return
    await updateDocument('content_requests', item.id, {
      revisionNotes: notes.trim(),
      status: 'revisi',
    })
    setEditing(false)
  }

  // Hanya tampil setelah konten tersedia (selesai atau sudah direvisi sebelumnya)
  if (item.status !== 'selesai' && item.status !== 'revisi') return null

  return (
    <div>
      {item.status === 'revisi' && item.revisionNotes && (
        <p className="text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-md p-2 mb-1.5">
          Catatan revisi: {item.revisionNotes}
        </p>
      )}
      {editing ? (
        <div className="space-y-1.5">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Masukan revisi untuk tim media..."
            className="w-full px-2 py-1 border border-input rounded text-xs bg-background focus:outline-none resize-none"
          />
          <div className="flex gap-2">
            <button onClick={submitRevision} disabled={!notes.trim()}
              className="text-xs text-primary hover:underline disabled:opacity-50">Kirim Revisi</button>
            <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:underline">Batal</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setEditing(true)}
          className="text-xs text-amber-600 hover:underline">
          {item.status === 'revisi' ? '✎ Edit Catatan Revisi' : '+ Request Revisi'}
        </button>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
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

  const isSales = user?.role === 'sales'
  const isMedia = user?.role === 'media'
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin'

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

  // Visibility berdasarkan role
  const visibleItems = items.filter((item) => {
    if (isAdmin) return true
    if (isSales) return item.requestedBy === user?.id
    // Media: lihat request yang di-assign ke dirinya atau belum di-assign
    if (isMedia) return item.assignedTo === user?.id || !item.assignedTo
    return false
  })

  const filtered = visibleItems.filter((item) => {
    const matchSearch = item.productName.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || item.status === filterStatus
    return matchSearch && matchStatus
  })
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const revisiCount = visibleItems.filter((r) => r.status === 'revisi').length

  const kpiCards = [
    { label: 'Total', count: visibleItems.length, icon: <TrendingUp className="h-5 w-5" />, color: 'bg-violet-100 dark:bg-violet-900/40 text-violet-600', filter: null as ContentRequestStatus | null },
    { label: 'Baru', count: visibleItems.filter((r) => r.status === 'baru').length, icon: <Clock className="h-5 w-5" />, color: 'bg-gray-100 dark:bg-gray-800/60 text-gray-600', filter: 'baru' as ContentRequestStatus },
    { label: 'Diproses', count: visibleItems.filter((r) => r.status === 'diproses').length, icon: <RefreshCw className="h-5 w-5" />, color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600', filter: 'diproses' as ContentRequestStatus },
    { label: 'Revisi', count: revisiCount, icon: <RotateCcw className="h-5 w-5" />, color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600', filter: 'revisi' as ContentRequestStatus },
    { label: 'Selesai', count: visibleItems.filter((r) => r.status === 'selesai').length, icon: <CheckCircle2 className="h-5 w-5" />, color: 'bg-green-100 dark:bg-green-900/40 text-green-600', filter: 'selesai' as ContentRequestStatus },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Request Konten</h1>
          <p className="text-sm text-muted-foreground">
            {isMedia ? 'Request konten yang ditugaskan kepada Anda' : 'Request konten ke tim Media'}
          </p>
        </div>
        {/* Media tidak bisa buat request — hanya fulfil */}
        {!isMedia && (
          <button
            onClick={() => { setEditItem(undefined); setShowForm(true) }}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Buat Request
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpiCards.map((c) => {
          const isActive = c.filter !== null && filterStatus === c.filter
          return (
            <button key={c.label}
              onClick={() => { if (!c.filter) return; setFilterStatus(isActive ? 'all' : c.filter); setPage(1) }}
              className={cn(
                'bg-card border rounded-xl p-4 text-left transition-all',
                c.filter ? 'cursor-pointer hover:shadow-md' : 'cursor-default',
                isActive ? 'border-primary ring-1 ring-primary/30' : 'border-border'
              )}>
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

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Cari nama produk..."
            className="w-full pl-9 pr-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value as ContentRequestStatus | 'all'); setPage(1) }}
          className="px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">Semua Status</option>
          {(Object.entries(STATUS_LABELS) as [ContentRequestStatus, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
        </select>
      </div>

      {/* Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {paginated.map((item) => {
          const picName = mediaUsers.find((u) => u.id === item.assignedTo)?.name
          const isMyRequest = item.requestedBy === user?.id
          const isAssignedToMe = item.assignedTo === user?.id
          const atts = item.attachments ?? []

          return (
            <div key={item.id} className="bg-card border border-border rounded-xl p-4 space-y-3 flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Image className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-sm truncate">{item.productName}</h3>
                    <p className="text-xs text-muted-foreground">{CONTENT_TYPE_LABELS[item.contentType]}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full whitespace-nowrap', STATUS_COLORS[item.status])}>
                    {STATUS_LABELS[item.status]}
                  </span>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full whitespace-nowrap', PRIORITY_COLORS[item.priority])}>
                    {PRIORITY_LABELS[item.priority]}
                  </span>
                </div>
              </div>

              {/* Brief */}
              {item.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
              )}

              {/* Info */}
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>Deadline: <span className="text-foreground">
                  {format(item.deadline instanceof Date ? item.deadline : new Date(item.deadline as unknown as string), 'd MMM yyyy', { locale: localeId })}
                </span></p>
                <p>PIC Media: <span className="text-foreground">{picName ?? 'Belum ditentukan'}</span></p>
              </div>

              {/* File konten hasil media — download untuk sales/admin */}
              {atts.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">
                    {isMedia ? 'File yang sudah diupload:' : 'Konten tersedia:'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {atts.map((att, i) => (
                      <a key={i} href={att.url} target="_blank" rel="noreferrer"
                        {...(!isMedia ? { download: att.name } : {})}
                        className="flex items-center gap-1 text-xs text-green-600 hover:underline">
                        {att.type === 'pdf' ? <FileText className="h-3 w-3" /> : <Download className="h-3 w-3" />}
                        {att.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Link storage / Google Drive */}
              {item.storageLink && (
                <a href={item.storageLink} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" /> Lihat File Konten (Drive)
                </a>
              )}

              {/* Catatan revisi (untuk media agar tahu) */}
              {isMedia && item.status === 'revisi' && item.revisionNotes && (
                <p className="text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-md p-2">
                  Catatan revisi: {item.revisionNotes}
                </p>
              )}

              <div className="flex-1" />

              {/* Footer aksi berdasarkan role */}
              <div className="pt-1 border-t border-border space-y-2">

                {/* ── Media: upload + status + drive link ── */}
                {isMedia && isAssignedToMe && (
                  <>
                    <StatusSelectMedia item={item} />
                    <MediaUploadSection item={item} />
                  </>
                )}
                {/* Media belum di-assign: bisa mulai ambil request */}
                {isMedia && !item.assignedTo && (
                  <MediaUploadSection item={item} />
                )}

                {/* ── Sales & Admin: revision request + edit + delete ── */}
                {!isMedia && (
                  <div className="space-y-2">
                    {/* Request revisi: hanya sales untuk request miliknya yang sudah selesai */}
                    {isSales && isMyRequest && (
                      <RevisionSection item={item} />
                    )}

                    {/* Admin: tampilkan catatan revisi */}
                    {isAdmin && item.revisionNotes && (
                      <p className="text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-md p-2">
                        Catatan revisi: {item.revisionNotes}
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      {/* Edit: admin bisa edit semua, sales hanya miliknya */}
                      {(isAdmin || (isSales && isMyRequest)) && (
                        <button onClick={() => { setEditItem(item); setShowForm(true) }} title="Edit"
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {/* Hapus: admin bisa hapus semua, sales hanya miliknya */}
                      {(isAdmin || (isSales && isMyRequest)) && (
                        <button onClick={() => setDeleteTarget(item)} title="Hapus"
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-accent transition-colors ml-auto">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm bg-card border border-border rounded-xl">
            {isMedia ? 'Tidak ada request konten untuk Anda' : 'Belum ada request konten'}
          </div>
        )}
      </div>

      <Pagination page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {showForm && (
        <RequestForm
          mediaUsers={mediaUsers}
          initial={editItem}
          isAdmin={isAdmin}
          onClose={() => { setShowForm(false); setEditItem(undefined) }}
        />
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
