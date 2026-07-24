import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { Search, RefreshCw } from 'lucide-react'
import { cn } from '@/utils/cn'
import { api } from '@/config/api'
import { Pagination } from '@/components/common/Pagination'
import { getRoleLabel } from '@/store/authStore'
import type { UserRole } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LogEntry {
  id: string
  userId: string
  userName: string
  userRole: string
  action: string
  collection: string
  recordId: string
  ipAddress: string
  createdAt: string
}

interface LogResponse {
  data: LogEntry[]
  total: number
  page: number
  limit: number
}

// ── Label maps ────────────────────────────────────────────────────────────────

const COLLECTION_LABELS: Record<string, string> = {
  customers: 'Customer',
  quotations: 'Quotation',
  invoices: 'Invoice',
  projects: 'Project',
  leads: 'Lead / Satuan',
  requests_bom: 'Request BOM',
  requests_drawing: 'Request Gambar',
  after_sales: 'After-Sales',
  shipments: 'Pengiriman',
  installations: 'Instalasi',
  tasks: 'Daily Task',
  meetings: 'Meeting',
  warehouse_stock: 'Stok Gudang',
  content_requests: 'Request Konten',
  media_assets: 'Asset Media',
  content_data: 'Data Konten',
  notifications: 'Notifikasi',
  users: 'User',
  production_gantt: 'Gantt Fabrikasi',
  activity_log: 'Log Aktivitas',
}

const ACTION_CONFIG: Record<string, { label: string; className: string }> = {
  create: { label: 'Tambah', className: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  update: { label: 'Ubah',   className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  delete: { label: 'Hapus',  className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
}

const ROLE_CLASS: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  admin:       'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  sales:       'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  fabrikasi:   'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  warehouse:   'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  media:       'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
}

const PAGE_SIZE = 50

// ── Component ─────────────────────────────────────────────────────────────────

export function ActivityLogPage() {
  const [data, setData] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const [filterAction, setFilterAction] = useState('')
  const [filterCollection, setFilterCollection] = useState('')
  const [filterUser, setFilterUser] = useState('')

  const load = useCallback(async (p: number, action: string, collection: string, user: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) })
      if (action) params.set('action', action)
      if (collection) params.set('collection', collection)
      if (user) params.set('userId', user)
      const res = await api.get<LogResponse>(`/activity_log?${params}`)
      setData(res.data.data)
      setTotal(res.data.total)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(page, filterAction, filterCollection, filterUser)
  }, [page, filterAction, filterCollection, filterUser, load])

  const applyFilter = () => {
    setPage(1)
    load(1, filterAction, filterCollection, filterUser)
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold">Log Aktivitas</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Semua aksi create / ubah / hapus oleh pengguna</p>
        </div>
        <button
          onClick={() => load(page, filterAction, filterCollection, filterUser)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent transition-colors"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filterAction}
          onChange={(e) => { setFilterAction(e.target.value); setPage(1) }}
          className="text-sm border border-border rounded-md px-2 py-1.5 bg-background"
        >
          <option value="">Semua Aksi</option>
          <option value="create">Tambah</option>
          <option value="update">Ubah</option>
          <option value="delete">Hapus</option>
        </select>

        <select
          value={filterCollection}
          onChange={(e) => { setFilterCollection(e.target.value); setPage(1) }}
          className="text-sm border border-border rounded-md px-2 py-1.5 bg-background"
        >
          <option value="">Semua Resource</option>
          {Object.entries(COLLECTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <div className="flex items-center gap-1.5 border border-border rounded-md px-2 py-1.5 bg-background">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cari User ID..."
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
            className="text-sm bg-transparent outline-none w-40"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap">Waktu</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap">User</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap">Aksi</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap">Resource</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap">ID Record</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap">IP Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && data.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-muted-foreground text-sm">Memuat...</td>
              </tr>
            )}
            {!loading && data.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-muted-foreground text-sm">Belum ada log aktivitas</td>
              </tr>
            )}
            {data.map((entry) => {
              const actionCfg = ACTION_CONFIG[entry.action] ?? { label: entry.action, className: 'bg-muted' }
              return (
                <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground text-xs">
                    {format(new Date(entry.createdAt), 'dd MMM yyyy HH:mm:ss', { locale: localeId })}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="font-medium leading-tight">{entry.userName}</div>
                    <span className={cn('inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium', ROLE_CLASS[entry.userRole] ?? 'bg-muted text-muted-foreground')}>
                      {getRoleLabel(entry.userRole as UserRole)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', actionCfg.className)}>
                      {actionCfg.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {COLLECTION_LABELS[entry.collection] ?? entry.collection}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs font-mono max-w-[140px] truncate">
                    {entry.recordId || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs">
                    {entry.ipAddress || '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
    </div>
  )
}
