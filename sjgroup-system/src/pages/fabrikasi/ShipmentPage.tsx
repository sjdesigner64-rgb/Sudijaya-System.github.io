import { useEffect, useState } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { Shipment, ItemCondition, Project, User } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { createDoc, updateDocument, deleteDocument, subscribeToCollection, where } from '@/services/firestore.service'

const CONDITION_LABELS: Record<ItemCondition, string> = {
  baru: 'Baru',
  bekas: 'Bekas',
  servis: 'Servis',
  retur: 'Retur',
}
const CONDITION_COLORS: Record<ItemCondition, string> = {
  baru: 'bg-green-100 dark:bg-green-900 text-green-700',
  bekas: 'bg-amber-100 dark:bg-amber-900 text-amber-700',
  servis: 'bg-blue-100 dark:bg-blue-900 text-blue-700',
  retur: 'bg-red-100 dark:bg-red-900 text-red-700',
}

interface ShipmentFormProps {
  projects: Project[]
  fabrikasiUsers: User[]
  initial?: Shipment
  onClose: () => void
}

function ShipmentForm({ projects, fabrikasiUsers, initial, onClose }: ShipmentFormProps) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [projectId, setProjectId] = useState(initial?.projectId ?? projects[0]?.id ?? '')
  const [sku, setSku] = useState(initial?.sku ?? '')
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : '1')
  const [weight, setWeight] = useState(initial ? String(initial.weight) : '')
  const [length, setLength] = useState(initial ? String(initial.dimensions.length) : '')
  const [width, setWidth] = useState(initial ? String(initial.dimensions.width) : '')
  const [height, setHeight] = useState(initial ? String(initial.dimensions.height) : '')
  const [condition, setCondition] = useState<ItemCondition>(initial?.condition ?? 'baru')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [picPengiriman, setPicPengiriman] = useState(initial?.picPengiriman ?? fabrikasiUsers[0]?.id ?? '')
  const [packingNotes, setPackingNotes] = useState(initial?.packingNotes ?? '')

  const selectedProject = projects.find((p) => p.id === projectId)

  const handleSave = async () => {
    if (!selectedProject || !sku.trim() || !picPengiriman || !user) return
    setSaving(true)
    try {
      const data = {
        projectId: selectedProject.id,
        projectName: selectedProject.name,
        sku,
        quantity: Number(quantity) || 0,
        weight: Number(weight) || 0,
        dimensions: { length: Number(length) || 0, width: Number(width) || 0, height: Number(height) || 0, unit: 'cm' },
        condition,
        address,
        picPengiriman,
        packingNotes,
      }
      if (initial) {
        await updateDocument('shipments', initial.id, data)
      } else {
        await createDoc('shipments', { ...data, createdBy: user.id })
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold mb-4">{initial ? 'Edit Pengiriman' : 'Tambah Pengiriman'}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Nama Project</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {projects.map((p) => (<option key={p.id} value={p.id}>{p.name} — {p.customerName}</option>))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">SKU / Kode Produk</label>
              <input value={sku} onChange={(e) => setSku(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Kode internal produk" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Jumlah Barang</label>
              <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Berat Barang (kg)</label>
            <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Dimensi Barang (cm)</label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Panjang</label>
                <input type="number" value={length} onChange={(e) => setLength(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Lebar</label>
                <input type="number" value={width} onChange={(e) => setWidth(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Tinggi</label>
                <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Kondisi Barang</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value as ItemCondition)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {(Object.entries(CONDITION_LABELS) as [ItemCondition, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">PIC Pengiriman</label>
              <select value={picPengiriman} onChange={(e) => setPicPengiriman(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {fabrikasiUsers.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Alamat</label>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none h-16" placeholder="Alamat customer..." />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Catatan Packing</label>
            <input value={packingNotes} onChange={(e) => setPackingNotes(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Packing kayu, bubble wrap, pallet, dll" />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button onClick={handleSave} disabled={saving || !selectedProject || !sku.trim()} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Simpan
          </button>
        </div>
      </div>
    </div>
  )
}

export function ShipmentPage() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [fabrikasiUsers, setFabrikasiUsers] = useState<User[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editShipment, setEditShipment] = useState<Shipment | undefined>()

  useEffect(() => {
    const unsubS = subscribeToCollection('shipments', [], (docs) => setShipments(docs as unknown as Shipment[]))
    const unsubP = subscribeToCollection('projects', [], (docs) => setProjects(docs as unknown as Project[]))
    const unsubF = subscribeToCollection('users', [where('role', '==', 'fabrikasi')], (docs) => setFabrikasiUsers(docs as unknown as User[]))
    return () => { unsubS(); unsubP(); unsubF() }
  }, [])

  const picName = (id: string) => fabrikasiUsers.find((u) => u.id === id)?.name ?? '-'

  const handleDelete = async (s: Shipment) => {
    if (!confirm(`Hapus pengiriman "${s.sku}" untuk project "${s.projectName}"?`)) return
    await deleteDocument('shipments', s.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Pengiriman</h1>
          <p className="text-sm text-muted-foreground">Data pengiriman barang ke customer</p>
        </div>
        <button
          onClick={() => { setEditShipment(undefined); setShowForm(true) }}
          disabled={projects.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Tambah Pengiriman
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Nama Project</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">SKU</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Jumlah</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Berat</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Dimensi (cm)</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Kondisi</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Alamat</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">PIC</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Catatan Packing</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shipments.map((s) => (
                <tr key={s.id} className="hover:bg-muted/20">
                  <td className="p-3 font-medium whitespace-nowrap">{s.projectName}</td>
                  <td className="p-3 text-muted-foreground whitespace-nowrap">{s.sku}</td>
                  <td className="p-3 whitespace-nowrap">{s.quantity}</td>
                  <td className="p-3 text-muted-foreground whitespace-nowrap">{s.weight} kg</td>
                  <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{s.dimensions.length}×{s.dimensions.width}×{s.dimensions.height}</td>
                  <td className="p-3"><span className={cn('px-2 py-0.5 text-xs rounded-full whitespace-nowrap', CONDITION_COLORS[s.condition])}>{CONDITION_LABELS[s.condition]}</span></td>
                  <td className="p-3 text-muted-foreground text-xs max-w-[160px] truncate">{s.address}</td>
                  <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{picName(s.picPengiriman)}</td>
                  <td className="p-3 text-muted-foreground text-xs max-w-[160px] truncate">{s.packingNotes}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <button onClick={() => { setEditShipment(s); setShowForm(true) }} className="text-xs text-primary hover:underline">Edit</button>
                      <button onClick={() => handleDelete(s)} className="text-muted-foreground hover:text-destructive" title="Hapus">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {shipments.length === 0 && (
                <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Belum ada data pengiriman</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <ShipmentForm
          projects={projects}
          fabrikasiUsers={fabrikasiUsers}
          initial={editShipment}
          onClose={() => { setShowForm(false); setEditShipment(undefined) }}
        />
      )}
    </div>
  )
}
