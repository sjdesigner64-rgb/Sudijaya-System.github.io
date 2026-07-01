import { useEffect, useRef, useState } from 'react'
import { Plus, Upload, FileText, Loader2, Search, Trash2, Pencil, Download, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { BomRequest, BomStatus, User } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { createDoc, updateDocument, deleteDocument, subscribeToCollection, where } from '@/services/firestore.service'
import { uploadFile, buildPath } from '@/services/storage.service'
import { notifyBomRequest, notifyBomResultUploaded, notifyBomDone } from '@/services/notification.service'
import { Pagination } from '@/components/common/Pagination'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

const PAGE_SIZE = 10

const STATUS_LABELS: Record<BomStatus, string> = {
  pending_fabrikasi: 'Menunggu Fabrikasi',
  pending_admin: 'Menunggu Admin',
  done: 'Selesai',
}
const STATUS_COLORS: Record<BomStatus, string> = {
  pending_fabrikasi: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300',
  pending_admin: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
  done: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
}
const STATUS_ICONS: Record<BomStatus, React.ReactNode> = {
  pending_fabrikasi: <Clock className="h-3 w-3" />,
  pending_admin: <AlertCircle className="h-3 w-3" />,
  done: <CheckCircle2 className="h-3 w-3" />,
}

const err = (invalid: boolean) =>
  invalid ? 'border-red-400 dark:border-red-600' : 'border-input'

// ─── Form Buat / Edit Request ─────────────────────────────────────────────────
function RequestForm({
  adminUsers,
  fabrikasiUsers,
  onClose,
  initial,
}: {
  adminUsers: User[]
  fabrikasiUsers: User[]
  onClose: () => void
  initial?: BomRequest
}) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [namaProject, setNamaProject] = useState(initial?.namaProject ?? '')
  const [assignedAdmin, setAssignedAdmin] = useState(initial?.assignedAdmin ?? adminUsers[0]?.id ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const handleSubmit = async () => {
    setSubmitted(true)
    if (!user || !namaProject.trim() || !assignedAdmin) return
    setSaving(true)
    try {
      if (initial) {
        await updateDocument('requests_bom', initial.id, {
          namaProject: namaProject.trim(),
          assignedAdmin,
          notes,
        })
      } else {
        const bomId = await createDoc('requests_bom', {
          projectId: '',
          namaProject: namaProject.trim(),
          requestedBy: user.id,
          assignedAdmin,
          status: 'pending_fabrikasi',
          attachments: [],
          visibleTo: [assignedAdmin],
          notes,
        })
        if (fabrikasiUsers.length > 0) {
          await notifyBomRequest(fabrikasiUsers.map((u) => u.id), namaProject.trim(), bomId)
        }
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-5 pt-5 pb-3 shrink-0 border-b border-border">
          <h3 className="font-semibold">{initial ? 'Edit Request BOM' : 'Buat Request BOM'}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tim fabrikasi akan dinotifikasi untuk upload hasil BOM
          </p>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-3">

          <div>
            <label className="text-sm font-medium block mb-1">Nama Project / Pekerjaan <span className="text-red-500">*</span></label>
            <input
              value={namaProject}
              onChange={(e) => setNamaProject(e.target.value)}
              className={`w-full px-3 py-2 border ${err(submitted && !namaProject.trim())} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`}
              placeholder="Contoh: Mesin Destoner PT. Maju Bersama"
            />
            {submitted && !namaProject.trim() && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Admin Tujuan <span className="text-red-500">*</span></label>
            <select
              value={assignedAdmin}
              onChange={(e) => setAssignedAdmin(e.target.value)}
              className={`w-full px-3 py-2 border ${err(submitted && !assignedAdmin)} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`}
            >
              <option value="">— Pilih Admin —</option>
              {adminUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            {submitted && !assignedAdmin && <p className="text-xs text-red-500 mt-0.5">Wajib pilih admin</p>}
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Keterangan</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Spesifikasi atau keterangan untuk tim fabrikasi..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 shrink-0 border-t border-border flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {initial ? 'Simpan' : 'Kirim Request'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function BomRequestPage() {
  const { user } = useAuthStore()
  const [boms, setBoms] = useState<BomRequest[]>([])
  const [adminUsers, setAdminUsers] = useState<User[]>([])
  const [fabrikasiUsers, setFabrikasiUsers] = useState<User[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editBom, setEditBom] = useState<BomRequest | undefined>()
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<BomStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<BomRequest | null>(null)
  const [deleting, setDeleting] = useState(false)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const isSales = user?.role === 'sales'
  const isFabrikasi = user?.role === 'fabrikasi'
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  useEffect(() => {
    const unsubA = subscribeToCollection('users', [where('role', '==', 'admin')], (docs) => setAdminUsers(docs as unknown as User[]))
    const unsubF = subscribeToCollection('users', [where('role', '==', 'fabrikasi')], (docs) => setFabrikasiUsers(docs as unknown as User[]))
    const unsubB = subscribeToCollection('requests_bom', [], (docs) => setBoms(docs as unknown as BomRequest[]))
    return () => { unsubB(); unsubA(); unsubF() }
  }, [])

  // Fabrikasi upload hasil PDF → status: pending_admin, notifikasi admin
  const handleResultUpload = async (bom: BomRequest, file: File) => {
    setUploadingId(bom.id)
    try {
      const url = await uploadFile(buildPath.bom(bom.id, `hasil-${file.name}`), file)
      await updateDocument('requests_bom', bom.id, { resultUrl: url, status: 'pending_admin' })
      if (bom.assignedAdmin) {
        await notifyBomResultUploaded(bom.assignedAdmin, bom.namaProject ?? bom.projectId ?? '-', bom.id)
      }
    } finally {
      setUploadingId(null)
      if (fileInputRefs.current[bom.id]) fileInputRefs.current[bom.id]!.value = ''
    }
  }

  // Admin konfirmasi selesai → status: done, notifikasi sales
  const handleConfirmDone = async (bom: BomRequest) => {
    setConfirmingId(bom.id)
    try {
      await updateDocument('requests_bom', bom.id, { status: 'done' })
      await notifyBomDone(bom.requestedBy, bom.namaProject ?? bom.projectId ?? '-', bom.id)
    } finally {
      setConfirmingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDocument('requests_bom', deleteTarget.id)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const adminName = (id?: string) => adminUsers.find((u) => u.id === id)?.name ?? '-'

  // Nama proyek yang ditampilkan (custom text atau fallback ke projectId lama)
  const displayProject = (bom: BomRequest) => bom.namaProject || bom.projectId || '-'

  // Visibility per role
  const visibleBoms = boms.filter((bom) => {
    if (user?.role === 'super_admin') return true
    if (isSales) return bom.requestedBy === user?.id
    if (isFabrikasi) return bom.status === 'pending_fabrikasi' || bom.status === 'pending_admin'
    if (user?.role === 'admin') return bom.assignedAdmin === user?.id
    return true
  })

  const pendingFabrikasiCount = visibleBoms.filter((b) => b.status === 'pending_fabrikasi').length
  const pendingAdminCount = visibleBoms.filter((b) => b.status === 'pending_admin').length
  const doneCount = visibleBoms.filter((b) => b.status === 'done').length

  const filtered = visibleBoms.filter((bom) => {
    const q = search.toLowerCase()
    const matchSearch =
      (bom.namaProject ?? '').toLowerCase().includes(q) ||
      (bom.projectId ?? '').toLowerCase().includes(q) ||
      (bom.notes ?? '').toLowerCase().includes(q) ||
      adminName(bom.assignedAdmin).toLowerCase().includes(q)
    const matchStatus = filterStatus === 'all' || bom.status === filterStatus
    return matchSearch && matchStatus
  })
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Request BOM</h1>
          <p className="text-sm text-muted-foreground">
            Sales / Admin request → Fabrikasi upload PDF → Admin download &amp; konfirmasi
          </p>
        </div>
        {(isSales || isAdmin) && (
          <button
            onClick={() => { setEditBom(undefined); setShowForm(true) }}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Buat Request BOM
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Menunggu Fabrikasi', count: pendingFabrikasiCount, filter: 'pending_fabrikasi' as BomStatus, color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400' },
          { label: 'Menunggu Admin', count: pendingAdminCount, filter: 'pending_admin' as BomStatus, color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' },
          { label: 'Selesai', count: doneCount, filter: 'done' as BomStatus, color: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400' },
        ].map((c) => (
          <button
            key={c.label}
            onClick={() => { setFilterStatus(filterStatus === c.filter ? 'all' : c.filter); setPage(1) }}
            className={cn(
              'bg-card border rounded-xl p-4 text-left transition-all hover:shadow-md',
              filterStatus === c.filter ? 'border-primary ring-1 ring-primary/30' : 'border-border'
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={cn('p-1.5 rounded-lg', c.color)}>{STATUS_ICONS[c.filter]}</span>
              <span className="text-2xl font-bold">{c.count}</span>
            </div>
            <p className="text-sm font-medium">{c.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Cari nama project, admin, atau keterangan..."
            className="w-full pl-9 pr-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value as BomStatus | 'all'); setPage(1) }}
          className="px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Semua Status</option>
          <option value="pending_fabrikasi">Menunggu Fabrikasi</option>
          <option value="pending_admin">Menunggu Admin</option>
          <option value="done">Selesai</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground">Project / Pekerjaan</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Admin Tujuan</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Keterangan</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Hasil BOM (PDF)</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.map((bom) => {
                // Admin bersangkutan = assignedAdmin === user.id ATAU super_admin
                const isAssignedAdmin = user?.role === 'super_admin' || bom.assignedAdmin === user?.id

                return (
                  <tr key={bom.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3">
                      <p className="font-medium">{displayProject(bom)}</p>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{adminName(bom.assignedAdmin)}</td>
                    <td className="p-3 text-muted-foreground text-xs max-w-[180px]">
                      <span className="line-clamp-2">{bom.notes || '-'}</span>
                    </td>
                    <td className="p-3">
                      {/* Hanya Fabrikasi yang bisa upload, dan hanya saat pending_fabrikasi */}
                      {isFabrikasi && bom.status === 'pending_fabrikasi' ? (
                        <label className="flex items-center gap-1 text-xs text-primary border border-primary/30 px-2 py-1 rounded cursor-pointer hover:bg-primary/5 w-fit whitespace-nowrap">
                          {uploadingId === bom.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Upload className="h-3 w-3" />}
                          Upload PDF
                          <input
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            ref={(el) => { fileInputRefs.current[bom.id] = el }}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleResultUpload(bom, f) }}
                          />
                        </label>
                      ) : bom.resultUrl && isAssignedAdmin ? (
                        /* Download hanya untuk admin bersangkutan */
                        <a
                          href={bom.resultUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-green-600 hover:underline whitespace-nowrap"
                        >
                          <Download className="h-3 w-3" />Download PDF
                        </a>
                      ) : bom.resultUrl && isFabrikasi ? (
                        /* Fabrikasi lihat konfirmasi sudah upload */
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <FileText className="h-3 w-3" />Sudah diupload
                        </span>
                      ) : bom.resultUrl && isSales ? (
                        <span className="text-xs text-green-600">Hasil tersedia</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Belum diupload</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full flex items-center gap-1 w-fit whitespace-nowrap', STATUS_COLORS[bom.status])}>
                        {STATUS_ICONS[bom.status]}
                        {STATUS_LABELS[bom.status]}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {/* Tombol Selesai: admin bersangkutan saat pending_admin dan ada file */}
                        {isAssignedAdmin && bom.status === 'pending_admin' && bom.resultUrl && (
                          <button
                            onClick={() => handleConfirmDone(bom)}
                            disabled={confirmingId === bom.id}
                            className="flex items-center gap-1 text-xs text-green-600 border border-green-300 dark:border-green-700 px-2 py-1 rounded hover:bg-green-50 dark:hover:bg-green-950 whitespace-nowrap disabled:opacity-50"
                          >
                            {confirmingId === bom.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <CheckCircle2 className="h-3 w-3" />}
                            Selesai
                          </button>
                        )}
                        {/* Edit: admin & sales (pemilik request) saat belum done */}
                        {(isAdmin || (bom.status !== 'done' && isSales && bom.requestedBy === user?.id)) && (
                          <button
                            onClick={() => { setEditBom(bom); setShowForm(true) }}
                            className="p-1 text-muted-foreground hover:text-foreground"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {/* Hapus: admin kapan saja; fabrikasi & sales saat belum done */}
                        {(isAdmin || (bom.status !== 'done' && (isFabrikasi || (isSales && bom.requestedBy === user?.id)))) && (
                          <button
                            onClick={() => setDeleteTarget(bom)}
                            className="p-1 text-muted-foreground hover:text-destructive"
                            title="Hapus"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-muted-foreground text-sm">
                    {isSales ? 'Belum ada request BOM yang Anda buat' : 'Belum ada request BOM'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {showForm && (
        <RequestForm
          adminUsers={adminUsers}
          fabrikasiUsers={fabrikasiUsers}
          initial={editBom}
          onClose={() => { setShowForm(false); setEditBom(undefined) }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Hapus request BOM "${displayProject(deleteTarget)}"? Tindakan ini tidak dapat dibatalkan.`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
