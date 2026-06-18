import { useEffect, useState } from 'react'
import { Plus, ChevronRight, ArrowRight, Loader2 } from 'lucide-react'
import type { Project, PipelineStage, ProductCategory } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { createDoc, updateDocument, subscribeToCollection } from '@/services/firestore.service'

const STAGE_LABELS: Record<PipelineStage, string> = {
  leads: 'Leads',
  dp_layout: 'DP + Layout',
  meeting_fabrikasi: 'Meeting Fabrikasi',
  report_customer: 'Report ke Customer',
  admin_order: 'Admin Order',
  fabrikasi_build: 'Build Produk',
  pelunasan: 'Pelunasan',
  pengiriman: 'Pengiriman',
  instalasi: 'Instalasi',
}

const STAGES = Object.keys(STAGE_LABELS) as PipelineStage[]

const currency = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', notation: 'compact' }).format(n)

function NewProjectForm({ onClose }: { onClose: () => void }) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [category, setCategory] = useState<ProductCategory>('Zenchang')
  const [estimatedValue, setEstimatedValue] = useState('')

  const handleSave = async () => {
    if (!name.trim() || !customerName.trim() || !user) return
    setSaving(true)
    try {
      const customerId = await createDoc('customers', {
        name: customerName,
        phone: '',
        email: '',
        source: 'offline',
        status: 'prospect',
        isActive: true,
        lastFollowUp: new Date(),
        createdBy: user.id,
      })
      await createDoc('projects', {
        name,
        customerId,
        customerName,
        salesPic: user.id,
        category,
        status: 'active',
        pipelineStage: 'leads',
        estimatedValue: Number(estimatedValue) || 0,
        dpPercentage: 0,
        payments: [],
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5">
        <h3 className="font-semibold mb-4">Tambah Project Baru</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Nama Project</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Mis. Mesin Sortir PMX-300" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Nama Customer</label>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Brand Mesin</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as ProductCategory)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {(['Zenchang','VNT','Nordic','Zenyer','Lijun','Pinecone'] as ProductCategory[]).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Estimasi Nilai (Rp)</label>
              <input type="number" value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="0" />
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Simpan
          </button>
        </div>
      </div>
    </div>
  )
}

export function PipelinePage() {
  const [items, setItems] = useState<Project[]>([])
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    const unsubscribe = subscribeToCollection('projects', [], (docs) => {
      setItems(docs as unknown as Project[])
    })
    return unsubscribe
  }, [])

  const stageItems = (stage: PipelineStage) => items.filter((i) => i.pipelineStage === stage)

  const advanceStage = async (item: Project) => {
    const idx = STAGES.indexOf(item.pipelineStage)
    if (idx === -1 || idx === STAGES.length - 1) return
    await updateDocument('projects', item.id, { pipelineStage: STAGES[idx + 1] })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Pipeline Project</h1>
          <p className="text-sm text-muted-foreground">Tracking progress per stage dari leads ke instalasi</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          Tambah Project
        </button>
      </div>

      {/* Kanban board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-max">
          {STAGES.map((stage, idx) => {
            const stageList = stageItems(stage)
            return (
              <div key={stage} className="w-48 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    {idx > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {STAGE_LABELS[stage]}
                    </h3>
                  </div>
                  <span className="text-xs text-muted-foreground">{stageList.length}</span>
                </div>
                <div className="space-y-2">
                  {stageList.map((item) => (
                    <div
                      key={item.id}
                      className="bg-card border border-border rounded-lg p-3 hover:border-primary/50 transition-colors"
                    >
                      <p className="text-sm font-medium line-clamp-2">{item.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{item.customerName}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">
                          {item.category}
                        </span>
                        <span className="text-xs font-semibold text-primary">
                          {currency(item.estimatedValue)}
                        </span>
                      </div>
                      {idx < STAGES.length - 1 && (
                        <button
                          onClick={() => advanceStage(item)}
                          className="mt-2 w-full flex items-center justify-center gap-1 text-[11px] text-primary hover:underline"
                        >
                          Lanjut ke {STAGE_LABELS[STAGES[idx + 1]]} <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {stageList.length === 0 && (
                    <div className="h-12 border border-dashed border-border rounded-lg flex items-center justify-center">
                      <span className="text-xs text-muted-foreground/50">Kosong</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Total value */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Pipeline Value', value: currency(items.reduce((s, i) => s + i.estimatedValue, 0)), sub: `${items.length} project aktif` },
          { label: 'Sudah Pelunasan', value: currency(items.filter(i => ['pelunasan','pengiriman','instalasi'].includes(i.pipelineStage)).reduce((s, i) => s + i.estimatedValue, 0)), sub: `${items.filter(i => ['pelunasan','pengiriman','instalasi'].includes(i.pipelineStage)).length} project` },
          { label: 'Dalam Produksi', value: currency(items.filter(i => i.pipelineStage === 'fabrikasi_build').reduce((s, i) => s + i.estimatedValue, 0)), sub: `${items.filter(i => i.pipelineStage === 'fabrikasi_build').length} project` },
        ].map((card) => (
          <div key={card.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="text-xl font-bold mt-1">{card.value}</p>
            <p className="text-xs text-muted-foreground">{card.sub}</p>
          </div>
        ))}
      </div>

      {showForm && <NewProjectForm onClose={() => setShowForm(false)} />}
    </div>
  )
}
