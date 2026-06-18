import { useEffect, useState } from 'react'
import { Plus, Search, ExternalLink, Package, Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { WarehouseStock, StockCategory, StockStatus } from '@/types'
import { createDoc, subscribeToCollection } from '@/services/firestore.service'

const CATEGORY_LABELS: Record<StockCategory, string> = {
  mesin: 'Mesin',
  sparepart_pmx: 'Spare Part PMX',
  sparepart_basic_destoner: 'Spare Part Basic Destoner',
  sparepart_umum: 'Spare Part Umum',
}

const STATUS_COLORS: Record<StockStatus, string> = {
  ready: 'bg-green-100 dark:bg-green-900 text-green-700',
  low_stock: 'bg-amber-100 dark:bg-amber-900 text-amber-700',
  out_of_stock: 'bg-red-100 dark:bg-red-900 text-red-700',
}
const STATUS_LABELS: Record<StockStatus, string> = {
  ready: 'Ready',
  low_stock: 'Stok Menipis',
  out_of_stock: 'Habis',
}

function NewStockForm({ onClose }: { onClose: () => void }) {
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<StockCategory>('mesin')
  const [quantity, setQuantity] = useState('0')
  const [unit, setUnit] = useState('unit')
  const [length, setLength] = useState('')
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [status, setStatus] = useState<StockStatus>('ready')
  const [gdriveLink, setGdriveLink] = useState('')

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await createDoc('warehouse_stock', {
        name,
        category,
        quantity: Number(quantity) || 0,
        unit,
        dimensions: { length: Number(length) || 0, width: Number(width) || 0, height: Number(height) || 0, unit: 'cm' },
        weight: Number(weight) || 0,
        gdriveLink: gdriveLink || undefined,
        status,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5">
        <h3 className="font-semibold mb-4">Tambah Item Stok</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Nama Item</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Kategori</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as StockCategory)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {(Object.entries(CATEGORY_LABELS) as [StockCategory, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Jumlah & Satuan</label>
              <div className="flex gap-1">
                <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-20 px-2 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" placeholder="0" />
                <input value={unit} onChange={(e) => setUnit(e.target.value)} className="flex-1 px-2 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" placeholder="unit" />
              </div>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Dimensi P × L × T (cm)</label>
            <div className="flex gap-1">
              <input type="number" value={length} onChange={(e) => setLength(e.target.value)} placeholder="P" className="flex-1 px-2 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
              <input type="number" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="L" className="flex-1 px-2 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
              <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="T" className="flex-1 px-2 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Berat (kg)</label>
              <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as StockStatus)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="ready">Ready</option>
                <option value="low_stock">Stok Menipis</option>
                <option value="out_of_stock">Habis</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Link Google Drive</label>
            <input type="url" value={gdriveLink} onChange={(e) => setGdriveLink(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="https://drive.google.com/..." />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Simpan
          </button>
        </div>
      </div>
    </div>
  )
}

export function WarehousePage() {
  const [stocks, setStocks] = useState<WarehouseStock[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<StockCategory | 'all'>('all')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    const unsubscribe = subscribeToCollection('warehouse_stock', [], (docs) => {
      setStocks(docs as unknown as WarehouseStock[])
    })
    return unsubscribe
  }, [])

  const filtered = stocks.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = category === 'all' || s.category === category
    return matchSearch && matchCat
  })

  const summaryByStatus = (status: StockStatus) => stocks.filter((s) => s.status === status).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Stok Warehouse</h1>
          <p className="text-sm text-muted-foreground">Manajemen inventory mesin dan spare part</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Tambah Item
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {(['ready', 'low_stock', 'out_of_stock'] as StockStatus[]).map((s) => (
          <div key={s} className={cn('p-3 rounded-xl border', s === 'ready' ? 'border-green-200 dark:border-green-800' : s === 'low_stock' ? 'border-amber-200 dark:border-amber-800' : 'border-red-200 dark:border-red-800')}>
            <p className="text-2xl font-bold">{summaryByStatus(s)}</p>
            <p className={cn('text-xs mt-0.5', STATUS_COLORS[s].split(' ')[2])}>{STATUS_LABELS[s]}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama item..."
            className="w-full pl-9 pr-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as StockCategory | 'all')}
          className="px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Semua Kategori</option>
          {(Object.entries(CATEGORY_LABELS) as [StockCategory, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground">Nama Item</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Kategori</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Stok</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Dimensi (cm)</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Berat</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Dok</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-muted/20">
                  <td className="p-3 font-medium flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    {item.name}
                  </td>
                  <td className="p-3 text-muted-foreground text-xs">{CATEGORY_LABELS[item.category]}</td>
                  <td className="p-3 font-semibold">{item.quantity} {item.unit}</td>
                  <td className="p-3 text-muted-foreground text-xs">
                    {item.dimensions.length} × {item.dimensions.width} × {item.dimensions.height}
                  </td>
                  <td className="p-3 text-muted-foreground text-xs">{item.weight} kg</td>
                  <td className="p-3">
                    <span className={cn('px-2 py-0.5 text-xs rounded-full', STATUS_COLORS[item.status])}>
                      {STATUS_LABELS[item.status]}
                    </span>
                  </td>
                  <td className="p-3">
                    {item.gdriveLink ? (
                      <a href={item.gdriveLink} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">Belum ada item stok</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && <NewStockForm onClose={() => setShowForm(false)} />}
    </div>
  )
}
