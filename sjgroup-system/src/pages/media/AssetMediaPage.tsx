import { useEffect, useState } from 'react'
import { Plus, Trash2, Loader2, Search, Download, Upload } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { MediaAsset, MediaAssetCategory } from '@/types'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { toDate } from '@/utils/firestore'
import { useAuthStore } from '@/store/authStore'
import { createDoc, updateDocument, deleteDocument, subscribeToCollection } from '@/services/firestore.service'
import { uploadFile, buildPath } from '@/services/storage.service'
import { Pagination } from '@/components/common/Pagination'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

const PAGE_SIZE = 10

const CATEGORY_LABELS: Record<MediaAssetCategory, string> = {
  logo_brand: 'Logo Brand',
  foto_produk: 'Foto Produk',
  video_produk: 'Video Produk',
  template_desain: 'Template Desain',
  font_warna_brand: 'Font & Warna Brand',
  voice_over: 'Voice Over',
  musik_sfx: 'Musik / SFX',
  broll: 'B-roll',
}

interface AssetFormProps {
  initial?: MediaAsset
  onClose: () => void
}

function AssetForm({ initial, onClose }: AssetFormProps) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [category, setCategory] = useState<MediaAssetCategory>(initial?.category ?? 'logo_brand')
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [file, setFile] = useState<File | null>(null)

  const handleSave = async () => {
    if (!name.trim() || (!initial && !file) || !user) return
    setSaving(true)
    try {
      let fileUrl = initial?.fileUrl ?? ''
      if (file) {
        fileUrl = await uploadFile(buildPath.mediaAsset(`${Date.now()}`, file.name), file)
      }
      const data = { category, name, description, fileUrl, uploadedBy: user.id }
      if (initial) {
        await updateDocument('media_assets', initial.id, data)
      } else {
        await createDoc('media_assets', data)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5">
        <h3 className="font-semibold mb-4">{initial ? 'Edit Asset' : 'Tambah Asset Media'}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Kategori Asset</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as MediaAssetCategory)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {(Object.entries(CATEGORY_LABELS) as [MediaAssetCategory, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Nama Asset</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Mis. Logo Nordic, Foto mesin sortir..." />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Keterangan</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none h-16" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">{initial ? 'Ganti File (opsional)' : 'File Asset'}</label>
            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors">
              <Upload className="h-6 w-6 text-muted-foreground mb-1" />
              <span className="text-xs text-muted-foreground">{file ? file.name : 'Klik untuk upload file'}</span>
              <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            {initial && !file && (
              <a href={initial.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline mt-1 inline-block">File saat ini</a>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button onClick={handleSave} disabled={saving || !name.trim() || (!initial && !file)} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Simpan
          </button>
        </div>
      </div>
    </div>
  )
}

export function AssetMediaPage() {
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editAsset, setEditAsset] = useState<MediaAsset | undefined>()
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<MediaAssetCategory | 'all'>('all')
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const unsubscribe = subscribeToCollection('media_assets', [], (docs) => {
      setAssets(
        docs.map((d) => ({ ...d, createdAt: toDate(d.createdAt as never) ?? new Date() })) as unknown as MediaAsset[]
      )
    })
    return unsubscribe
  }, [])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDocument('media_assets', deleteTarget.id)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const filtered = assets.filter((a) => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase())
    const matchCategory = filterCategory === 'all' || a.category === filterCategory
    return matchSearch && matchCategory
  })
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Asset Media</h1>
          <p className="text-sm text-muted-foreground">Penyimpanan bahan konten: logo, foto, video, template, dll</p>
        </div>
        <button
          onClick={() => { setEditAsset(undefined); setShowForm(true) }}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Tambah Asset
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Cari nama asset..."
            className="w-full pl-9 pr-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => { setFilterCategory(e.target.value as MediaAssetCategory | 'all'); setPage(1) }}
          className="px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Semua Kategori</option>
          {(Object.entries(CATEGORY_LABELS) as [MediaAssetCategory, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
        </select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Nama Asset</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Kategori</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Keterangan</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Ditambahkan</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">File</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.map((a) => (
                <tr key={a.id} className="hover:bg-muted/20">
                  <td className="p-3 font-medium whitespace-nowrap">{a.name}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary whitespace-nowrap">{CATEGORY_LABELS[a.category]}</span>
                  </td>
                  <td className="p-3 text-muted-foreground text-xs max-w-[220px] truncate">{a.description}</td>
                  <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{format(a.createdAt, 'd MMM yyyy', { locale: localeId })}</td>
                  <td className="p-3">
                    <a href={a.fileUrl} target="_blank" rel="noreferrer" download className="flex items-center gap-1 text-xs text-primary hover:underline whitespace-nowrap">
                      <Download className="h-3.5 w-3.5" /> Unduh
                    </a>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <button onClick={() => { setEditAsset(a); setShowForm(true) }} className="text-xs text-primary hover:underline">Edit</button>
                      <button onClick={() => setDeleteTarget(a)} className="text-muted-foreground hover:text-destructive" title="Hapus">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Belum ada asset media</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {showForm && (
        <AssetForm initial={editAsset} onClose={() => { setShowForm(false); setEditAsset(undefined) }} />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Hapus asset "${deleteTarget.name}"?`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
