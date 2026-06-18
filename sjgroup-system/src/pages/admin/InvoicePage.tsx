import { useEffect, useState } from 'react'
import { Plus, Download, Upload, Loader2 } from 'lucide-react'
import type { Invoice, Project } from '@/types'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { toDate } from '@/utils/firestore'
import { useAuthStore } from '@/store/authStore'
import { createDoc, updateDocument, subscribeToCollection } from '@/services/firestore.service'
import { uploadFile, buildPath } from '@/services/storage.service'
import { generateInvoicePDF } from '@/utils/pdf'

const currency = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(n)

interface InvoiceFormProps {
  projects: Project[]
  onClose: () => void
}

function InvoiceForm({ projects, onClose }: InvoiceFormProps) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const selectedProject = projects.find((p) => p.id === projectId)

  const handleSave = async () => {
    if (!invoiceNumber.trim() || !selectedProject || !amount || !user) return
    setSaving(true)
    try {
      const invoiceId = await createDoc('invoices', {
        quotationId: '',
        projectId: selectedProject.id,
        customerId: selectedProject.customerId,
        invoiceNumber,
        createdBy: user.id,
        amount: Number(amount),
      })
      if (file) {
        const url = await uploadFile(buildPath.invoice(invoiceId, file.name), file)
        await updateDocument('invoices', invoiceId, { uploadedFileUrl: url })
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5">
        <h3 className="font-semibold mb-4">Buat Invoice</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">No. Invoice</label>
            <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="INV-2026-XXX" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Project</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.customerName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Total Amount</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Upload File Invoice (PDF)</label>
            <label className="flex items-center justify-center w-full h-16 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors text-sm text-muted-foreground gap-2">
              <Upload className="h-4 w-4" />
              {file ? file.name : 'Pilih file PDF'}
              <input type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button onClick={handleSave} disabled={saving || !selectedProject} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Simpan
          </button>
        </div>
      </div>
    </div>
  )
}

export function InvoicePage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    const unsubI = subscribeToCollection('invoices', [], (docs) => {
      setInvoices(
        docs.map((d) => ({
          ...d,
          createdAt: toDate(d.createdAt as never) ?? new Date(),
        })) as unknown as Invoice[]
      )
    })
    const unsubP = subscribeToCollection('projects', [], (docs) => {
      setProjects(docs as unknown as Project[])
    })
    return () => { unsubI(); unsubP() }
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Invoice</h1>
          <p className="text-sm text-muted-foreground">Buat dan kelola invoice customer</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={projects.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Buat Invoice
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-3 font-medium text-muted-foreground">No. Invoice</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Amount</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Tanggal</th>
              <th className="text-left p-3 font-medium text-muted-foreground">File</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {invoices.map((inv) => {
              const project = projects.find((p) => p.id === inv.projectId)
              return (
                <tr key={inv.id} className="hover:bg-muted/20">
                  <td className="p-3 font-medium">{inv.invoiceNumber}</td>
                  <td className="p-3 font-semibold">{currency(inv.amount)}</td>
                  <td className="p-3 text-muted-foreground text-xs">
                    {format(inv.createdAt, 'd MMM yyyy', { locale: localeId })}
                  </td>
                  <td className="p-3">
                    {inv.uploadedFileUrl ? (
                      <a href={inv.uploadedFileUrl} target="_blank" rel="noreferrer" className="text-xs text-green-600 hover:underline">Ada file</a>
                    ) : (
                      <span className="text-xs text-muted-foreground">Belum ada file</span>
                    )}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => generateInvoicePDF(inv, project?.customerName ?? 'Customer')}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Download className="h-3 w-3" /> Download
                    </button>
                  </td>
                </tr>
              )
            })}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">Belum ada invoice</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && <InvoiceForm projects={projects} onClose={() => setShowForm(false)} />}
    </div>
  )
}
