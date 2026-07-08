import React, { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Loader2, Search, FileText, Upload, ExternalLink, Clock, Truck, CheckCircle2, AlertTriangle, Pencil, CalendarDays } from 'lucide-react'
import { cn } from '@/utils/cn'
import { toDate } from '@/utils/firestore'
import type { Shipment, ShipmentStatus, ItemCondition, Project, User, Lead } from '@/types'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { useAuthStore } from '@/store/authStore'
import { createDoc, updateDocument, deleteDocument, subscribeToCollection, getDocuments, where } from '@/services/firestore.service'
import { uploadFile, buildPath } from '@/services/storage.service'
import { Pagination } from '@/components/common/Pagination'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { notifyPengirimSalesSelesai } from '@/services/notification.service'

const PAGE_SIZE = 10

const STATUS_LABELS: Record<ShipmentStatus, string> = { pending: 'Pending', proses: 'Proses', selesai: 'Selesai' }
const STATUS_COLORS: Record<ShipmentStatus, string> = {
  pending: 'bg-gray-100 dark:bg-gray-800 text-gray-600',
  proses: 'bg-blue-100 dark:bg-blue-900 text-blue-700',
  selesai: 'bg-green-100 dark:bg-green-900 text-green-700',
}
const CONDITION_LABELS: Record<ItemCondition, string> = {
  baru: 'Baru', bekas: 'Bekas', servis: 'Servis', retur: 'Retur',
}
const CONDITION_COLORS: Record<ItemCondition, string> = {
  baru: 'bg-green-100 dark:bg-green-900 text-green-700',
  bekas: 'bg-amber-100 dark:bg-amber-900 text-amber-700',
  servis: 'bg-blue-100 dark:bg-blue-900 text-blue-700',
  retur: 'bg-red-100 dark:bg-red-900 text-red-700',
}
const err = (invalid: boolean) => invalid ? 'border-red-400 dark:border-red-600' : 'border-input'

// ─── PDF Field ─────────────────────────────────────────────────────────────────
function PdfField({ label, currentUrl, file, onFileChange }: {
  label: React.ReactNode; currentUrl?: string; file: File | null; onFileChange: (f: File | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div>
      <label className="text-sm font-medium block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        {currentUrl ? (
          <a href={currentUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-primary hover:underline border border-border rounded-md px-2 py-1.5 bg-background flex-1">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{currentUrl.split('/').pop()}</span>
            <ExternalLink className="h-3 w-3 shrink-0 ml-auto" />
          </a>
        ) : (
          <span className="text-xs text-muted-foreground border border-dashed border-border rounded-md px-2 py-1.5 flex-1">
            {file ? file.name : 'Belum ada file'}
          </span>
        )}
        <button type="button" onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border rounded-md text-xs hover:bg-accent whitespace-nowrap shrink-0">
          <Upload className="h-3.5 w-3.5" />
          {currentUrl ? 'Ganti PDF' : 'Pilih PDF'}
        </button>
        <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)} />
      </div>
      {file && <p className="text-xs text-primary mt-1">Dipilih: {file.name} — akan diupload saat simpan</p>}
    </div>
  )
}

// ─── Surat Jalan Cell (inline upload di tabel) ─────────────────────────────────
function SuratJalanCell({ shipment }: { shipment: Shipment }) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const url = await uploadFile(buildPath.shipment(shipment.id, `surat-jalan-${Date.now()}.pdf`), file)
      await updateDocument('shipments', shipment.id, { suratJalanUrl: url })
    } finally { setUploading(false) }
  }
  if (shipment.suratJalanUrl) {
    return (
      <a href={shipment.suratJalanUrl} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
        <FileText className="h-3 w-3" /> Lihat
      </a>
    )
  }
  return (
    <label className={cn('inline-flex items-center gap-1 text-xs cursor-pointer',
      uploading ? 'text-muted-foreground' : 'text-primary hover:underline')}>
      {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
      {uploading ? 'Upload...' : 'Upload'}
      <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
    </label>
  )
}

// ─── Form Admin: Project Sales ─────────────────────────────────────────────────
// Admin hanya input: nama project, jadwal, PIC pengiriman, upload surat jalan, upload alamat
function SalesShipmentForm({ projects, picUsers, initial, adminIds, onClose }: {
  projects: Project[]; picUsers: User[]; initial?: Shipment; adminIds: string[]; onClose: () => void
}) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [projectId, setProjectId] = useState(initial?.projectId ?? '')
  const [jadwal, setJadwal] = useState(
    initial?.jadwalPengiriman
      ? format(toDate(initial.jadwalPengiriman as never) ?? new Date(), 'yyyy-MM-dd')
      : ''
  )
  const [picPengiriman, setPicPengiriman] = useState(initial?.picPengiriman ?? '')
  const [addressPdfFile, setAddressPdfFile] = useState<File | null>(null)
  const [suratJalanFile, setSuratJalanFile] = useState<File | null>(null)

  useEffect(() => {
    if (!picPengiriman && picUsers.length > 0) setPicPengiriman(picUsers[0].id)
  }, [picUsers])

  const selectedProject = projects.find((p) => p.id === projectId)

  const handleSave = async () => {
    setSubmitted(true)
    if (!projectId || !jadwal || !picPengiriman || !user) return
    if (!initial && !addressPdfFile) return
    setSaving(true)
    try {
      const base = {
        projectId: selectedProject?.id ?? projectId,
        projectName: selectedProject?.name ?? '',
        leadId: null,
        picSalesId: selectedProject?.salesPic ?? '',
        jadwalPengiriman: new Date(jadwal),
        picPengiriman,
        // Fabrikasi akan isi dimensi/berat/catatan
        weight: initial?.weight ?? 0,
        dimensions: initial?.dimensions ?? { length: 0, width: 0, height: 0, unit: 'cm' },
        condition: initial?.condition ?? 'baru',
        packingNotes: initial?.packingNotes ?? '',
        status: initial?.status ?? 'pending',
      }
      let docId = initial?.id ?? ''
      if (initial) {
        await updateDocument('shipments', initial.id, base)
      } else {
        docId = await createDoc('shipments', { ...base, createdBy: user.id })
      }
      const pdfUpdates: Record<string, string> = {}
      if (addressPdfFile)
        pdfUpdates.addressPdfUrl = await uploadFile(buildPath.shipment(docId, `alamat-${Date.now()}.pdf`), addressPdfFile)
      if (suratJalanFile)
        pdfUpdates.suratJalanUrl = await uploadFile(buildPath.shipment(docId, `surat-jalan-${Date.now()}.pdf`), suratJalanFile)
      if (Object.keys(pdfUpdates).length > 0) await updateDocument('shipments', docId, pdfUpdates)
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="px-5 pt-5 pb-3 shrink-0 border-b border-border">
          <h3 className="font-semibold">{initial ? 'Edit Jadwal — Project Sales' : 'Tambah Pengiriman — Project Sales'}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Jadwal & logistik diisi admin. Dimensi & berat diisi fabrikasi.</p>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Nama Project <span className="text-red-500">*</span></label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
              className={`w-full px-3 py-2 border ${err(submitted && !projectId)} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`}>
              <option value="">— Pilih Project —</option>
              {projects.map((p) => (<option key={p.id} value={p.id}>{p.name} — {p.customerName}</option>))}
            </select>
            {submitted && !projectId && <p className="text-xs text-red-500 mt-0.5">Wajib pilih project</p>}
          </div>
          <div>
            <label className="text-sm font-medium block mb-1 flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" /> Jadwal Pengiriman <span className="text-red-500">*</span>
            </label>
            <input type="date" value={jadwal} onChange={(e) => setJadwal(e.target.value)}
              className={`w-full px-3 py-2 border ${err(submitted && !jadwal)} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`} />
            {submitted && !jadwal && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">PIC Pengiriman (Fabrikasi) <span className="text-red-500">*</span></label>
            <select value={picPengiriman} onChange={(e) => setPicPengiriman(e.target.value)}
              className={`w-full px-3 py-2 border ${err(submitted && !picPengiriman)} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`}>
              <option value="">— Pilih PIC —</option>
              {picUsers.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
            </select>
            {submitted && !picPengiriman && <p className="text-xs text-red-500 mt-0.5">Wajib pilih PIC</p>}
          </div>
          <div>
            <PdfField
              label={<>PDF Alamat Pengiriman {!initial && <span className="text-red-500">*</span>}</>}
              currentUrl={initial?.addressPdfUrl} file={addressPdfFile} onFileChange={setAddressPdfFile}
            />
            {submitted && !initial && !addressPdfFile && <p className="text-xs text-red-500 mt-0.5">PDF Alamat wajib diunggah</p>}
          </div>
          <PdfField label="Surat Jalan (PDF)" currentUrl={initial?.suratJalanUrl} file={suratJalanFile} onFileChange={setSuratJalanFile} />
        </div>
        <div className="px-5 pb-5 pt-3 shrink-0 border-t border-border flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Simpan
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Form Admin: Project Satuan ────────────────────────────────────────────────
function SatuanShipmentForm({ leads, picUsers, initial, onClose }: {
  leads: Lead[]; picUsers: User[]; initial?: Shipment; onClose: () => void
}) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [leadId, setLeadId] = useState(initial?.leadId ?? '')
  const [jadwal, setJadwal] = useState(
    initial?.jadwalPengiriman
      ? format(toDate(initial.jadwalPengiriman as never) ?? new Date(), 'yyyy-MM-dd')
      : ''
  )
  const [picPengiriman, setPicPengiriman] = useState(initial?.picPengiriman ?? '')
  const [addressPdfFile, setAddressPdfFile] = useState<File | null>(null)
  const [suratJalanFile, setSuratJalanFile] = useState<File | null>(null)

  useEffect(() => {
    if (!picPengiriman && picUsers.length > 0) setPicPengiriman(picUsers[0].id)
  }, [picUsers])
  useEffect(() => {
    if (!leadId && leads.length > 0) setLeadId(leads[0].id)
  }, [leads])

  const selectedLead = leads.find((l) => l.id === leadId)

  const handleSave = async () => {
    setSubmitted(true)
    if (!leadId || !jadwal || !picPengiriman || !user) return
    if (!initial && !addressPdfFile) return
    setSaving(true)
    try {
      const base = {
        projectId: leadId,
        projectName: selectedLead ? `${selectedLead.customerName} — ${selectedLead.productName}` : '',
        leadId,
        picSalesId: selectedLead?.assignedSales ?? '',
        jadwalPengiriman: new Date(jadwal),
        picPengiriman,
        weight: initial?.weight ?? 0,
        dimensions: initial?.dimensions ?? { length: 0, width: 0, height: 0, unit: 'cm' },
        condition: initial?.condition ?? 'baru',
        packingNotes: initial?.packingNotes ?? '',
        status: initial?.status ?? 'pending',
      }
      let docId = initial?.id ?? ''
      if (initial) {
        await updateDocument('shipments', initial.id, base)
      } else {
        docId = await createDoc('shipments', { ...base, createdBy: user.id })
        await updateDocument('leads', leadId, { pengiriman: 'proses' })
      }
      const pdfUpdates: Record<string, string> = {}
      if (addressPdfFile)
        pdfUpdates.addressPdfUrl = await uploadFile(buildPath.shipment(docId, `alamat-${Date.now()}.pdf`), addressPdfFile)
      if (suratJalanFile)
        pdfUpdates.suratJalanUrl = await uploadFile(buildPath.shipment(docId, `surat-jalan-${Date.now()}.pdf`), suratJalanFile)
      if (Object.keys(pdfUpdates).length > 0) await updateDocument('shipments', docId, pdfUpdates)
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="px-5 pt-5 pb-3 shrink-0 border-b border-border">
          <h3 className="font-semibold">{initial ? 'Edit Jadwal — Project Satuan' : 'Tambah Pengiriman — Project Satuan'}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Jadwal & logistik diisi admin. Dimensi & berat diisi fabrikasi.</p>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Project Satuan <span className="text-red-500">*</span></label>
            <select value={leadId} onChange={(e) => setLeadId(e.target.value)}
              className={`w-full px-3 py-2 border ${err(submitted && !leadId)} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`}>
              <option value="">— Pilih Project Satuan —</option>
              {leads.map((l) => (<option key={l.id} value={l.id}>{l.customerName} — {l.productName}</option>))}
            </select>
            {submitted && !leadId && <p className="text-xs text-red-500 mt-0.5">Wajib pilih project satuan</p>}
            {selectedLead && (
              <p className="text-xs text-muted-foreground mt-1">
                Pembayaran: {selectedLead.dpPelunasan === 'sudah_lunas' ? '✓ Sudah Lunas' : selectedLead.dpPelunasan === 'sudah_dp' ? 'Sudah DP' : 'Belum DP'}
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium block mb-1 flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" /> Jadwal Pengiriman <span className="text-red-500">*</span>
            </label>
            <input type="date" value={jadwal} onChange={(e) => setJadwal(e.target.value)}
              className={`w-full px-3 py-2 border ${err(submitted && !jadwal)} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`} />
            {submitted && !jadwal && <p className="text-xs text-red-500 mt-0.5">Wajib diisi</p>}
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">PIC Pengiriman (Fabrikasi) <span className="text-red-500">*</span></label>
            <select value={picPengiriman} onChange={(e) => setPicPengiriman(e.target.value)}
              className={`w-full px-3 py-2 border ${err(submitted && !picPengiriman)} rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring`}>
              <option value="">— Pilih PIC —</option>
              {picUsers.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
            </select>
            {submitted && !picPengiriman && <p className="text-xs text-red-500 mt-0.5">Wajib pilih PIC</p>}
          </div>
          <div>
            <PdfField
              label={<>PDF Alamat Pengiriman {!initial && <span className="text-red-500">*</span>}</>}
              currentUrl={initial?.addressPdfUrl} file={addressPdfFile} onFileChange={setAddressPdfFile}
            />
            {submitted && !initial && !addressPdfFile && <p className="text-xs text-red-500 mt-0.5">PDF Alamat wajib diunggah</p>}
          </div>
          <PdfField label="Surat Jalan (PDF)" currentUrl={initial?.suratJalanUrl} file={suratJalanFile} onFileChange={setSuratJalanFile} />
        </div>
        <div className="px-5 pb-5 pt-3 shrink-0 border-t border-border flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Simpan
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Form Fabrikasi: Update dimensi, berat, catatan, kondisi, status ───────────
function FabrikasiShipmentEditForm({ initial, projects, leads, adminIds, onClose }: {
  initial: Shipment; projects: Project[]; leads: Lead[]; adminIds: string[]; onClose: () => void
}) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<ShipmentStatus>((initial.status as ShipmentStatus) ?? 'pending')
  const [weight, setWeight] = useState(String(initial.weight ?? ''))
  const [length, setLength] = useState(String(initial.dimensions?.length ?? ''))
  const [width, setWidth] = useState(String(initial.dimensions?.width ?? ''))
  const [height, setHeight] = useState(String(initial.dimensions?.height ?? ''))
  const [condition, setCondition] = useState<ItemCondition>((initial.condition as ItemCondition) ?? 'baru')
  const [packingNotes, setPackingNotes] = useState(initial.packingNotes ?? '')

  const handleSave = async () => {
    setSaving(true)
    try {
      const prevStatus = initial.status as ShipmentStatus
      await updateDocument('shipments', initial.id, {
        status,
        weight: Number(weight) || 0,
        dimensions: { length: Number(length) || 0, width: Number(width) || 0, height: Number(height) || 0, unit: 'cm' },
        condition,
        packingNotes,
      })

      // Side-effects saat status berubah ke selesai
      if (status === 'selesai' && prevStatus !== 'selesai') {
        if (initial.leadId) {
          await updateDocument('leads', initial.leadId, { pengiriman: 'selesai' })
        } else {
          const project = projects.find((p) => p.id === initial.projectId)
          if (project) {
            await updateDocument('projects', project.id, { pipelineStage: 'instalasi' })
            const existingInstall = await getDocuments('installations', [where('projectId', '==', project.id)])
            if (existingInstall.length === 0) {
              await createDoc('installations', {
                projectId: project.id, projectName: project.name,
                customerName: project.customerName ?? '', picInstalasi: '',
                installationDate: new Date(), estimatedDuration: '',
                deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                lokasi: project.alamat ?? '', notes: '', status: 'pending',
                createdBy: user?.id ?? '',
              })
            }
            await notifyPengirimSalesSelesai(project.salesPic, adminIds, project.name, project.id)
          }
        }
      }
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="px-5 pt-5 pb-3 shrink-0 border-b border-border">
          <h3 className="font-semibold">Update Pengiriman</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{initial.projectName}</p>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-3">
          {/* Status */}
          <div>
            <label className="text-sm font-medium block mb-1">Status Pengiriman</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as ShipmentStatus)}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {(Object.entries(STATUS_LABELS) as [ShipmentStatus, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          {/* Berat */}
          <div>
            <label className="text-sm font-medium block mb-1">Berat Barang (kg)</label>
            <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="0" />
          </div>
          {/* Dimensi */}
          <div>
            <label className="text-sm font-medium block mb-1">Dimensi Barang (cm)</label>
            <div className="grid grid-cols-3 gap-3">
              {([['Panjang', length, setLength], ['Lebar', width, setWidth], ['Tinggi', height, setHeight]] as [string, string, (v: string) => void][]).map(([lbl, val, setter]) => (
                <div key={lbl}>
                  <label className="text-xs text-muted-foreground block mb-1">{lbl}</label>
                  <input type="number" value={val} onChange={(e) => setter(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="0" />
                </div>
              ))}
            </div>
          </div>
          {/* Kondisi */}
          <div>
            <label className="text-sm font-medium block mb-1">Kondisi Barang</label>
            <select value={condition} onChange={(e) => setCondition(e.target.value as ItemCondition)}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {(Object.entries(CONDITION_LABELS) as [ItemCondition, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          {/* Catatan Packing */}
          <div>
            <label className="text-sm font-medium block mb-1">Catatan Packing</label>
            <input value={packingNotes} onChange={(e) => setPackingNotes(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Packing kayu, bubble wrap, pallet, dll" />
          </div>
        </div>
        <div className="px-5 pb-5 pt-3 shrink-0 border-t border-border flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Simpan
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Inline Status Select (fabrikasi — langsung dari tabel) ───────────────────
function StatusInlineSelect({ shipment, projects, leads, adminIds }: {
  shipment: Shipment; projects: Project[]; leads: Lead[]; adminIds: string[]
}) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const currentStatus: ShipmentStatus = (shipment.status as ShipmentStatus) ?? 'pending'

  const handleChange = async (newStatus: ShipmentStatus) => {
    if (newStatus === currentStatus) return
    setSaving(true)
    try {
      await updateDocument('shipments', shipment.id, { status: newStatus })
      if (newStatus === 'selesai') {
        if (shipment.leadId) {
          await updateDocument('leads', shipment.leadId, { pengiriman: 'selesai' })
        } else {
          const project = projects.find((p) => p.id === shipment.projectId)
          if (project) {
            await updateDocument('projects', project.id, { pipelineStage: 'instalasi' })
            const existingInstall = await getDocuments('installations', [where('projectId', '==', project.id)])
            if (existingInstall.length === 0) {
              await createDoc('installations', {
                projectId: project.id, projectName: project.name,
                customerName: project.customerName ?? '', picInstalasi: '',
                installationDate: new Date(), estimatedDuration: '',
                deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                lokasi: project.alamat ?? '', notes: '', status: 'pending',
                createdBy: user?.id ?? '',
              })
            }
            await notifyPengirimSalesSelesai(project.salesPic, adminIds, project.name, project.id)
          }
        }
      }
    } finally { setSaving(false) }
  }

  return (
    <div className="flex items-center gap-1">
      {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />}
      <select value={currentStatus} disabled={saving}
        onChange={(e) => handleChange(e.target.value as ShipmentStatus)}
        className={cn('px-2 py-0.5 text-xs rounded-full border border-transparent cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed', STATUS_COLORS[currentStatus])}>
        {(Object.entries(STATUS_LABELS) as [ShipmentStatus, string][]).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
    </div>
  )
}

// ─── Shipment Table ────────────────────────────────────────────────────────────
function ShipmentTable({
  shipments, allUsers, labelKolom, leads, projects, userRole,
  showPicSales, adminIds, onEdit, onDelete,
}: {
  shipments: Shipment[]; allUsers: User[]; labelKolom: string
  leads: Lead[]; projects: Project[]; userRole: string
  showPicSales?: boolean; adminIds: string[]
  onEdit: (s: Shipment) => void; onDelete: (s: Shipment) => void
}) {
  const [search, setSearch] = useState('')
  const [filterCondition, setFilterCondition] = useState<ItemCondition | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<ShipmentStatus | 'all'>('all')
  const [page, setPage] = useState(1)

  const isAdmin = ['super_admin', 'admin'].includes(userRole)
  const isFabrikasi = userRole === 'fabrikasi'

  const userName = (id: string) => allUsers.find((u) => u.id === id)?.name ?? '-'
  const picSalesName = (s: Shipment) => {
    const salesId = s.leadId
      ? (s.picSalesId || leads.find((l) => l.id === s.leadId)?.assignedSales || '')
      : (projects.find((p) => p.id === s.projectId)?.salesPic || '')
    return salesId ? userName(salesId) : '-'
  }

  const colSpan = showPicSales ? 12 : 11

  const filtered = shipments.filter((s) => {
    const q = search.toLowerCase()
    const matchSearch = (s.projectName ?? '').toLowerCase().includes(q)
    const matchCondition = filterCondition === 'all' || s.condition === filterCondition
    const matchStatus = filterStatus === 'all' || (s.status ?? 'pending') === filterStatus
    return matchSearch && matchCondition && matchStatus
  })
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const tanpaSuratJalan = shipments.filter((s) => !s.suratJalanUrl && (s.status ?? 'pending') !== 'pending').length

  const kpiCards = [
    { label: 'Pending', count: shipments.filter((s) => (s.status ?? 'pending') === 'pending').length, icon: <Clock className="h-5 w-5" />, color: 'bg-gray-100 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400', status: 'pending' as ShipmentStatus | 'all' },
    { label: 'Proses', count: shipments.filter((s) => s.status === 'proses').length, icon: <Truck className="h-5 w-5" />, color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400', status: 'proses' as ShipmentStatus | 'all' },
    { label: 'Selesai', count: shipments.filter((s) => s.status === 'selesai').length, icon: <CheckCircle2 className="h-5 w-5" />, color: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400', status: 'selesai' as ShipmentStatus | 'all' },
    { label: 'Total', count: shipments.length, icon: <FileText className="h-5 w-5" />, color: 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400', status: 'all' as ShipmentStatus | 'all' },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiCards.map((c) => {
          const isActive = filterStatus === c.status && c.status !== 'all'
          return (
            <button key={c.label} onClick={() => { setFilterStatus(isActive ? 'all' : c.status); setPage(1) }}
              className={cn('bg-card border rounded-xl p-4 text-left transition-all cursor-pointer hover:shadow-md',
                isActive ? 'border-primary ring-1 ring-primary/30' : 'border-border')}>
              <div className="flex items-center justify-between mb-3">
                <span className={cn('p-2 rounded-lg', c.color)}>{c.icon}</span>
                <span className="text-2xl font-bold">{c.count}</span>
              </div>
              <p className="text-sm font-medium">{c.label}</p>
            </button>
          )
        })}
      </div>

      {tanpaSuratJalan > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span><span className="font-semibold">{tanpaSuratJalan}</span> pengiriman belum memiliki Surat Jalan</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Cari nama project..."
            className="w-full pl-9 pr-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <select value={filterCondition} onChange={(e) => { setFilterCondition(e.target.value as ItemCondition | 'all'); setPage(1) }}
          className="px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">Semua Kondisi</option>
          {(Object.entries(CONDITION_LABELS) as [ItemCondition, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
        </select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">{labelKolom}</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Jadwal Kirim</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Berat</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Dimensi (cm)</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Kondisi</th>
                <th className="text-center p-3 font-medium text-muted-foreground whitespace-nowrap">PDF Alamat</th>
                <th className="text-center p-3 font-medium text-muted-foreground whitespace-nowrap">Surat Jalan</th>
                {showPicSales && <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">PIC Sales</th>}
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">PIC Pengiriman</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Catatan Packing</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.map((s) => {
                const cond = (s.condition as ItemCondition) in CONDITION_LABELS
                  ? (s.condition as ItemCondition) : 'baru'
                const dims = s.dimensions ?? { length: 0, width: 0, height: 0 }
                return (
                  <tr key={s.id} className="hover:bg-muted/20">
                    <td className="p-3 font-medium whitespace-nowrap max-w-[200px] truncate">{s.projectName}</td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap text-xs">
                      {s.jadwalPengiriman
                        ? <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{format(toDate(s.jadwalPengiriman as never) ?? new Date(s.jadwalPengiriman as unknown as string), 'd MMM yyyy', { locale: localeId })}</span>
                        : <span className="italic">Belum dijadwal</span>}
                    </td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">{s.weight ? `${s.weight} kg` : '-'}</td>
                    <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                      {dims.length || dims.width || dims.height ? `${dims.length}×${dims.width}×${dims.height} cm` : '-'}
                    </td>
                    <td className="p-3">
                      <span className={cn('px-2 py-0.5 text-xs rounded-full whitespace-nowrap', CONDITION_COLORS[cond])}>
                        {CONDITION_LABELS[cond]}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {s.addressPdfUrl ? (
                        <a href={s.addressPdfUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <FileText className="h-3 w-3" /> Lihat
                        </a>
                      ) : <span className="text-muted-foreground text-xs">-</span>}
                    </td>
                    <td className="p-3 text-center"><SuratJalanCell shipment={s} /></td>
                    {showPicSales && <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{picSalesName(s)}</td>}
                    <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                      {s.picPengiriman ? userName(s.picPengiriman) : <span className="italic">-</span>}
                    </td>
                    <td className="p-3">
                      {/* Fabrikasi: inline status select. Admin: badge saja */}
                      {isFabrikasi ? (
                        <StatusInlineSelect shipment={s} projects={projects} leads={leads} adminIds={adminIds} />
                      ) : (
                        <span className={cn('px-2 py-0.5 text-xs rounded-full whitespace-nowrap', STATUS_COLORS[(s.status as ShipmentStatus) ?? 'pending'])}>
                          {STATUS_LABELS[(s.status as ShipmentStatus) ?? 'pending']}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs max-w-[140px] truncate">{s.packingNotes || '-'}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        {/* Edit: admin (jadwal/pic/upload) & fabrikasi (dimensi/berat/catatan) */}
                        {(isAdmin || isFabrikasi) && (
                          <button onClick={() => onEdit(s)} title="Edit"
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {/* Hapus: hanya admin */}
                        {isAdmin && (
                          <button onClick={() => onDelete(s)}
                            className="p-1 rounded border border-border text-muted-foreground hover:border-destructive hover:text-destructive transition-colors" title="Hapus">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={colSpan} className="p-6 text-center text-muted-foreground">Belum ada data pengiriman</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function ShipmentPage() {
  const { user } = useAuthStore()
  const userRole = user?.role ?? ''
  const isAdmin = ['super_admin', 'admin'].includes(userRole)
  const isFabrikasi = userRole === 'fabrikasi'

  const [shipments, setShipments] = useState<Shipment[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [adminIds, setAdminIds] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'sales' | 'satuan'>('sales')

  const [showSalesForm, setShowSalesForm] = useState(false)
  const [showSatuanForm, setShowSatuanForm] = useState(false)
  const [showFabrikasiForm, setShowFabrikasiForm] = useState(false)
  const [editShipment, setEditShipment] = useState<Shipment | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Shipment | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const unsubS = subscribeToCollection('shipments', [], (docs) => setShipments(docs as unknown as Shipment[]))
    const unsubP = subscribeToCollection('projects', [], (docs) => setProjects(docs as unknown as Project[]))
    const unsubL = subscribeToCollection('leads', [], (docs) => setLeads(docs as unknown as Lead[]))
    const unsubU = subscribeToCollection('users', [], (docs) => {
      const users = docs as unknown as User[]
      setAllUsers(users)
      setAdminIds(users.filter((u) => u.role === 'admin' || u.role === 'super_admin').map((u) => u.id))
    })
    return () => { unsubS(); unsubP(); unsubL(); unsubU() }
  }, [])

  // PIC Pengiriman = hanya role fabrikasi
  const picUsers = allUsers.filter((u) => u.role === 'fabrikasi')

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDocument('shipments', deleteTarget.id)
      setDeleteTarget(null)
    } finally { setDeleting(false) }
  }

  const handleEdit = (s: Shipment) => {
    setEditShipment(s)
    if (isFabrikasi) {
      setShowFabrikasiForm(true)
    } else {
      // Admin: form jadwal/pic/upload
      if (s.leadId) setShowSatuanForm(true)
      else setShowSalesForm(true)
    }
  }

  const userId = user?.id ?? ''
  const visibleShipments = shipments.filter((s) => {
    if (isAdmin) return true
    if (isFabrikasi) return s.picPengiriman === userId
    if (userRole === 'sales') {
      if (s.leadId) return leads.find((l) => l.id === s.leadId)?.assignedSales === userId
      return projects.find((p) => p.id === s.projectId)?.salesPic === userId
    }
    return false
  })
  const salesShipments = visibleShipments.filter((s) => !s.leadId)
  const satuanShipments = visibleShipments.filter((s) => !!s.leadId)

  const closeAll = () => {
    setShowSalesForm(false)
    setShowSatuanForm(false)
    setShowFabrikasiForm(false)
    setEditShipment(undefined)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Pengiriman</h1>
          <p className="text-sm text-muted-foreground">
            {isFabrikasi ? 'Pengiriman yang ditugaskan kepada Anda' : 'Jadwal pengiriman barang ke customer'}
          </p>
        </div>
        {/* Hanya admin yang bisa tambah pengiriman baru */}
        {isAdmin && (
          <button
            onClick={() => {
              setEditShipment(undefined)
              if (activeTab === 'sales') setShowSalesForm(true)
              else setShowSatuanForm(true)
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Tambah Pengiriman
          </button>
        )}
      </div>

      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {([
          { id: 'sales', label: 'Project Sales', count: salesShipments.length },
          { id: 'satuan', label: 'Project Satuan', count: satuanShipments.length },
        ] as const).map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            {tab.label}
            <span className="ml-1.5 px-1.5 py-0.5 bg-border text-muted-foreground text-xs rounded-full">{tab.count}</span>
          </button>
        ))}
      </div>

      {activeTab === 'sales' ? (
        <ShipmentTable shipments={salesShipments} allUsers={allUsers}
          labelKolom="Nama Project" leads={leads} projects={projects}
          userRole={userRole} showPicSales adminIds={adminIds}
          onEdit={handleEdit} onDelete={setDeleteTarget} />
      ) : (
        <ShipmentTable shipments={satuanShipments} allUsers={allUsers}
          labelKolom="Customer / Produk" leads={leads} projects={projects}
          userRole={userRole} showPicSales adminIds={adminIds}
          onEdit={handleEdit} onDelete={setDeleteTarget} />
      )}

      {/* Form Admin — Project Sales */}
      {showSalesForm && (
        <SalesShipmentForm projects={projects} picUsers={picUsers}
          initial={editShipment} adminIds={adminIds} onClose={closeAll} />
      )}

      {/* Form Admin — Project Satuan */}
      {showSatuanForm && (
        <SatuanShipmentForm leads={leads} picUsers={picUsers}
          initial={editShipment} onClose={closeAll} />
      )}

      {/* Form Fabrikasi — Update dimensi/berat/catatan/status */}
      {showFabrikasiForm && editShipment && (
        <FabrikasiShipmentEditForm
          initial={editShipment} projects={projects} leads={leads}
          adminIds={adminIds} onClose={closeAll} />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Hapus pengiriman "${deleteTarget.projectName}"?`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
