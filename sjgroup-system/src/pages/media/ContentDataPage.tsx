import { useEffect, useState } from 'react'
import { Plus, Trash2, Loader2, Search, Upload, Paperclip, ExternalLink } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { ContentData, ContentCategory, ContentPlatform, ContentFormat, ContentProductionStatus, User, Attachment } from '@/types'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { toDate } from '@/utils/firestore'
import { useAuthStore } from '@/store/authStore'
import { createDoc, updateDocument, deleteDocument, subscribeToCollection, where } from '@/services/firestore.service'
import { uploadFile, buildPath } from '@/services/storage.service'
import { Pagination } from '@/components/common/Pagination'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

const PAGE_SIZE = 10

const CATEGORY_LABELS: Record<ContentCategory, string> = {
  produk: 'Produk',
  edukasi: 'Edukasi',
  testimoni: 'Testimoni',
  promo: 'Promo',
  event: 'Event',
  company_profile: 'Company Profile',
}

const PLATFORM_LABELS: Record<ContentPlatform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  facebook: 'Facebook',
  website: 'Website',
}

const FORMAT_LABELS: Record<ContentFormat, string> = {
  '9:16': '9:16',
  '1:1': '1:1',
  '16:9': '16:9',
  a4: 'A4',
  banner: 'Banner',
}

const STATUS_LABELS: Record<ContentProductionStatus, string> = {
  draft: 'Draft',
  editing: 'Editing',
  review: 'Review',
  revisi: 'Revisi',
  approved: 'Approved',
  final: 'Final',
}
const STATUS_COLORS: Record<ContentProductionStatus, string> = {
  draft: 'bg-gray-100 dark:bg-gray-800 text-gray-700',
  editing: 'bg-blue-100 dark:bg-blue-900 text-blue-700',
  review: 'bg-amber-100 dark:bg-amber-900 text-amber-700',
  revisi: 'bg-orange-100 dark:bg-orange-900 text-orange-700',
  approved: 'bg-cyan-100 dark:bg-cyan-900 text-cyan-700',
  final: 'bg-green-100 dark:bg-green-900 text-green-700',
}

interface ContentFormProps {
  mediaUsers: User[]
  initial?: ContentData
  onClose: () => void
}

function ContentForm({ mediaUsers, initial, onClose }: ContentFormProps) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [category, setCategory] = useState<ContentCategory>(initial?.category ?? 'produk')
  const [platform, setPlatform] = useState<ContentPlatform[]>(initial?.platform ?? [])
  const [contentFormat, setContentFormat] = useState<ContentFormat>(initial?.format ?? '9:16')
  const [caption, setCaption] = useState(initial?.caption ?? '')
  const [voiceOverScript, setVoiceOverScript] = useState(initial?.voiceOverScript ?? '')
  const [hashtag, setHashtag] = useState(initial?.hashtag ?? '')
  const [driveLink, setDriveLink] = useState(initial?.driveLink ?? '')
  const [productionStatus, setProductionStatus] = useState<ContentProductionStatus>(initial?.productionStatus ?? 'draft')
  const [uploadDate, setUploadDate] = useState(initial?.uploadDate ? initial.uploadDate.toISOString().slice(0, 10) : '')
  const [pic, setPic] = useState(initial?.pic ?? mediaUsers[0]?.id ?? '')
  const [files, setFiles] = useState<File[]>([])

  const togglePlatform = (p: ContentPlatform) =>
    setPlatform((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])

  const handleSave = async () => {
    if (!title.trim() || !pic || !user) return
    setSaving(true)
    try {
      let contentId = initial?.id ?? ''
      const data = {
        title,
        category,
        platform,
        format: contentFormat,
        caption,
        voiceOverScript,
        hashtag,
        driveLink,
        productionStatus,
        uploadDate: uploadDate ? new Date(uploadDate) : undefined,
        pic,
      }
      if (initial) {
        await updateDocument('content_data', initial.id, data)
      } else {
        contentId = await createDoc('content_data', { ...data, files: [], createdBy: user.id })
      }

      if (files.length > 0) {
        const newFiles: Attachment[] = await Promise.all(
          files.map(async (f) => {
            const url = await uploadFile(buildPath.contentData(contentId, `${Date.now()}-${f.name}`), f)
            return { url, type: (f.type.includes('png') ? 'png' : f.type.includes('pdf') ? 'pdf' : 'jpg') as Attachment['type'], name: f.name }
          })
        )
        const existing = initial?.files ?? []
        await updateDocument('content_data', contentId, { files: [...existing, ...newFiles] })
      }

      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold mb-4">{initial ? 'Edit Data Konten' : 'Tambah Data Konten'}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Judul Konten</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Kategori Konten</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as ContentCategory)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {(Object.entries(CATEGORY_LABELS) as [ContentCategory, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Format Konten</label>
              <select value={contentFormat} onChange={(e) => setContentFormat(e.target.value as ContentFormat)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {(Object.entries(FORMAT_LABELS) as [ContentFormat, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Platform</label>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(PLATFORM_LABELS) as [ContentPlatform, string][]).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => togglePlatform(k)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs border transition-colors',
                    platform.includes(k) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-foreground'
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Caption</label>
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none h-16" placeholder="Teks caption posting..." />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Voice Over (script)</label>
            <textarea value={voiceOverScript} onChange={(e) => setVoiceOverScript(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none h-16" placeholder="Script VO jika konten video..." />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Hashtag</label>
            <input value={hashtag} onChange={(e) => setHashtag(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="#sudijaya #mesinsortir ..." />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Link Drive</label>
            <input type="url" value={driveLink} onChange={(e) => setDriveLink(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="https://drive.google.com/..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Status Produksi</label>
              <select value={productionStatus} onChange={(e) => setProductionStatus(e.target.value as ContentProductionStatus)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {(Object.entries(STATUS_LABELS) as [ContentProductionStatus, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Tanggal Upload</label>
              <input type="date" value={uploadDate} onChange={(e) => setUploadDate(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">PIC</label>
            <select value={pic} onChange={(e) => setPic(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {mediaUsers.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
            </select>
          </div>
          {initial && initial.files.length > 0 && (
            <div>
              <label className="text-sm font-medium block mb-1">File Tersimpan</label>
              <ul className="space-y-1">
                {initial.files.map((f, i) => (
                  <li key={i}>
                    <a href={f.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                      <Paperclip className="h-3 w-3" />{f.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <label className="text-sm font-medium block mb-1">
              {initial ? 'Tambah File Desain/Video (opsional)' : 'File Desain/Video (opsional)'}
            </label>
            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors">
              <Upload className="h-6 w-6 text-muted-foreground mb-1" />
              <span className="text-xs text-muted-foreground">Drag & drop atau klik untuk upload (boleh lebih dari satu)</span>
              <input type="file" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
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
          <button onClick={handleSave} disabled={saving || !title.trim() || !pic} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Simpan
          </button>
        </div>
      </div>
    </div>
  )
}

export function ContentDataPage() {
  const [items, setItems] = useState<ContentData[]>([])
  const [mediaUsers, setMediaUsers] = useState<User[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<ContentData | undefined>()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<ContentProductionStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<ContentData | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const unsubC = subscribeToCollection('content_data', [], (docs) => {
      setItems(
        docs.map((d) => ({
          ...d,
          uploadDate: d.uploadDate ? toDate(d.uploadDate as never) : undefined,
          createdAt: toDate(d.createdAt as never) ?? new Date(),
        })) as unknown as ContentData[]
      )
    })
    const unsubU = subscribeToCollection('users', [where('role', '==', 'media')], (docs) => setMediaUsers(docs as unknown as User[]))
    return () => { unsubC(); unsubU() }
  }, [])

  const picName = (id: string) => mediaUsers.find((u) => u.id === id)?.name ?? '-'

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDocument('content_data', deleteTarget.id)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const filtered = items.filter((item) => {
    const matchSearch = item.title.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || item.productionStatus === filterStatus
    return matchSearch && matchStatus
  })
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Data Konten</h1>
          <p className="text-sm text-muted-foreground">Daftar konten yang sedang/sudah dibuat</p>
        </div>
        <button
          onClick={() => { setEditItem(undefined); setShowForm(true) }}
          disabled={mediaUsers.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Tambah Konten
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Cari judul konten..."
            className="w-full pl-9 pr-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value as ContentProductionStatus | 'all'); setPage(1) }}
          className="px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Semua Status</option>
          {(Object.entries(STATUS_LABELS) as [ContentProductionStatus, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
        </select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">ID</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Judul Konten</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Kategori</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Platform</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Format</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Status Produksi</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Tanggal Upload</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">PIC</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Drive</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.map((item) => (
                <tr key={item.id} className="hover:bg-muted/20">
                  <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">KT-{String(item.seq).padStart(4, '0')}</td>
                  <td className="p-3 font-medium whitespace-nowrap">{item.title}</td>
                  <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{CATEGORY_LABELS[item.category]}</td>
                  <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{item.platform.map((p) => PLATFORM_LABELS[p]).join(', ') || '-'}</td>
                  <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{FORMAT_LABELS[item.format]}</td>
                  <td className="p-3">
                    <span className={cn('px-2 py-0.5 text-xs rounded-full whitespace-nowrap', STATUS_COLORS[item.productionStatus])}>
                      {STATUS_LABELS[item.productionStatus]}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                    {item.uploadDate ? format(item.uploadDate, 'd MMM yyyy', { locale: localeId }) : '-'}
                  </td>
                  <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{picName(item.pic)}</td>
                  <td className="p-3">
                    {item.driveLink ? (
                      <a href={item.driveLink} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <button onClick={() => { setEditItem(item); setShowForm(true) }} className="text-xs text-primary hover:underline">Edit</button>
                      <button onClick={() => setDeleteTarget(item)} className="text-muted-foreground hover:text-destructive" title="Hapus">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Belum ada data konten</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {showForm && (
        <ContentForm mediaUsers={mediaUsers} initial={editItem} onClose={() => { setShowForm(false); setEditItem(undefined) }} />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Hapus data konten "${deleteTarget.title}"?`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
