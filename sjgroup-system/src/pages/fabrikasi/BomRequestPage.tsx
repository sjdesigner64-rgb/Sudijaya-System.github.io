import { useEffect, useRef, useState } from 'react'
import { Plus, Upload, FileText, Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { BomRequest, BomStatus, Project } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { createDoc, updateDocument, subscribeToCollection } from '@/services/firestore.service'
import { uploadFile, buildPath } from '@/services/storage.service'

const STATUS_LABELS: Record<BomStatus, string> = {
  pending_admin: 'Pending Admin',
  pending_fabrikasi: 'Diproses Fabrikasi',
  done: 'Selesai',
}
const STATUS_COLORS: Record<BomStatus, string> = {
  pending_admin: 'bg-amber-100 dark:bg-amber-900 text-amber-700',
  pending_fabrikasi: 'bg-blue-100 dark:bg-blue-900 text-blue-700',
  done: 'bg-green-100 dark:bg-green-900 text-green-700',
}

function RequestForm({ projects, onClose }: { projects: Project[]; onClose: () => void }) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const selectedProject = projects.find((p) => p.id === projectId)

  const handleSubmit = async () => {
    if (!selectedProject || !user) return
    setSaving(true)
    try {
      const bomId = await createDoc('requests_bom', {
        projectId: selectedProject.id,
        requestedBy: user.id,
        status: 'pending_admin',
        attachments: [],
        visibleTo: ['admin'],
        notes,
      })
      if (file) {
        const url = await uploadFile(buildPath.bom(bomId, file.name), file)
        await updateDocument('requests_bom', bomId, { attachments: [{ url, type: 'pdf', name: file.name }] })
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5">
        <h3 className="font-semibold mb-4">Buat Request BOM</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Project</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.customerName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Upload Spesifikasi (PDF)</label>
            <label className="flex items-center justify-center w-full h-16 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors text-sm text-muted-foreground gap-2">
              <Upload className="h-4 w-4" /> {file ? file.name : 'Pilih file PDF'}
              <input type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Keterangan</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none h-16" />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button onClick={handleSubmit} disabled={saving || !selectedProject} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Kirim ke Admin
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
  const [showForm, setShowForm] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isSales = user?.role === 'sales'
  const isFabrikasi = user?.role === 'fabrikasi'
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  useEffect(() => {
    const unsubP = subscribeToCollection('projects', [], (docs) => {
      setProjects(docs as unknown as Project[])
    })
    if (isSales) return unsubP

    const unsubB = subscribeToCollection('requests_bom', [], (docs) => {
      setBoms(docs as unknown as BomRequest[])
    })
    return () => { unsubB(); unsubP() }
  }, [isSales])

  const forwardToFabrikasi = async (bomId: string) => {
    await updateDocument('requests_bom', bomId, { status: 'pending_fabrikasi' })
  }

  const handleResultUpload = async (bomId: string, file: File) => {
    setUploadingId(bomId)
    try {
      const url = await uploadFile(buildPath.bom(bomId, `hasil-${file.name}`), file)
      await updateDocument('requests_bom', bomId, { resultUrl: url, status: 'done' })
    } finally {
      setUploadingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Request BOM</h1>
          <p className="text-sm text-muted-foreground">Bill of Materials — alur: Sales → Admin → Fabrikasi → Admin</p>
        </div>
        {isSales && (
          <button
            onClick={() => setShowForm(true)}
            disabled={projects.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Buat Request BOM
          </button>
        )}
      </div>

      {/* Flow info */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        {['Sales', 'Admin', 'Fabrikasi', 'Admin (hasil)'].map((step, i, arr) => (
          <div key={step} className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-secondary rounded">{step}</span>
            {i < arr.length - 1 && <span>→</span>}
          </div>
        ))}
      </div>

      {isSales ? (
        <div className="py-12 text-center text-muted-foreground text-sm bg-card border border-border rounded-xl">
          Sesuai alur BOM, Sales tidak dapat melihat daftar request BOM — hanya dapat membuat request baru.
        </div>
      ) : (
        <div className="space-y-3">
          {boms.map((bom) => {
            const project = projects.find((p) => p.id === bom.projectId)
            return (
              <div key={bom.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-sm">{project?.name ?? bom.projectId}</p>
                    <p className="text-xs text-muted-foreground">Project: {project?.customerName}</p>
                  </div>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', STATUS_COLORS[bom.status])}>
                    {STATUS_LABELS[bom.status]}
                  </span>
                </div>
                {bom.notes && <p className="text-xs text-muted-foreground mb-2">{bom.notes}</p>}
                <div className="flex flex-wrap gap-2 items-center">
                  {bom.attachments.map((att) => (
                    <a key={att.name} href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <FileText className="h-3 w-3" />{att.name}
                    </a>
                  ))}
                  {bom.resultUrl && (
                    <a href={bom.resultUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-green-600 hover:underline">
                      <FileText className="h-3 w-3" />Hasil BOM
                    </a>
                  )}
                  {isAdmin && bom.status === 'pending_admin' && (
                    <button onClick={() => forwardToFabrikasi(bom.id)} className="flex items-center gap-1 text-xs text-primary border border-primary/30 px-2 py-0.5 rounded hover:bg-primary/5">
                      Forward ke Fabrikasi
                    </button>
                  )}
                  {isFabrikasi && bom.status === 'pending_fabrikasi' && (
                    <label className="flex items-center gap-1 text-xs text-primary border border-primary/30 px-2 py-0.5 rounded hover:bg-primary/5 cursor-pointer">
                      {uploadingId === bom.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                      Upload Hasil BOM
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) handleResultUpload(bom.id, f)
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            )
          })}
          {boms.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm bg-card border border-border rounded-xl">
              Belum ada request BOM
            </div>
          )}
        </div>
      )}

      {showForm && <RequestForm projects={projects} onClose={() => setShowForm(false)} />}
    </div>
  )
}
