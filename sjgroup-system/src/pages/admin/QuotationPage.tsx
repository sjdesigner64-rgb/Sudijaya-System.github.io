import { useEffect, useState } from 'react'
import { Plus, Download, Trash2, Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { toDate } from '@/utils/firestore'
import type { Quotation, QuotationStatus, QuotationItem, Project } from '@/types'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { generateQuotationPDF } from '@/utils/pdf'
import { useAuthStore } from '@/store/authStore'
import { createDoc, subscribeToCollection } from '@/services/firestore.service'
import { notifyQuotationReady } from '@/services/notification.service'

const STATUS_COLORS: Record<QuotationStatus, string> = {
  diproses: 'bg-blue-100 dark:bg-blue-900 text-blue-700',
  pending: 'bg-amber-100 dark:bg-amber-900 text-amber-700',
  selesai: 'bg-green-100 dark:bg-green-900 text-green-700',
}

const currency = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(n)

interface QuotationFormProps {
  projects: Project[]
  onClose: () => void
}

function QuotationForm({ projects, onClose }: QuotationFormProps) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [deadline, setDeadline] = useState('')
  const [status, setStatus] = useState<QuotationStatus>('diproses')
  const [items, setItems] = useState<QuotationItem[]>([
    { description: '', qty: 1, unit: 'unit', price: 0 },
  ])

  const addItem = () => setItems([...items, { description: '', qty: 1, unit: 'unit', price: 0 }])
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i))
  const updateItem = (i: number, field: keyof QuotationItem, value: string | number) =>
    setItems(items.map((item, idx) => idx === i ? { ...item, [field]: value } : item))

  const total = items.reduce((s, i) => s + i.qty * i.price, 0)
  const selectedProject = projects.find((p) => p.id === projectId)

  const handleSave = async () => {
    if (!selectedProject || !deadline || !user) return
    setSaving(true)
    try {
      const quotationId = await createDoc('quotations', {
        projectId: selectedProject.id,
        customerId: selectedProject.customerId,
        requestedBy: selectedProject.salesPic,
        createdBy: user.id,
        status,
        deadline: new Date(deadline),
        items,
        totalAmount: total,
      })
      await notifyQuotationReady(selectedProject.salesPic, selectedProject.name, quotationId)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl p-5 my-4">
        <h3 className="font-semibold mb-4">Buat Quotation</h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-sm font-medium block mb-1">Project</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.customerName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Deadline</label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as QuotationStatus)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="diproses">Diproses</option>
              <option value="pending">Pending</option>
              <option value="selesai">Selesai</option>
            </select>
          </div>
        </div>

        {/* Items */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Item Penawaran</label>
            <button onClick={addItem} className="text-xs text-primary hover:underline flex items-center gap-1">
              <Plus className="h-3 w-3" /> Tambah Baris
            </button>
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-1 text-xs text-muted-foreground px-1">
              <span className="col-span-5">Deskripsi</span>
              <span className="col-span-2">Qty</span>
              <span className="col-span-2">Satuan</span>
              <span className="col-span-2">Harga</span>
              <span className="col-span-1" />
            </div>
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-1">
                <input
                  value={item.description}
                  onChange={(e) => updateItem(i, 'description', e.target.value)}
                  className="col-span-5 px-2 py-1.5 border border-input rounded text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Deskripsi item"
                />
                <input
                  type="number"
                  value={item.qty}
                  onChange={(e) => updateItem(i, 'qty', Number(e.target.value))}
                  className="col-span-2 px-2 py-1.5 border border-input rounded text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  value={item.unit}
                  onChange={(e) => updateItem(i, 'unit', e.target.value)}
                  className="col-span-2 px-2 py-1.5 border border-input rounded text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  type="number"
                  value={item.price}
                  onChange={(e) => updateItem(i, 'price', Number(e.target.value))}
                  className="col-span-2 px-2 py-1.5 border border-input rounded text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button onClick={() => removeItem(i)} className="col-span-1 flex items-center justify-center text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-2 text-sm font-semibold">
            Total: {currency(total)}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button onClick={handleSave} disabled={saving || !selectedProject || !deadline} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Simpan
          </button>
        </div>
      </div>
    </div>
  )
}

export function QuotationPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    const unsubQ = subscribeToCollection('quotations', [], (docs) => {
      setQuotations(
        docs.map((d) => ({
          ...d,
          deadline: toDate(d.deadline as never) ?? new Date(),
          createdAt: toDate(d.createdAt as never) ?? new Date(),
        })) as unknown as Quotation[]
      )
    })
    const unsubP = subscribeToCollection('projects', [], (docs) => {
      setProjects(docs as unknown as Project[])
    })
    return () => { unsubQ(); unsubP() }
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Quotation</h1>
          <p className="text-sm text-muted-foreground">Manajemen penawaran harga ke customer</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={projects.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Buat Quotation
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground">No. Quotation</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Total</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Deadline</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {quotations.map((q) => {
                const project = projects.find((p) => p.id === q.projectId)
                return (
                  <tr key={q.id} className="hover:bg-muted/20">
                    <td className="p-3 font-medium">{q.id}</td>
                    <td className="p-3 font-semibold">{currency(q.totalAmount)}</td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {format(q.deadline, 'd MMM yyyy', { locale: localeId })}
                    </td>
                    <td className="p-3">
                      <span className={cn('px-2 py-0.5 text-xs rounded-full', STATUS_COLORS[q.status])}>
                        {q.status.charAt(0).toUpperCase() + q.status.slice(1)}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => generateQuotationPDF(q, project?.customerName ?? 'Customer')}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Download className="h-3 w-3" />
                        PDF
                      </button>
                    </td>
                  </tr>
                )
              })}
              {quotations.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">Belum ada quotation</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && <QuotationForm projects={projects} onClose={() => setShowForm(false)} />}
    </div>
  )
}
