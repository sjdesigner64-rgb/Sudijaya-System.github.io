import { useEffect, useMemo, useState } from 'react'
import {
  TrendingUp, Users, Package, AlertTriangle, CheckCircle2,
  Clock, CalendarDays, Filter, X, ChevronDown, ChevronUp,
  CreditCard, Image, Award, type LucideIcon,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { format, differenceInDays, startOfMonth, endOfMonth } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { cn } from '@/utils/cn'
import { toDate } from '@/utils/firestore'
import type {
  Lead, Project, AfterSales, PipelineStage,
  ProductionGantt, User, ContentRequest, Installation,
} from '@/types'
import { subscribeToCollection, where } from '@/services/firestore.service'

// ─── Constants ────────────────────────────────────────────────────────────────
const STAGE_LABELS: Record<PipelineStage, string> = {
  leads: 'Leads', dp_layout: 'DP + Layout', meeting_fabrikasi: 'Meeting Fabrikasi',
  fabrikasi_build: 'Build Produk', pelunasan: 'Pelunasan', pengiriman: 'Pengiriman', instalasi: 'Instalasi',
}
const STAGE_COLORS: Record<PipelineStage, string> = {
  leads: '#94a3b8', dp_layout: '#60a5fa', meeting_fabrikasi: '#a78bfa',
  fabrikasi_build: '#fb923c', pelunasan: '#facc15', pengiriman: '#34d399', instalasi: '#22c55e',
}
const BRANDS = ['Zenchang', 'VNT', 'Nordic', 'Zenyer', 'Lijun', 'Pinecone'] as const
const CONTENT_STATUS_LABELS: Record<string, string> = { baru: 'Baru', diproses: 'Diproses', revisi: 'Revisi', selesai: 'Selesai' }
const CONTENT_STATUS_COLORS: Record<string, string> = {
  baru: 'bg-gray-100 text-gray-600 dark:bg-gray-800',
  diproses: 'bg-blue-100 text-blue-700 dark:bg-blue-900',
  revisi: 'bg-amber-100 text-amber-700 dark:bg-amber-900',
  selesai: 'bg-green-100 text-green-700 dark:bg-green-900',
}

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', notation: 'compact', maximumFractionDigits: 1 }).format(n)

function getQuarterRange(year: number, q: 1 | 2 | 3 | 4) {
  return {
    start: new Date(year, (q - 1) * 3, 1).getTime(),
    end: new Date(year, q * 3, 0, 23, 59, 59, 999).getTime(),
  }
}

// ─── Filter types ─────────────────────────────────────────────────────────────
type Quarter = '' | 'Q1' | 'Q2' | 'Q3' | 'Q4'

interface Filters {
  quarter: Quarter
  month: string          // '' | '01'–'12'
  dateFrom: string
  dateTo: string
  salesId: string
  projectStatus: '' | 'active' | 'completed' | 'cancelled'
  projectType: '' | 'sales' | 'satuan'
  paymentStatus: '' | 'belum_dp' | 'sudah_dp' | 'sudah_lunas'
  fabrikasiId: string
  mediaId: string
  brand: string
}

const INIT: Filters = {
  quarter: '', month: '', dateFrom: '', dateTo: '',
  salesId: '', projectStatus: 'active', projectType: '',
  paymentStatus: '', fabrikasiId: '', mediaId: '', brand: '',
}

const activeCount = (f: Filters) =>
  Object.entries(f).filter(([k, v]) => {
    if (k === 'projectStatus' && v === 'active') return false // default
    return v !== ''
  }).length

// ─── FilterPanel component ────────────────────────────────────────────────────
function FilterPanel({
  filters, onChange, salesUsers, fabrikasiUsers, mediaUsers,
}: {
  filters: Filters
  onChange: (next: Partial<Filters>) => void
  salesUsers: User[]
  fabrikasiUsers: User[]
  mediaUsers: User[]
}) {
  const sel = (className: string) =>
    cn('w-full px-2 py-1.5 border border-input rounded-md text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring', className)

  const setQuarter = (q: Quarter) => onChange({ quarter: q, month: '', dateFrom: '', dateTo: '' })
  const setMonth = (m: string) => onChange({ month: m, quarter: '', dateFrom: '', dateTo: '' })

  return (
    <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-4">
      {/* Baris 1: Waktu */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Periode</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Quarter chips */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Kuartal</label>
            <div className="flex gap-1">
              {(['Q1','Q2','Q3','Q4'] as Quarter[]).map((q) => (
                <button key={q} onClick={() => setQuarter(filters.quarter === q ? '' : q)}
                  className={cn('flex-1 py-1 rounded text-[10px] font-semibold border transition-colors',
                    filters.quarter === q
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40')}>
                  {q}
                </button>
              ))}
            </div>
          </div>
          {/* Month */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Bulan</label>
            <select value={filters.month} onChange={(e) => setMonth(e.target.value)} className={sel('')}>
              <option value="">Semua Bulan</option>
              {Array.from({ length: 12 }, (_, i) => {
                const v = String(i + 1).padStart(2, '0')
                return <option key={v} value={v}>{format(new Date(2024, i, 1), 'MMMM', { locale: localeId })}</option>
              })}
            </select>
          </div>
          {/* Date from */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Dari Tanggal</label>
            <input type="date" value={filters.dateFrom}
              onChange={(e) => onChange({ dateFrom: e.target.value, quarter: '', month: '' })}
              className={sel('')} />
          </div>
          {/* Date to */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Sampai Tanggal</label>
            <input type="date" value={filters.dateTo}
              onChange={(e) => onChange({ dateTo: e.target.value, quarter: '', month: '' })}
              className={sel('')} />
          </div>
        </div>
      </div>

      {/* Baris 2: Project */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Project</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Jenis</label>
            <select value={filters.projectType} onChange={(e) => onChange({ projectType: e.target.value as Filters['projectType'] })} className={sel('')}>
              <option value="">Semua</option>
              <option value="sales">Project Sales</option>
              <option value="satuan">Project Satuan</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Status Project</label>
            <select value={filters.projectStatus} onChange={(e) => onChange({ projectStatus: e.target.value as Filters['projectStatus'] })} className={sel('')}>
              <option value="">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="completed">Selesai</option>
              <option value="cancelled">Dibatalkan</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Status Pembayaran</label>
            <select value={filters.paymentStatus} onChange={(e) => onChange({ paymentStatus: e.target.value as Filters['paymentStatus'] })} className={sel('')}>
              <option value="">Semua</option>
              <option value="belum_dp">Belum DP</option>
              <option value="sudah_dp">Sudah DP</option>
              <option value="sudah_lunas">Lunas</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Brand / Produk</label>
            <select value={filters.brand} onChange={(e) => onChange({ brand: e.target.value })} className={sel('')}>
              <option value="">Semua Brand</option>
              {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Baris 3: Tim */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tim</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">PIC Sales</label>
            <select value={filters.salesId} onChange={(e) => onChange({ salesId: e.target.value })} className={sel('')}>
              <option value="">Semua Sales</option>
              {salesUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">PIC Fabrikasi</label>
            <select value={filters.fabrikasiId} onChange={(e) => onChange({ fabrikasiId: e.target.value })} className={sel('')}>
              <option value="">Semua Fabrikasi</option>
              {fabrikasiUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">PIC Media</label>
            <select value={filters.mediaId} onChange={(e) => onChange({ mediaId: e.target.value })} className={sel('')}>
              <option value="">Semua Media</option>
              {mediaUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, iconBg, iconColor }: {
  label: string; value: string; sub?: string
  icon: LucideIcon; iconBg: string; iconColor: string
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', iconBg)}>
          <Icon className={cn('h-4 w-4', iconColor)} />
        </div>
      </div>
      <p className="text-2xl font-bold leading-none">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function DashboardPage() {
  const [filters, setFilters]           = useState<Filters>(INIT)
  const [showFilter, setShowFilter]     = useState(false)
  const [projects,   setProjects]       = useState<Project[]>([])
  const [leads,      setLeads]          = useState<Lead[]>([])
  const [afterSales, setAfterSales]     = useState<AfterSales[]>([])
  const [gantts,     setGantts]         = useState<ProductionGantt[]>([])
  const [installs,   setInstalls]       = useState<Installation[]>([])
  const [content,    setContent]        = useState<ContentRequest[]>([])
  const [salesUsers, setSalesUsers]     = useState<User[]>([])
  const [fabUsers,   setFabUsers]       = useState<User[]>([])
  const [mediaUsers, setMediaUsers]     = useState<User[]>([])

  useEffect(() => {
    const us = [
      subscribeToCollection('projects', [], (d) =>
        setProjects(d.map((x) => ({ ...x, payments: (x.payments as []) ?? [], meetingNotes: (x.meetingNotes as []) ?? [] })) as unknown as Project[])
      ),
      subscribeToCollection('leads', [], (d) =>
        setLeads(d.map((x) => ({ ...x, lastFollowUp: toDate(x.lastFollowUp as never) ?? new Date() })) as unknown as Lead[])
      ),
      subscribeToCollection('after_sales', [], (d) =>
        setAfterSales(d.map((x) => ({ ...x, reportDate: toDate(x.reportDate as never) ?? new Date() })) as unknown as AfterSales[])
      ),
      subscribeToCollection('production_gantt', [], (d) =>
        setGantts(d.map((x) => ({ ...x, overallDeadline: toDate(x.overallDeadline as never) ?? new Date(), tasks: [] })) as unknown as ProductionGantt[])
      ),
      subscribeToCollection('installations', [], (d) =>
        setInstalls(d.map((x) => ({
          ...x,
          installationDate: toDate(x.installationDate as never) ?? new Date(),
          deadline: toDate(x.deadline as never) ?? new Date(),
        })) as unknown as Installation[])
      ),
      subscribeToCollection('content_requests', [], (d) =>
        setContent(d.map((x) => ({ ...x, deadline: toDate(x.deadline as never) ?? new Date() })) as unknown as ContentRequest[])
      ),
      subscribeToCollection('users', [where('role', '==', 'sales')],     (d) => setSalesUsers(d as unknown as User[])),
      subscribeToCollection('users', [where('role', '==', 'fabrikasi')], (d) => setFabUsers(d as unknown as User[])),
      subscribeToCollection('users', [where('role', '==', 'media')],     (d) => setMediaUsers(d as unknown as User[])),
    ]
    return () => us.forEach((u) => u())
  }, [])

  const mergeFilter = (next: Partial<Filters>) => setFilters((f) => ({ ...f, ...next }))
  const resetFilters = () => setFilters(INIT)
  const nActive = activeCount(filters)

  const year = new Date().getFullYear()

  // ─── Date range helper ────────────────────────────────────────────────────
  const dateFilter = useMemo(() => (date: Date): boolean => {
    if (filters.dateFrom && date < new Date(filters.dateFrom)) return false
    if (filters.dateTo && date > new Date(filters.dateTo + 'T23:59:59')) return false
    if (filters.quarter) {
      const q = parseInt(filters.quarter[1]) as 1 | 2 | 3 | 4
      const { start, end } = getQuarterRange(year, q)
      if (date.getTime() < start || date.getTime() > end) return false
    }
    if (filters.month) {
      const m = parseInt(filters.month) - 1
      if (date.getFullYear() !== year || date.getMonth() !== m) return false
    }
    return true
  }, [filters.dateFrom, filters.dateTo, filters.quarter, filters.month, year])

  // ─── Project Sales payment status helper ──────────────────────────────────
  const psPaymentMatch = (p: Project): boolean => {
    if (!filters.paymentStatus) return true
    const pays = p.payments ?? []
    const paidN = pays.filter((x) => x.status === 'paid').length
    if (filters.paymentStatus === 'belum_dp') return paidN === 0
    if (filters.paymentStatus === 'sudah_dp') return paidN > 0 && paidN < pays.length
    if (filters.paymentStatus === 'sudah_lunas') return paidN > 0 && paidN === pays.length
    return true
  }

  // ─── Filtered data ────────────────────────────────────────────────────────
  const filteredProjects = useMemo(() => {
    if (filters.projectType === 'satuan') return []
    return projects.filter((p) => {
      if (filters.salesId && p.salesPic !== filters.salesId) return false
      if (filters.projectStatus && p.status !== filters.projectStatus) return false
      if (filters.brand && p.category !== filters.brand) return false
      if (!psPaymentMatch(p)) return false
      const raw = (p as unknown as Record<string, unknown>).createdAt
      const created = raw ? (toDate(raw as never) ?? null) : null
      if (created && !dateFilter(created)) return false
      return true
    })
  }, [projects, filters, dateFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredLeads = useMemo(() => {
    if (filters.projectType === 'sales') return []
    return leads.filter((l) => {
      if (filters.salesId && l.assignedSales !== filters.salesId) return false
      if (filters.paymentStatus && l.dpPelunasan !== filters.paymentStatus) return false
      if (filters.brand && l.productCategory !== filters.brand) return false
      if (!dateFilter(l.lastFollowUp)) return false
      return true
    })
  }, [leads, filters, dateFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredGantts = useMemo(() => {
    return gantts.filter((g) => {
      if (filters.fabrikasiId) {
        const proj = projects.find((p) => p.id === g.projectId)
        if (!proj) return false
      }
      return true
    })
  }, [gantts, filters.fabrikasiId, projects])

  const filteredContent = useMemo(() =>
    content.filter((c) => {
      if (filters.mediaId && c.assignedTo !== filters.mediaId) return false
      return true
    }),
  [content, filters.mediaId])

  const filteredInstalls = useMemo(() =>
    installs.filter((i) => {
      if (filters.fabrikasiId && i.picInstalasi !== filters.fabrikasiId) return false
      return true
    }),
  [installs, filters.fabrikasiId])

  // ─── KPI values ──────────────────────────────────────────────────────────
  const pipelineValue  = filteredProjects.reduce((s, p) => s + (p.estimatedValue ?? 0), 0)
  const activeProjects = filteredProjects.filter((p) => p.status === 'active')
  const activeGantts   = filteredGantts.filter((g) => g.status === 'active')
  const activeTickets  = afterSales.filter((t) => !['selesai', 'cancel'].includes(t.ticketStatus))
  const urgentCount    = activeTickets.filter((t) => ['urgent', 'high'].includes(t.priority)).length

  // ─── Monthly chart (last 12 months within filtered period) ────────────────
  const monthlyChartData = useMemo(() => {
    let months: Date[]
    if (filters.quarter) {
      const q = parseInt(filters.quarter[1]) as 1 | 2 | 3 | 4
      months = [0, 1, 2].map((i) => new Date(year, (q - 1) * 3 + i, 1))
    } else if (filters.month) {
      const m = parseInt(filters.month) - 1
      months = [-2, -1, 0, 1, 2].map((i) => new Date(year, m + i, 1)).filter((d) => d.getFullYear() === year)
    } else {
      months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1))
    }
    return months.map((m) => {
      const s = startOfMonth(m).getTime()
      const e = endOfMonth(m).getTime()
      const qP = filteredProjects.filter((p) => {
        const raw = (p as unknown as Record<string, unknown>).createdAt
        const t = raw ? (toDate(raw as never) ?? new Date(0)).getTime() : 0
        return t >= s && t <= e
      })
      const qL = filteredLeads.filter((l) => l.lastFollowUp.getTime() >= s && l.lastFollowUp.getTime() <= e)
      return {
        bulan: format(m, 'MMM', { locale: localeId }),
        'Project Sales': qP.length,
        'Satuan Masuk': qL.length,
        'Satuan Lunas': qL.filter((l) => l.dpPelunasan === 'sudah_lunas').length,
      }
    })
  }, [filteredProjects, filteredLeads, filters.quarter, filters.month, year])

  // ─── Quarterly chart (always Q1-Q4, but filtered data) ───────────────────
  const quarterlyChartData = useMemo(() =>
    ([1, 2, 3, 4] as const).map((q) => {
      const { start, end } = getQuarterRange(year, q)
      const qP = filteredProjects.filter((p) => {
        const raw = (p as unknown as Record<string, unknown>).createdAt
        const t = raw ? (toDate(raw as never) ?? new Date(0)).getTime() : 0
        return t >= start && t <= end
      })
      const qL = filteredLeads.filter((l) => l.lastFollowUp.getTime() >= start && l.lastFollowUp.getTime() <= end)
      const isActive = filters.quarter === `Q${q}`
      return {
        quarter: `Q${q}`,
        'Project Sales': qP.length,
        'Satuan Masuk': qL.length,
        'Satuan Lunas': qL.filter((l) => l.dpPelunasan === 'sudah_lunas').length,
        isActive,
      }
    }),
  [filteredProjects, filteredLeads, filters.quarter, year])

  // ─── Payment status breakdown ─────────────────────────────────────────────
  const psPayment = useMemo(() => ({
    belum:  activeProjects.filter((p) => !p.payments?.some((x) => x.status === 'paid')).length,
    dp:     activeProjects.filter((p) => {
      const paid = (p.payments ?? []).filter((x) => x.status === 'paid').length
      return paid > 0 && paid < (p.payments ?? []).length
    }).length,
    lunas:  activeProjects.filter((p) => {
      const pays = p.payments ?? []
      return pays.length > 0 && pays.every((x) => x.status === 'paid')
    }).length,
  }), [activeProjects])

  const slPayment = useMemo(() => ({
    belum: filteredLeads.filter((l) => !l.dpPelunasan || l.dpPelunasan === 'belum_dp').length,
    dp:    filteredLeads.filter((l) => l.dpPelunasan === 'sudah_dp').length,
    lunas: filteredLeads.filter((l) => l.dpPelunasan === 'sudah_lunas').length,
  }), [filteredLeads])

  // ─── Sales Performance ───────────────────────────────────────────────────
  const salesPerformance = useMemo(() => {
    return salesUsers.map((u) => {
      const myProjects = filteredProjects.filter((p) => p.salesPic === u.id)
      const myLeads    = filteredLeads.filter((l) => l.assignedSales === u.id)
      const totalValue = myProjects.reduce((s, p) => s + (p.estimatedValue ?? 0), 0)
      const projectSelesai = myProjects.filter((p) => p.status === 'completed').length
      const leadLunas  = myLeads.filter((l) => l.dpPelunasan === 'sudah_lunas').length
      const totalHandled = myProjects.length + myLeads.length
      const closing = projectSelesai + leadLunas
      const closingRate = totalHandled > 0 ? Math.round(closing / totalHandled * 100) : 0
      return { user: u, projectSales: myProjects.length, projectSatuan: myLeads.length, totalHandled, totalValue, closingRate, closing }
    }).sort((a, b) => b.totalHandled - a.totalHandled || b.totalValue - a.totalValue)
  }, [salesUsers, filteredProjects, filteredLeads])

  // ─── Reminders ───────────────────────────────────────────────────────────
  const reminders = useMemo(() => {
    const items: { label: string; sub: string; type: 'danger' | 'warning' | 'info' }[] = []
    activeTickets
      .filter((t) => ['urgent', 'high'].includes(t.priority))
      .slice(0, 3)
      .forEach((t) => items.push({
        label: `After Sales: ${t.machineName}`,
        sub: `${t.customerName ?? '—'} — ${t.priority.toUpperCase()}`,
        type: t.priority === 'urgent' ? 'danger' : 'warning',
      }))
    filteredGantts
      .filter((g) => g.status === 'active' && differenceInDays(g.overallDeadline, new Date()) < 0)
      .slice(0, 3)
      .forEach((g) => items.push({
        label: `Produksi Overdue: ${g.projectName}`,
        sub: `Terlambat ${Math.abs(differenceInDays(g.overallDeadline, new Date()))} hari`,
        type: 'danger',
      }))
    filteredInstalls
      .filter((i) => i.status !== 'selesai' && differenceInDays(i.deadline, new Date()) <= 3)
      .slice(0, 3)
      .forEach((i) => items.push({
        label: `Instalasi: ${i.projectName ?? '—'}`,
        sub: differenceInDays(i.deadline, new Date()) < 0
          ? `Terlambat ${Math.abs(differenceInDays(i.deadline, new Date()))} hari`
          : `Deadline ${differenceInDays(i.deadline, new Date())} hari lagi`,
        type: differenceInDays(i.deadline, new Date()) < 0 ? 'danger' : 'warning',
      }))
    filteredContent
      .filter((c) => c.status !== 'selesai' && differenceInDays(c.deadline, new Date()) <= 3)
      .slice(0, 2)
      .forEach((c) => items.push({
        label: `Konten: ${c.productName}`,
        sub: `Deadline ${format(c.deadline, 'd MMM', { locale: localeId })}`,
        type: 'info',
      }))
    return items
  }, [activeTickets, filteredGantts, filteredInstalls, filteredContent])

  // ─── Active filter chips ──────────────────────────────────────────────────
  const chipMap = (
    [
      { key: 'quarter' as const, label: `Kuartal: ${filters.quarter}` },
      { key: 'month' as const, label: `Bulan: ${filters.month ? format(new Date(year, parseInt(filters.month) - 1, 1), 'MMMM', { locale: localeId }) : ''}` },
      { key: 'dateFrom' as const, label: `Dari: ${filters.dateFrom}` },
      { key: 'dateTo' as const, label: `Sampai: ${filters.dateTo}` },
      { key: 'salesId' as const, label: `Sales: ${salesUsers.find(u => u.id === filters.salesId)?.name ?? ''}` },
      { key: 'projectStatus' as const, label: `Status: ${filters.projectStatus === 'active' ? 'Aktif' : filters.projectStatus === 'completed' ? 'Selesai' : 'Dibatalkan'}` },
      { key: 'projectType' as const, label: `Jenis: ${filters.projectType === 'sales' ? 'Project Sales' : 'Project Satuan'}` },
      { key: 'paymentStatus' as const, label: `Bayar: ${filters.paymentStatus === 'belum_dp' ? 'Belum DP' : filters.paymentStatus === 'sudah_dp' ? 'Sudah DP' : 'Lunas'}` },
      { key: 'fabrikasiId' as const, label: `Fabrikasi: ${fabUsers.find(u => u.id === filters.fabrikasiId)?.name ?? ''}` },
      { key: 'mediaId' as const, label: `Media: ${mediaUsers.find(u => u.id === filters.mediaId)?.name ?? ''}` },
      { key: 'brand' as const, label: `Brand: ${filters.brand}` },
    ] satisfies { key: keyof Filters; label: string }[]
  ).filter(({ key }) => {
    if (key === 'projectStatus') return filters.projectStatus !== '' && filters.projectStatus !== 'active'
    return filters[key] !== ''
  })

  const tooltipStyle = { fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)' }

  return (
    <div className="space-y-4">
      {/* ── Header + Filter toggle ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Ringkasan operasional Sudijaya Group — {year}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {nActive > 0 && (
            <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" /> Reset
            </button>
          )}
          <button
            onClick={() => setShowFilter((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors',
              showFilter || nActive > 0
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-accent'
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            Filter
            {nActive > 0 && (
              <span className="ml-0.5 w-4 h-4 rounded-full bg-primary-foreground text-primary text-[10px] font-bold flex items-center justify-center">
                {nActive}
              </span>
            )}
            {showFilter ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
          </button>
        </div>
      </div>

      {/* ── Filter Panel ─────────────────────────────────────────────────────── */}
      {showFilter && (
        <FilterPanel
          filters={filters}
          onChange={mergeFilter}
          salesUsers={salesUsers}
          fabrikasiUsers={fabUsers}
          mediaUsers={mediaUsers}
        />
      )}

      {/* ── Active filter chips ───────────────────────────────────────────────── */}
      {!showFilter && chipMap.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chipMap.map(({ key, label }) => (
            <span key={key}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-medium">
              {label}
              <button onClick={() => mergeFilter({ [key]: key === 'projectStatus' ? 'active' : '' } as Partial<Filters>)}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          1. KPI UTAMA
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Pipeline Value" value={fmt(pipelineValue)}
          sub={`${activeProjects.length} project sales${filters.projectType === 'satuan' ? ' (difilter)' : ''}`}
          icon={TrendingUp} iconBg="bg-blue-50 dark:bg-blue-950" iconColor="text-blue-500" />
        <KpiCard label="Project Satuan" value={String(filteredLeads.length)}
          sub={`${slPayment.lunas} lunas · ${slPayment.dp} sudah DP`}
          icon={Users} iconBg="bg-violet-50 dark:bg-violet-950" iconColor="text-violet-500" />
        <KpiCard label="Dalam Produksi" value={String(activeGantts.length)}
          sub={`${activeGantts.filter(g => differenceInDays(g.overallDeadline, new Date()) < 0).length} overdue`}
          icon={Package} iconBg="bg-orange-50 dark:bg-orange-950" iconColor="text-orange-500" />
        <KpiCard label="After Sales Aktif" value={String(activeTickets.length)}
          sub={urgentCount > 0 ? `${urgentCount} prioritas tinggi` : 'Semua terkendali'}
          icon={urgentCount > 0 ? AlertTriangle : CheckCircle2}
          iconBg={urgentCount > 0 ? 'bg-red-50 dark:bg-red-950' : 'bg-green-50 dark:bg-green-950'}
          iconColor={urgentCount > 0 ? 'text-red-500' : 'text-green-500'} />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          2. GRAFIK PENJUALAN BULANAN & KUARTAL
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid lg:grid-cols-5 gap-4">
        {/* Bulanan */}
        <div className="lg:col-span-3 bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-1">
            Grafik Penjualan Bulanan
            {filters.quarter && <span className="ml-1.5 text-xs font-normal text-muted-foreground">— {filters.quarter}</span>}
          </h2>
          <p className="text-xs text-muted-foreground mb-3">Project Sales & Satuan per bulan</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyChartData} barGap={3} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="bulan" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.4 }} contentStyle={tooltipStyle} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              {filters.projectType !== 'satuan' && <Bar dataKey="Project Sales" fill="#60a5fa" radius={[3,3,0,0]} maxBarSize={28} />}
              {filters.projectType !== 'sales'  && <Bar dataKey="Satuan Masuk" fill="#a78bfa" radius={[3,3,0,0]} maxBarSize={28} />}
              {filters.projectType !== 'sales'  && <Bar dataKey="Satuan Lunas" fill="#22c55e" radius={[3,3,0,0]} maxBarSize={28} />}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Kuartal */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-1">Penjualan per Kuartal — {year}</h2>
          <p className="text-xs text-muted-foreground mb-3">Q1 · Q2 · Q3 · Q4</p>
          {/* Summary chips */}
          <div className="flex gap-2 mb-3">
            {quarterlyChartData.map((q) => (
              <button key={q.quarter}
                onClick={() => mergeFilter({ quarter: filters.quarter === q.quarter ? '' : q.quarter as Quarter, month: '', dateFrom: '', dateTo: '' })}
                className={cn(
                  'flex-1 rounded-lg py-2 text-center border transition-colors',
                  q.isActive ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary/40'
                )}>
                <p className="text-[10px] font-semibold">{q.quarter}</p>
                <p className="text-base font-bold leading-tight">{q['Satuan Masuk'] + q['Project Sales']}</p>
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={quarterlyChartData} barGap={3} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="quarter" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.4 }} contentStyle={tooltipStyle} />
              {filters.projectType !== 'satuan' && <Bar dataKey="Project Sales" fill="#60a5fa" radius={[3,3,0,0]} maxBarSize={20} />}
              {filters.projectType !== 'sales'  && <Bar dataKey="Satuan Masuk" fill="#a78bfa" radius={[3,3,0,0]} maxBarSize={20} />}
              {filters.projectType !== 'sales'  && <Bar dataKey="Satuan Lunas" fill="#22c55e" radius={[3,3,0,0]} maxBarSize={20} />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          3. PERFORMA SALES
      ══════════════════════════════════════════════════════════════════════ */}
      {salesPerformance.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Award className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Performa Sales</h2>
            <span className="text-xs text-muted-foreground ml-auto">{salesPerformance.length} sales aktif</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {salesPerformance.map((s, idx) => {
              const rankColors = [
                'border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-950/20',
                'border-slate-300 dark:border-slate-600 bg-slate-50/40 dark:bg-slate-900/20',
                'border-orange-300 dark:border-orange-700 bg-orange-50/30 dark:bg-orange-950/10',
              ]
              const rankBadge = ['🥇', '🥈', '🥉']
              const cardCls = idx < 3 ? rankColors[idx] : 'border-border'
              return (
                <div key={s.user.id} className={cn('rounded-xl border p-4 space-y-3', cardCls)}>
                  {/* Header */}
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                      {s.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">
                        {idx < 3 && <span className="mr-1">{rankBadge[idx]}</span>}
                        {s.user.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{s.totalHandled} project ditangani</p>
                    </div>
                  </div>
                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-2 text-center">
                      <p className="text-base font-bold text-blue-600 dark:text-blue-400">{s.projectSales}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Sales</p>
                    </div>
                    <div className="rounded-lg bg-violet-50 dark:bg-violet-950/40 p-2 text-center">
                      <p className="text-base font-bold text-violet-600 dark:text-violet-400">{s.projectSatuan}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Satuan</p>
                    </div>
                  </div>
                  {/* Value & closing */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Nilai Pipeline</span>
                      <span className="font-semibold">{fmt(s.totalValue)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Selesai / Lunas</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">{s.closing} project</span>
                    </div>
                    {/* Closing rate bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">Closing Rate</span>
                        <span className={cn('font-bold', s.closingRate >= 50 ? 'text-green-600 dark:text-green-400' : s.closingRate >= 25 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
                          {s.closingRate}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', s.closingRate >= 50 ? 'bg-green-500' : s.closingRate >= 25 ? 'bg-amber-400' : 'bg-gray-400')}
                          style={{ width: `${s.closingRate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          4. PROJECT AKTIF
      ══════════════════════════════════════════════════════════════════════ */}
      {filters.projectType !== 'satuan' && activeProjects.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-3">Project Sales Aktif ({activeProjects.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left pb-2 font-medium text-muted-foreground text-xs">Project</th>
                  <th className="text-left pb-2 font-medium text-muted-foreground text-xs">Customer</th>
                  <th className="text-left pb-2 font-medium text-muted-foreground text-xs">Brand</th>
                  <th className="text-left pb-2 font-medium text-muted-foreground text-xs">Tahap</th>
                  <th className="text-right pb-2 font-medium text-muted-foreground text-xs">Nilai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activeProjects.slice(0, 8).map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20">
                    <td className="py-2 font-medium text-xs max-w-[150px] truncate">{p.name}</td>
                    <td className="py-2 text-muted-foreground text-xs max-w-[120px] truncate">{p.customerName ?? '—'}</td>
                    <td className="py-2 text-xs"><span className="px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded text-[10px]">{p.category}</span></td>
                    <td className="py-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap"
                        style={{ background: STAGE_COLORS[p.pipelineStage] + '22', color: STAGE_COLORS[p.pipelineStage], border: `1px solid ${STAGE_COLORS[p.pipelineStage]}44` }}>
                        {STAGE_LABELS[p.pipelineStage]}
                      </span>
                    </td>
                    <td className="py-2 text-right text-xs font-semibold whitespace-nowrap">{fmt(p.estimatedValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {activeProjects.length > 8 && <p className="text-xs text-muted-foreground mt-2 text-right">+{activeProjects.length - 8} project lainnya</p>}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          5. STATUS PEMBAYARAN DP & PELUNASAN
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Project Sales payment */}
        {filters.projectType !== 'satuan' && (
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Pembayaran — Project Sales</h2>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Belum DP', value: psPayment.belum, color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-800' },
                { label: 'Sudah DP', value: psPayment.dp,    color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900' },
                { label: 'Lunas',    value: psPayment.lunas,  color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900' },
              ].map((item) => (
                <div key={item.label} className={cn('rounded-lg p-3 text-center', item.bg)}>
                  <p className={cn('text-xl font-bold', item.color)}>{item.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
            {activeProjects.length > 0 && (
              <div className="h-2 bg-secondary rounded-full overflow-hidden flex">
                <div className="h-full bg-gray-400" style={{ width: `${Math.round(psPayment.belum / activeProjects.length * 100)}%` }} />
                <div className="h-full bg-amber-400" style={{ width: `${Math.round(psPayment.dp / activeProjects.length * 100)}%` }} />
                <div className="h-full bg-green-500" style={{ width: `${Math.round(psPayment.lunas / activeProjects.length * 100)}%` }} />
              </div>
            )}
          </div>
        )}

        {/* Project Satuan payment */}
        {filters.projectType !== 'sales' && (
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Pembayaran — Project Satuan</h2>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Belum DP', value: slPayment.belum, color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-800' },
                { label: 'Sudah DP', value: slPayment.dp,    color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900' },
                { label: 'Lunas',    value: slPayment.lunas,  color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900' },
              ].map((item) => (
                <div key={item.label} className={cn('rounded-lg p-3 text-center', item.bg)}>
                  <p className={cn('text-xl font-bold', item.color)}>{item.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
            {filteredLeads.length > 0 && (
              <div className="h-2 bg-secondary rounded-full overflow-hidden flex">
                <div className="h-full bg-gray-400" style={{ width: `${Math.round(slPayment.belum / filteredLeads.length * 100)}%` }} />
                <div className="h-full bg-amber-400" style={{ width: `${Math.round(slPayment.dp / filteredLeads.length * 100)}%` }} />
                <div className="h-full bg-green-500" style={{ width: `${Math.round(slPayment.lunas / filteredLeads.length * 100)}%` }} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          6. PROGRESS FABRIKASI
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Progress Fabrikasi</h2>
          </div>
          <div className="flex gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" />{activeGantts.length} aktif</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />{activeGantts.filter(g => differenceInDays(g.overallDeadline, new Date()) < 0).length} overdue</span>
          </div>
        </div>
        {activeGantts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Tidak ada produksi aktif</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {activeGantts.map((g) => {
              const daysLeft = differenceInDays(g.overallDeadline, new Date())
              const overdue  = daysLeft < 0
              const urgent   = !overdue && daysLeft <= 7
              const proj     = projects.find((p) => p.id === g.projectId)
              return (
                <div key={g.id} className={cn('rounded-xl border p-3.5 space-y-2.5',
                  overdue ? 'border-red-300 dark:border-red-800 bg-red-50/30 dark:bg-red-950/20' :
                  urgent  ? 'border-amber-300 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20' :
                  'border-border')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{g.projectName}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{proj?.customerName ?? ''}</p>
                    </div>
                    {overdue ? <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" /> :
                     urgent  ? <Clock className="h-4 w-4 text-amber-500 shrink-0" /> :
                               <Package className="h-4 w-4 text-orange-400 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <CalendarDays className="h-3 w-3" />
                    {format(g.overallDeadline, 'd MMM yyyy', { locale: localeId })}
                  </div>
                  <div className={cn('text-center py-1 rounded text-[11px] font-semibold',
                    overdue ? 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400' :
                    urgent  ? 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400' :
                    'bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400')}>
                    {overdue ? `Terlambat ${Math.abs(daysLeft)} hari` : daysLeft === 0 ? 'Deadline hari ini' : `${daysLeft} hari lagi`}
                  </div>
                  {proj && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STAGE_COLORS[proj.pipelineStage] }} />
                      <span className="text-[10px] text-muted-foreground">{STAGE_LABELS[proj.pipelineStage]}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          7. KONTEN MEDIA
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Image className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Konten Media</h2>
          <span className="text-xs text-muted-foreground ml-auto">{filteredContent.length} total request</span>
        </div>
        {/* Status breakdown */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {(['baru','diproses','revisi','selesai'] as const).map((s) => {
            const count = filteredContent.filter((c) => c.status === s).length
            return (
              <div key={s} className={cn('rounded-lg p-3 text-center', CONTENT_STATUS_COLORS[s])}>
                <p className="text-lg font-bold">{count}</p>
                <p className="text-[10px] mt-0.5">{CONTENT_STATUS_LABELS[s]}</p>
              </div>
            )
          })}
        </div>
        {/* Active content list */}
        <div className="space-y-1.5">
          {filteredContent.filter((c) => c.status !== 'selesai').slice(0, 5).map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg border border-border hover:bg-muted/20">
              <span className={cn('px-1.5 py-0.5 text-[10px] rounded font-medium whitespace-nowrap shrink-0', CONTENT_STATUS_COLORS[c.status])}>
                {CONTENT_STATUS_LABELS[c.status]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{c.productName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{c.contentType} · {mediaUsers.find(u => u.id === c.assignedTo)?.name ?? 'Belum ditugaskan'}</p>
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {format(c.deadline, 'd MMM', { locale: localeId })}
              </span>
            </div>
          ))}
          {filteredContent.filter((c) => c.status !== 'selesai').length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">Semua konten sudah selesai</p>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          8. REMINDER / TUGAS PENTING
      ══════════════════════════════════════════════════════════════════════ */}
      {reminders.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold">Reminder & Tugas Penting</h2>
            <span className="ml-auto text-xs px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 rounded-full font-medium">
              {reminders.length} item
            </span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {reminders.map((r, i) => (
              <div key={i} className={cn('flex items-start gap-2.5 p-2.5 rounded-lg border',
                r.type === 'danger' ? 'border-red-200 bg-red-50/40 dark:border-red-800 dark:bg-red-950/20' :
                r.type === 'warning' ? 'border-amber-200 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/20' :
                'border-blue-200 bg-blue-50/40 dark:border-blue-800 dark:bg-blue-950/20')}>
                <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0',
                  r.type === 'danger' ? 'bg-red-500' : r.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500')} />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{r.label}</p>
                  <p className="text-[10px] text-muted-foreground">{r.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          9. TABEL DETAIL PROJECT
      ══════════════════════════════════════════════════════════════════════ */}
      {filters.projectType !== 'sales' && filteredLeads.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-3">Detail Project Satuan ({filteredLeads.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Customer','Produk','Brand','Sales','Pembayaran'].map((h) => (
                    <th key={h} className="text-left pb-2 font-medium text-muted-foreground text-xs whitespace-nowrap pr-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLeads.slice(0, 10).map((l) => (
                  <tr key={l.id} className="hover:bg-muted/20">
                    <td className="py-2 font-medium text-xs max-w-[140px] truncate pr-3">{l.customerName ?? '—'}</td>
                    <td className="py-2 text-xs text-muted-foreground max-w-[140px] truncate pr-3">{l.productName}</td>
                    <td className="py-2 pr-3"><span className="px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded text-[10px]">{l.productCategory}</span></td>
                    <td className="py-2 text-xs text-muted-foreground whitespace-nowrap pr-3">{salesUsers.find(u => u.id === l.assignedSales)?.name ?? '—'}</td>
                    <td className="py-2">
                      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap',
                        l.dpPelunasan === 'sudah_lunas' ? 'bg-green-100 text-green-700 dark:bg-green-950' :
                        l.dpPelunasan === 'sudah_dp'    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950' :
                        'bg-gray-100 text-gray-600 dark:bg-gray-800')}>
                        {l.dpPelunasan === 'sudah_lunas' ? 'Lunas' : l.dpPelunasan === 'sudah_dp' ? 'Sudah DP' : 'Belum DP'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredLeads.length > 10 && <p className="text-xs text-muted-foreground mt-2 text-right">+{filteredLeads.length - 10} data lainnya</p>}
        </div>
      )}

      {filters.projectType !== 'satuan' && filteredProjects.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-3">Detail Project Sales ({filteredProjects.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Nama Project','Customer','Brand','Sales','Tahap','Pembayaran','Nilai'].map((h) => (
                    <th key={h} className="text-left pb-2 font-medium text-muted-foreground text-xs whitespace-nowrap pr-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredProjects.slice(0, 10).map((p) => {
                  const paidN = (p.payments ?? []).filter(x => x.status === 'paid').length
                  const totalN = (p.payments ?? []).length
                  const payLabel = paidN === 0 ? 'Belum DP' : paidN === totalN && totalN > 0 ? 'Lunas' : 'Sudah DP'
                  const payColor = paidN === 0 ? 'bg-gray-100 text-gray-600 dark:bg-gray-800' :
                    paidN === totalN && totalN > 0 ? 'bg-green-100 text-green-700 dark:bg-green-950' :
                    'bg-amber-100 text-amber-700 dark:bg-amber-950'
                  return (
                    <tr key={p.id} className="hover:bg-muted/20">
                      <td className="py-2 font-medium text-xs max-w-[150px] truncate pr-3">{p.name}</td>
                      <td className="py-2 text-xs text-muted-foreground max-w-[120px] truncate pr-3">{p.customerName ?? '—'}</td>
                      <td className="py-2 pr-3"><span className="px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded text-[10px]">{p.category}</span></td>
                      <td className="py-2 text-xs text-muted-foreground whitespace-nowrap pr-3">{salesUsers.find(u => u.id === p.salesPic)?.name ?? '—'}</td>
                      <td className="py-2 pr-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap"
                          style={{ background: STAGE_COLORS[p.pipelineStage] + '22', color: STAGE_COLORS[p.pipelineStage], border: `1px solid ${STAGE_COLORS[p.pipelineStage]}44` }}>
                          {STAGE_LABELS[p.pipelineStage]}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap', payColor)}>{payLabel}</span>
                      </td>
                      <td className="py-2 text-xs font-semibold whitespace-nowrap">{fmt(p.estimatedValue)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filteredProjects.length > 10 && <p className="text-xs text-muted-foreground mt-2 text-right">+{filteredProjects.length - 10} data lainnya</p>}
        </div>
      )}
    </div>
  )
}
