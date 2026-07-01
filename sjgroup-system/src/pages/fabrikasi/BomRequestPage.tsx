import { useEffect, useRef, useState } from 'react'
import { Plus, Upload, FileText, Loader2, Search, Trash2, Pencil, Download } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { BomRequest, BomStatus, Project, User } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { createDoc, updateDocument, deleteDocument, subscribeToCollection, where } from '@/services/firestore.service'
import { uploadFile, buildPath } from '@/services/storage.service'
import { Pagination } from '@/components/common/Pagination'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

const PAGE_SIZE = 10

const STATUS_LABELS: Record<BomStatus, string> = {
  pending_fabrikasi: 'Menunggu Fabrikasi',
  pending_admin: 'Menunggu Fabrikasi',
  done: 'Selesai',
}
const STATUS_COLORS: Record<BomStatus, string> = {
  pending_fabrikasi: 'bg-amber-100 dark:bg-amber-900 text-amber-700',
  pending_admin: 'bg-amber-100 dark:bg-amber-900 text-amber-700',
  done: 'bg-green-100 dark:bg-green-900 text-green-700',
}

function RequestForm({
  projects,
  adminUsers,
  onClose,
  initial,
}: {
  projects: Project[]
  adminUsers: User[]
  onClose: () => void
  initial?: BomRequest
}) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [projectId, setProjectId] = useState(initial?.projectId ?? projects[0]?.id ?? '')
  const [assignedAdmin, setAssignedAdmin] = useState(initial?.assignedAdmin ?? adminUsers[0]?.id ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [file, setFile] = useState<File | null>(null)

  const handleSubmit = async () => {
    if (!user) return
    setSaving(true)
    try {
      if (initial) {
        await updateDocument('requests_bom', initial.id, {
          assignedAdmin,
          notes,
        })
      } else {
        const selectedProject = projects.find((p) => p.id === projectId)
        if (!selectedProject || !assignedAdmin) return
        const bomId = await createDoc('requests_bom', {
          projectId: selectedProject.id,
          requestedBy: user.id,
          assignedAdmin,
          status: 'pending_fabrikasi',
          attachments: [],
          visibleTo: ['fabrikasi', assignedAdmin],
          notes,
        })
        if (file) {
          const url = await uploadFile(buildPath.bom(bomId, file.name), file)
          await updateDocument('requests_bom', bomId, { attachments: [{ url, type: 'pdf', name: file.name }] })
        }
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5">
        <h3 className="font-semibold mb-4">{initial ? 'Edit Request BOM' : 'Buat Request BOM'}</h3>
        <div className="space-y-3">
          {!initial && (
            <div>
              <label className="text-sm font-medium block mb-1">Project</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — {p.customerName}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-sm font-medium block mb-1">Tujuan Admin</label>
            <select
              value={assignedAdmin}
              onChange={(e) => setAssignedAdmin(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {adminUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          {!initial && (
            <div>
              <label className="text-sm font-medium block mb-1">Upload Spesifikasi (PDF)</label>
              <label className="flex items-center justify-center w-full h-16 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors text-sm text-muted-foreground gap-2">
                <Upload className="h-4 w-4" /> {file ? file.name : 'Pilih file PDF'}
                <input type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          )}
          <div>
            <label className="text-sm font-medium block mb-1">Keterangan</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none h-16"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button
            onClick={handleSubmit}
            disabled={saving || (!initial && (!projects.find((p) => p.id === projectId) || !assignedAdmin))}
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

export function BomRequestPage() {
  const { user } = useAuthStore()
  const [boms, setBoms] = useState<BomRequest[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [adminUsers, setAdminUsers] = useState<User[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editBom, setEditBom] = useState<BomRequest | undefined>()
  const [uploadingId, setUploadingId] = useState<string | null>(null)
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
    const unsubB = subscribeToCollection('requests_bom', [], (docs) => setBoms(docs as unknown as BomRequest[]))
    return () => { unsubB(); unsubP(); unsubA() }
  }, [])

  // Fabrikasi uploads hasil BOM → status: done
  const handleResultUpload = async (bomId: string, file: File) => {
    setUploadingId(bomId)
    try {
      const url = await uploadFile(buildPath.bom(bomId, `hasil-${file.name}`), file)
      await updateDocument('requests_bom', bomId, { resultUrl: url, status: 'done' })
    } finally {
      setUploadingId(null)
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

  const projectName = (id: string) => {
    const p = projects.find((p) => p.id === id)
    return p ? `${p.name}${p.customerName ? ` — ${p.customerName}` : ''}` : id
  }
  const adminName = (id?: string) => adminUsers.find((u) => u.id === id)?.name ?? '-'

  const visibleBoms = boms.filter((bom) => {
    if (isSales) return bom.requestedBy === user?.id
    if (isFabrikasi) return bom.status === 'pending_fabrikasi' || bom.status === 'pending_admin'
    if (isAdmin) return bom.assignedAdmin === user?.id
    return true
  })

  const filtered = visibleBoms.filter((bom) => {
    const p = projects.find((pr) => pr.id === bom.projectId)
    const q = search.toLowerCase()
    const matchSearch = (p?.name ?? '').toLowerCase().includes(q) || (p?.customerName ?? '').toLowerCase().includes(q)
    const matchStatus = filterStatus === 'all' || bom.status === filterStatus
    return matchSearch && matchStatus
  })
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const canEdit = (bom: BomRequest) => {
    if (isAdmin) return true
    if (isFabrikasi) return bom.status !== 'done'
    if (isSales) return bom.requestedBy === user?.id && bom.status !== 'done'
    return false
  }
  const canDelete = (bom: BomRequest) => {
    if (isAdmin) return true
    if (isFabrikasi) return true
    if (isSales) return bom.requestedBy === user?.id
    return false
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Request BOM</h1>
          <p className="text-sm text-muted-foreground">Bill of Materials — Sales request → Fabrikasi upload hasil → Admin download</p>
        </div>
        {isSales && (
          <button
            onClick={() => { setEditBom(undefined); setShowForm(true) }}
            disabled={projects.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Buat Request BOM
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Cari nama project atau customer..."
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
              {paginated.map((bom) => (
                <tr key={bom.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3">
                    <p className="font-medium">{projects.find((p) => p.id === bom.projectId)?.name ?? bom.projectId}</p>
                    <p className="text-xs text-muted-foreground">{projects.find((p) => p.id === bom.projectId)?.customerName ?? ''}</p>
                  </td>
                  <td className="p-3 text-muted-foreground text-xs">{adminName(bom.assignedAdmin)}</td>
                  <td className="p-3 text-muted-foreground text-xs max-w-[150px] truncate">{bom.notes || '-'}</td>
                  <td className="p-3">
                    {bom.attachments.length > 0 ? (
                      bom.attachments.map((att) => (
                        <a
                          key={att.name}
                          href={att.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <FileText className="h-3 w-3" />{att.name}
                        </a>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="p-3">
                    {bom.resultUrl && !isSales ? (
                      <a
                        href={bom.resultUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-green-600 hover:underline"
                      >
                        <Download className="h-3 w-3" />Download Hasil
                      </a>
                    ) : isFabrikasi && bom.status !== 'done' ? (
                      <label className="flex items-center gap-1 text-xs text-primary border border-primary/30 px-2 py-1 rounded cursor-pointer hover:bg-primary/5 w-fit">
                        {uploadingId === bom.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Upload className="h-3 w-3" />
                        )}
                        Upload Hasil
                        <input
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          ref={(el) => { fileInputRefs.current[bom.id] = el }}
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) handleResultUpload(bom.id, f)
                          }}
                        />
                      </label>
                    ) : bom.resultUrl && isSales ? (
                      <span className="text-xs text-green-600">Hasil tersedia</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Belum ada</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', STATUS_COLORS[bom.status])}>
                      {STATUS_LABELS[bom.status]}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {canEdit(bom) && (
                        <button
                          onClick={() => { setEditBom(bom); setShowForm(true) }}
                          className="p-1 text-muted-foreground hover:text-foreground"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDelete(bom) && (
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
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-muted-foreground">
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
          initial={editBom}
          onClose={() => { setShowForm(false); setEditBom(undefined) }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Hapus request BOM untuk project "${projectName(deleteTarget.projectId)}"? Tindakan ini tidak dapat dibatalkan.`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
