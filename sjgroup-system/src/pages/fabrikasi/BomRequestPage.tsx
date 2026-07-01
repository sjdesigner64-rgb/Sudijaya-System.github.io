import { useEffect, useRef, useState } from 'react'
import { Plus, Upload, FileText, Loader2, Search, Trash2, Pencil, Download, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { BomRequest, BomStatus, Project, User } from '@/types'
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

// ─── Form Buat / Edit Request ─────────────────────────────────────────────────
function RequestForm({
  projects,
  adminUsers,
  fabrikasiUsers,
  onClose,
  initial,
}: {
  projects: Project[]
  adminUsers: User[]
  fabrikasiUsers: User[]
  onClose: () => void
  initial?: BomRequest
}) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [projectId, setProjectId] = useState(initial?.projectId ?? projects[0]?.id ?? '')
  const [assignedAdmin, setAssignedAdmin] = useState(initial?.assignedAdmin ?? adminUsers[0]?.id ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [file, setFile] = useState<File | null>(null)

  const handleSubmit = async () => {
    setSubmitted(true)
    if (!user) return
    if (!initial && (!projectId || !assignedAdmin)) return
    setSaving(true)
    try {
      if (initial) {
        await updateDocument('requests_bom', initial.id, { assignedAdmin, notes })
      } else {
        const selectedProject = projects.find((p) => p.id === projectId)
        if (!selectedProject) return
        const bomId = await createDoc('requests_bom', {
          projectId: selectedProject.id,
          requestedBy: user.id,
          assignedAdmin,
          status: 'pending_fabrikasi',
          attachments: [],
          visibleTo: [assignedAdmin],
          notes,
        })
        if (file) {
          const url = await uploadFile(buildPath.bom(bomId, file.name), file)
          await updateDocument('requests_bom', bomId, {
            attachments: [{ url, type: 'pdf', name: file.name }],
          })
        }
        // Notifikasi ke semua fabrikasi
        if (fabrikasiUsers.length > 0) {
          await notifyBomRequest(fabrikasiUsers.map((u) => u.id), selectedProject.name, bomId)
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
            {initial ? 'Ubah admin tujuan atau keterangan' : 'Tim fabrikasi akan dinotifikasi untuk memproses BOM'}
          </p>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-3">
          {!initial && (
            <div>
              <label className="text-sm font-medium block mb-1">Project <span className="text-red-500">*</span></label>
              {projects.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Belum ada project aktif</p>
              ) : (
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className={`w-full px-3 py-2 border ${submitted && !projectId ? 'border-red-400' : 'border-input'} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`}
                >
                  <option value="">— Pilih Project —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.customerName ? ` — ${p.customerName}` : ''}</option>
                  ))}
                </select>
              )}
              {submitted && !projectId && <p className="text-xs text-red-500 mt-0.5">Wajib pilih project</p>}
            </div>
          )}

          <div>
            <label className="text-sm font-medium block mb-1">Admin Tujuan <span className="text-red-500">*</span></label>
            <select
              value={assignedAdmin}
              onChange={(e) => setAssignedAdmin(e.target.value)}
              className={`w-full px-3 py-2 border ${submitted && !assignedAdmin ? 'border-red-400' : 'border-input'} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`}
            >
              <option value="">— Pilih Admin —</option>
              {adminUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            {submitted && !assignedAdmin && <p className="text-xs text-red-500 mt-0.5">Wajib pilih admin</p>}
          </div>

          {!initial && (
            <div>
              <label className="text-sm font-medium block mb-1">Upload Spesifikasi (PDF)</label>
              <label className="flex items-center justify-center w-full h-12 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors text-sm text-muted-foreground gap-2">
                <Upload className="h-4 w-4" />
                {file ? file.name : 'Pilih file PDF (opsional)'}
                <input type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          )}

          <div>
            <label className="text-sm font-medium block mb-1">Keterangan</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Spesifikasi atau keterangan tambahan untuk tim fabrikasi..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 shrink-0 border-t border-border flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button
            onClick={handleSubmit}
            disabled={saving || (!initial && projects.length === 0)}
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
  const [projects, setProjects] = useState<Project[]>([])
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
    const unsubP = subscribeToCollection('projects', [], (docs) => setProjects(docs as unknown as Project[]))
    const unsubA = subscribeToCollection('users', [where('role', '==', 'admin')], (docs) => setAdminUsers(docs as unknown as User[]))
    const unsubF = subscribeToCollection('users', [where('role', '==', 'fabrikasi')], (docs) => setFabrikasiUsers(docs as unknown as User[]))
    const unsubB = subscribeToCollection('requests_bom', [], (docs) => setBoms(docs as unknown as BomRequest[]))
    return () => { unsubB(); unsubP(); unsubA(); unsubF() }
  }, [])

  // Fabrikasi upload hasil → status: pending_admin, notifikasi admin
  const handleResultUpload = async (bom: BomRequest, file: File) => {
    setUploadingId(bom.id)
    try {
      const url = await uploadFile(buildPath.bom(bom.id, `hasil-${file.name}`), file)
      await updateDocument('requests_bom', bom.id, { resultUrl: url, status: 'pending_admin' })
      const project = projects.find((p) => p.id === bom.projectId)
      if (bom.assignedAdmin) {
        await notifyBomResultUploaded(bom.assignedAdmin, project?.name ?? '-', bom.id)
      }
    } finally {
      setUploadingId(null)
    }
  }

  // Admin konfirmasi selesai → status: done, notifikasi sales
  const handleConfirmDone = async (bom: BomRequest) => {
    setConfirmingId(bom.id)
    try {
      await updateDocument('requests_bom', bom.id, { status: 'done' })
      const project = projects.find((p) => p.id === bom.projectId)
      await notifyBomDone(bom.requestedBy, project?.name ?? '-', bom.id)
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

  const projectLabel = (id: string) => {
    const p = projects.find((pr) => pr.id === id)
    return p ? `${p.name}${p.customerName ? ` — ${p.customerName}` : ''}` : id
  }
  const adminName = (id?: string) => adminUsers.find((u) => u.id === id)?.name ?? '-'

  // Visibility per role
  // super_admin → semua
  // admin → yang assignedAdmin === user.id
  // fabrikasi → semua pending_fabrikasi dan pending_admin
  // sales → yang requestedBy === user.id
  const visibleBoms = boms.filter((bom) => {
    if (user?.role === 'super_admin') return true
    if (isSales) return bom.requestedBy === user?.id
    if (isFabrikasi) return bom.status === 'pending_fabrikasi' || bom.status === 'pending_admin'
    if (user?.role === 'admin') return bom.assignedAdmin === user?.id
    return true
  })

  const pendingFabrikasi = visibleBoms.filter((b) => b.status === 'pending_fabrikasi').length
  const pendingAdmin = visibleBoms.filter((b) => b.status === 'pending_admin').length

  const filtered = visibleBoms.filter((bom) => {
    const p = projects.find((pr) => pr.id === bom.projectId)
    const q = search.toLowerCase()
    const matchSearch = (p?.name ?? '').toLowerCase().includes(q) || (p?.customerName ?? '').toLowerCase().includes(q) || (bom.notes ?? '').toLowerCase().includes(q)
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
            Sales request → Fabrikasi upload hasil → Admin konfirmasi selesai
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

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Menunggu Fabrikasi', count: pendingFabrikasi, color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400', filter: 'pending_fabrikasi' as BomStatus },
          { label: 'Menunggu Admin', count: pendingAdmin, color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400', filter: 'pending_admin' as BomStatus },
          { label: 'Selesai', count: visibleBoms.filter((b) => b.status === 'done').length, color: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400', filter: 'done' as BomStatus },
        ].map((c) => (
          <button
            key={c.label}
            onClick={() => { setFilterStatus(filterStatus === c.filter ? 'all' : c.filter); setPage(1) }}
            className={cn(
              'bg-card border rounded-xl p-4 text-left transition-all hover:shadow-md cursor-pointer',
              filterStatus === c.filter ? 'border-primary ring-1 ring-primary/30' : 'border-border'
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={cn('p-1.5 rounded-lg', c.color)}>
                {STATUS_ICONS[c.filter]}
              </span>
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
            placeholder="Cari nama project, customer, atau keterangan..."
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
                <th className="text-left p-3 font-medium text-muted-foreground">Project</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Admin Tujuan</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Keterangan</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Spesifikasi</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Hasil BOM</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.map((bom) => {
                const proj = projects.find((p) => p.id === bom.projectId)
                return (
                  <tr key={bom.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3">
                      <p className="font-medium">{proj?.name ?? bom.projectId}</p>
                      {proj?.customerName && <p className="text-xs text-muted-foreground">{proj.customerName}</p>}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">{adminName(bom.assignedAdmin)}</td>
                    <td className="p-3 text-muted-foreground text-xs max-w-[150px]">
                      <span className="line-clamp-2">{bom.notes || '-'}</span>
                    </td>
                    <td className="p-3">
                      {bom.attachments?.length > 0 ? (
                        bom.attachments.map((att) => (
                          <a key={att.name} href={att.url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-primary hover:underline whitespace-nowrap">
                            <FileText className="h-3 w-3" />{att.name}
                          </a>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-3">
                      {/* Fabrikasi: upload hasil (hanya saat pending_fabrikasi) */}
                      {isFabrikasi && bom.status === 'pending_fabrikasi' ? (
                        <label className="flex items-center gap-1 text-xs text-primary border border-primary/30 px-2 py-1 rounded cursor-pointer hover:bg-primary/5 w-fit whitespace-nowrap">
                          {uploadingId === bom.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Upload className="h-3 w-3" />}
                          Upload Hasil
                          <input
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            ref={(el) => { fileInputRefs.current[bom.id] = el }}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleResultUpload(bom, f) }}
                          />
                        </label>
                      ) : bom.resultUrl ? (
                        /* Admin & super_admin & fabrikasi (setelah upload): download */
                        !isSales ? (
                          <a href={bom.resultUrl} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-green-600 hover:underline whitespace-nowrap">
                            <Download className="h-3 w-3" />Download Hasil
                          </a>
                        ) : (
                          /* Sales: hanya info */
                          <span className="text-xs text-green-600">Hasil tersedia</span>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">Belum ada</span>
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
                        {/* Admin: konfirmasi selesai saat pending_admin */}
                        {(user?.role === 'admin' || user?.role === 'super_admin') && bom.status === 'pending_admin' && bom.resultUrl && (
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
                        {/* Edit: admin/super_admin kapan saja; sales & fabrikasi saat belum done */}
                        {(isAdmin || (bom.status !== 'done' && (isFabrikasi || (isSales && bom.requestedBy === user?.id)))) && (
                          <button
                            onClick={() => { setEditBom(bom); setShowForm(true) }}
                            className="p-1 text-muted-foreground hover:text-foreground"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {/* Hapus: admin/super_admin kapan saja; fabrikasi & sales */}
                        {(isAdmin || isFabrikasi || (isSales && bom.requestedBy === user?.id)) && (
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
                  <td colSpan={7} className="p-10 text-center text-muted-foreground text-sm">
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
          projects={projects}
          adminUsers={adminUsers}
          fabrikasiUsers={fabrikasiUsers}
          initial={editBom}
          onClose={() => { setShowForm(false); setEditBom(undefined) }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Hapus request BOM untuk project "${projectLabel(deleteTarget.projectId)}"? Tindakan ini tidak dapat dibatalkan.`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
