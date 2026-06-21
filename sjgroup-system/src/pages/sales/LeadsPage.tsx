import { useEffect, useState } from 'react'
import { Plus, Search, Loader2, Trash2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { toDate } from '@/utils/firestore'
import type { Lead, LeadStatus, ProductCategory, CustomerSource, Customer, User } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { createDoc, updateDocument, deleteDocument, subscribeToCollection, where } from '@/services/firestore.service'
import { Pagination } from '@/components/common/Pagination'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

const PAGE_SIZE = 10

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Baru',
  follow_up: 'Follow Up',
  qualified: 'Qualified',
  closed_won: 'Closing Won',
  closed_lost: 'Closing Lost',
}

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
  follow_up: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300',
  qualified: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
  closed_won: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
  closed_lost: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
}

const SOURCE_LABELS: Record<CustomerSource, string> = {
  whatsapp: 'WhatsApp',
  iklan: 'Iklan',
  offline: 'Offline',
}

const NEW_CUSTOMER_VALUE = '__new__'

interface LeadFormProps {
  customers: Customer[]
  salesUsers: User[]
  onClose: () => void
  initial?: Lead
}

function LeadForm({ customers, salesUsers, onClose, initial }: LeadFormProps) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [customerId, setCustomerId] = useState(initial?.customerId ?? customers[0]?.id ?? NEW_CUSTOMER_VALUE)
  const [newCustomerName, setNewCustomerName] = useState(initial?.customerName ?? '')
  const [assignedSales, setAssignedSales] = useState(initial?.assignedSales ?? user?.id ?? salesUsers[0]?.id ?? '')
  const [form, setForm] = useState({
    productCategory: initial?.productCategory ?? 'Zenchang' as ProductCategory,
    productName: initial?.productName ?? '',
    source: initial?.source ?? 'whatsapp' as CustomerSource,
    status: initial?.status ?? 'new' as LeadStatus,
    notes: initial?.notes ?? '',
  })

  const isNewCustomer = customerId === NEW_CUSTOMER_VALUE

  const handleSave = async () => {
    if (!user || !assignedSales) return
    if (isNewCustomer && !newCustomerName.trim()) return
    if (!isNewCustomer && !customerId) return
    setSaving(true)
    try {
      if (initial) {
        await updateDocument('leads', initial.id, {
          productCategory: form.productCategory,
          productName: form.productName,
          source: form.source,
          status: form.status,
          notes: form.notes,
          assignedSales,
        })
      } else {
        let finalCustomerId = customerId
        let finalCustomerName = customers.find((c) => c.id === customerId)?.name ?? ''

        if (isNewCustomer) {
          finalCustomerName = newCustomerName
          finalCustomerId = await createDoc('customers', {
            name: newCustomerName,
            phone: '',
            email: '',
            source: form.source,
            status: 'lead',
            isActive: true,
            lastFollowUp: new Date(),
            createdBy: user.id,
          })
        }

        await createDoc('leads', {
          customerId: finalCustomerId,
          customerName: finalCustomerName,
          productCategory: form.productCategory,
          productName: form.productName,
          source: form.source,
          status: form.status,
          assignedSales,
          lastFollowUp: new Date(),
          notes: form.notes,
        })
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5">
        <h3 className="font-semibold mb-4">{initial ? 'Edit Lead' : 'Tambah Lead Baru'}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Customer</label>
            {initial ? (
              <input value={initial.customerName} disabled className="w-full px-3 py-2 border border-input rounded-md text-sm bg-muted text-muted-foreground" />
            ) : (
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                <option value={NEW_CUSTOMER_VALUE}>+ Customer Baru</option>
              </select>
            )}
            {!initial && isNewCustomer && (
              <input
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                className="w-full mt-2 px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Nama customer / perusahaan baru"
              />
            )}
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">PIC Sales</label>
            <select
              value={assignedSales}
              onChange={(e) => setAssignedSales(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {salesUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Brand Mesin</label>
              <select
                value={form.productCategory}
                onChange={(e) => setForm({ ...form, productCategory: e.target.value as ProductCategory })}
                className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {(['Zenchang','VNT','Nordic','Zenyer','Lijun','Pinecone'] as ProductCategory[]).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Sumber</label>
              <select
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value as CustomerSource })}
                className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="iklan">Iklan</option>
                <option value="offline">Offline</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Produk yang Diminati</label>
            <input
              value={form.productName}
              onChange={(e) => setForm({ ...form, productName: e.target.value })}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Nama produk / mesin"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as LeadStatus })}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {(Object.entries(STATUS_LABELS) as [LeadStatus, string][]).map(([s, l]) => (
                <option key={s} value={s}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Catatan</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none h-20"
              placeholder="Catatan follow-up..."
            />
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

export function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<LeadStatus | 'all'>('all')
  const [showForm, setShowForm] = useState(false)
  const [editLead, setEditLead] = useState<Lead | undefined>()
  const [salesUsers, setSalesUsers] = useState<User[]>([])
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const unsubL = subscribeToCollection('leads', [], (docs) => {
      setLeads(
        docs.map((d) => ({
          ...d,
          lastFollowUp: toDate(d.lastFollowUp as never) ?? new Date(),
        })) as unknown as Lead[]
      )
    })
    const unsubC = subscribeToCollection('customers', [], (docs) => {
      setCustomers(docs as unknown as Customer[])
    })
    const unsubS = subscribeToCollection('users', [where('role', '==', 'sales')], (docs) => {
      setSalesUsers(docs as unknown as User[])
    })
    return () => { unsubL(); unsubC(); unsubS() }
  }, [])

  const salesName = (id: string) => salesUsers.find((u) => u.id === id)?.name ?? '-'

  const filtered = leads.filter((l) => {
    const matchSearch = l.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      l.productName.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || l.status === filterStatus
    return matchSearch && matchStatus
  })
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDocument('leads', deleteTarget.id)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">CRM Leads</h1>
          <p className="text-sm text-muted-foreground">Manajemen calon customer dan pipeline</p>
        </div>
        <button
          onClick={() => { setEditLead(undefined); setShowForm(true) }}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Tambah Lead
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Cari customer atau produk..."
            className="w-full pl-9 pr-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value as LeadStatus | 'all'); setPage(1) }}
          className="px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Semua Status</option>
          {(Object.entries(STATUS_LABELS) as [LeadStatus, string][]).map(([s, l]) => (
            <option key={s} value={s}>{l}</option>
          ))}
        </select>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(STATUS_LABELS) as [LeadStatus, string][]).map(([s, l]) => {
          const count = leads.filter((le) => le.status === s).length
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                filterStatus === s ? STATUS_COLORS[s] + ' border-transparent' : 'border-border text-muted-foreground hover:border-foreground'
              )}
            >
              {l} ({count})
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground">Nama Customer</th>
                <th className="text-left p-3 font-medium text-muted-foreground">PIC Sales</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Produk</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Brand</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Sumber</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Last Follow-Up</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.map((lead) => (
                <tr key={lead.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3 font-medium">{lead.customerName}</td>
                  <td className="p-3 text-muted-foreground text-xs">{salesName(lead.assignedSales)}</td>
                  <td className="p-3 text-muted-foreground">{lead.productName}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 bg-secondary text-secondary-foreground text-xs rounded">
                      {lead.productCategory}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{SOURCE_LABELS[lead.source]}</td>
                  <td className="p-3 text-muted-foreground text-xs">
                    {lead.lastFollowUp.toLocaleDateString('id-ID')}
                  </td>
                  <td className="p-3">
                    <span className={cn('px-2 py-0.5 text-xs rounded-full', STATUS_COLORS[lead.status])}>
                      {STATUS_LABELS[lead.status]}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setEditLead(lead); setShowForm(true) }}
                        className="text-xs text-primary hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(lead)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Hapus"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">
              Tidak ada leads ditemukan
            </div>
          )}
        </div>
      </div>

      <Pagination page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {showForm && (
        <LeadForm
          customers={customers}
          salesUsers={salesUsers}
          initial={editLead}
          onClose={() => { setShowForm(false); setEditLead(undefined) }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Hapus lead "${deleteTarget.customerName}"?`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
