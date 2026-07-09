import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Loader2, Plus, Trash2, X, Wallet, TrendingUp, Clock, CheckCircle2, Pencil } from 'lucide-react'
import { cn } from '@/utils/cn'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { toDate } from '@/utils/firestore'
import type { Project, Payment, Lead, DpPelunasanStatus, User, DrawingRequest } from '@/types'
import { subscribeToCollection, updateDocument, createDoc, where } from '@/services/firestore.service'
import { notifyShipmentReady, notifyMeetingFabrikasi } from '@/services/notification.service'
import { useAuthStore } from '@/store/authStore'
import { Pagination } from '@/components/common/Pagination'

const PAGE_SIZE = 15

const currency = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

const shortCost = (n: number) => {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(n % 1_000_000_000 === 0 ? 0 : 1) + ' M'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + ' jt'
  return (n / 1_000).toFixed(0) + ' rb'
}

// ─── Payment Plan Modal ────────────────────────────────────────────────────────
interface TerminItem { label: string; percentage: number }

const SCHEMES = [
  { id: 'dp60', label: 'DP 60% + Lunas 40%', termins: [{ label: 'DP 60%', percentage: 60 }, { label: 'Pelunasan 40%', percentage: 40 }] },
  { id: 'dp50', label: 'DP 50% + Lunas 50%', termins: [{ label: 'DP 50%', percentage: 50 }, { label: 'Pelunasan 50%', percentage: 50 }] },
  { id: 'full', label: 'Full Payment 100%', termins: [{ label: 'Full Payment', percentage: 100 }] },
  { id: 'custom', label: 'Custom Termin', termins: [] },
] as const
type SchemeId = typeof SCHEMES[number]['id']

interface PlanModalProps {
  title: string
  totalValue: number
  onSave: (payments: Payment[]) => Promise<void>
  onClose: () => void
}

function PlanModal({ title, totalValue, onSave, onClose }: PlanModalProps) {
  const [scheme, setScheme] = useState<SchemeId>('dp60')
  const [termins, setTermins] = useState<TerminItem[]>([
    { label: 'DP 60%', percentage: 60 },
    { label: 'Pelunasan 40%', percentage: 40 },
  ])
  const [saving, setSaving] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  const changeScheme = (s: SchemeId) => {
    setScheme(s)
    const found = SCHEMES.find((x) => x.id === s)
    if (s !== 'custom' && found && found.termins.length) setTermins([...found.termins])
    else if (s === 'custom') setTermins([{ label: 'Termin 1', percentage: 100 }])
  }

  const totalPct = termins.reduce((s, t) => s + t.percentage, 0)
  const isValid = totalValue > 0 && termins.length > 0 && totalPct === 100

  const handleSave = async () => {
    if (!isValid) return
    setSaving(true)
    try {
      await onSave(termins.map((t) => ({
        label: t.label,
        percentage: t.percentage,
        amount: Math.round(totalValue * (t.percentage / 100)),
        status: 'pending' as const,
        date: new Date(),
      })))
    } finally { setSaving(false) }
  }

  const modal = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div>
            <h3 className="font-semibold">{title}</h3>
            {totalValue > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">Total: {currency(totalValue)}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-accent rounded-md transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto p-5 space-y-5 flex-1">
          {/* Skema */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Skema Pembayaran</p>
            <div className="grid grid-cols-2 gap-2">
              {SCHEMES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => changeScheme(s.id)}
                  className={cn(
                    'px-3 py-2 text-xs rounded-lg border text-left transition-colors',
                    scheme === s.id
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border hover:border-primary/50 hover:bg-accent'
                  )}
                >{s.label}</button>
              ))}
            </div>
          </div>

          {/* Termin table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">Rincian Termin</p>
              {scheme === 'custom' && (
                <button
                  onClick={() => setTermins([...termins, { label: `Termin ${termins.length + 1}`, percentage: 0 }])}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Tambah Termin
                </button>
              )}
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left p-2 font-medium text-muted-foreground">Label</th>
                    <th className="text-center p-2 font-medium text-muted-foreground w-20">Persen</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Jumlah</th>
                    {scheme === 'custom' && <th className="w-8" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {termins.map((t, i) => (
                    <tr key={i}>
                      <td className="p-2">
                        <input
                          value={t.label}
                          disabled={scheme !== 'custom'}
                          onChange={(e) => setTermins(termins.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                          className="w-full px-2 py-1 border border-input rounded text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:bg-transparent disabled:border-transparent"
                        />
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1 justify-center">
                          <input
                            type="number" min="0" max="100"
                            value={t.percentage}
                            disabled={scheme !== 'custom'}
                            onChange={(e) => setTermins(termins.map((x, j) => j === i ? { ...x, percentage: Number(e.target.value) } : x))}
                            className="w-12 px-1.5 py-1 border border-input rounded text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:bg-transparent disabled:border-transparent text-center"
                          />
                          <span className="text-muted-foreground">%</span>
                        </div>
                      </td>
                      <td className="p-2 text-right font-medium">
                        {currency(Math.round(totalValue * (t.percentage / 100)))}
                      </td>
                      {scheme === 'custom' && (
                        <td className="p-2 text-center">
                          {termins.length > 1 && (
                            <button
                              onClick={() => setTermins(termins.filter((_, j) => j !== i))}
                              className="text-destructive hover:bg-destructive/10 p-1 rounded"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/20 border-t border-border">
                    <td className="p-2 font-medium">Total</td>
                    <td className={cn('p-2 text-center font-medium', totalPct !== 100 ? 'text-destructive' : 'text-green-600')}>
                      {totalPct}%
                    </td>
                    <td className="p-2 text-right font-semibold">{currency(totalValue)}</td>
                    {scheme === 'custom' && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>

            {totalPct !== 100 && (
              <p className="text-xs text-destructive mt-1.5">Total persentase harus 100%</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-5 border-t border-border shrink-0">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors">
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors hover:bg-primary/90"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Simpan Termin
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

// ─── Project Sales Table ───────────────────────────────────────────────────────
interface SalesRow {
  projectId: string
  projectName: string
  customerName: string
  totalValue: number
  terminIdx: number | null
  terminLabel: string | null
  amount: number | null
  percentage: number | null
  status: 'paid' | 'pending' | null
  paidDate: Date | null
  isFirst: boolean
  rowSpan: number
}

function buildSalesRows(projects: Project[]): SalesRow[] {
  const rows: SalesRow[] = []
  for (const p of projects) {
    if (p.payments.length === 0) {
      rows.push({
        projectId: p.id, projectName: p.name, customerName: p.customerName ?? '-',
        totalValue: p.estimatedValue, terminIdx: null, terminLabel: null,
        amount: null, percentage: null, status: null, paidDate: null,
        isFirst: true, rowSpan: 1,
      })
    } else {
      p.payments.forEach((pay, i) => {
        rows.push({
          projectId: p.id, projectName: p.name, customerName: p.customerName ?? '-',
          totalValue: p.estimatedValue, terminIdx: i,
          terminLabel: pay.label ?? `Termin ${i + 1}`,
          amount: pay.amount, percentage: pay.percentage,
          status: pay.status, paidDate: pay.status === 'paid' ? new Date(pay.date) : null,
          isFirst: i === 0, rowSpan: i === 0 ? p.payments.length : 0,
        })
      })
    }
  }
  return rows
}

function ProjectSalesSection({
  projects, drawingRequests, fabrikasiIds, adminIds, currentUserId, salesUsers,
}: {
  projects: Project[]
  drawingRequests: DrawingRequest[]
  fabrikasiIds: string[]
  adminIds: string[]
  currentUserId: string
  salesUsers: User[]
}) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'lunas' | 'belum_lunas'>('all')
  const [page, setPage] = useState(1)
  const [planModal, setPlanModal] = useState<Project | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  const filtered = projects.filter((p) => {
    const q = search.toLowerCase()
    const match = p.name.toLowerCase().includes(q) || (p.customerName ?? '').toLowerCase().includes(q)
    const isLunas = p.payments.length > 0 && p.payments.every((x) => x.status === 'paid')
    const matchStatus = filterStatus === 'all' || (filterStatus === 'lunas' ? isLunas : !isLunas)
    return match && matchStatus
  })

  const allRows = buildSalesRows(filtered)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginatedProjects = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const rows = buildSalesRows(paginatedProjects)

  const markPaid = async (project: Project, index: number) => {
    setSaving(project.id + '_' + index)
    try {
      const newPayments = project.payments.map((p, i) =>
        i === index ? { ...p, status: 'paid' as const, date: new Date() } : p
      )
      const paidCount = newPayments.filter((p) => p.status === 'paid').length

      await updateDocument('projects', project.id, { payments: newPayments })

      // DP pertama dibayar + stage dp_layout → cek drawing request, maju ke meeting_fabrikasi
      if (paidCount === 1 && project.pipelineStage === 'dp_layout') {
        const drawingDone = drawingRequests.some(
          (d) => d.projectId === project.id && d.status === 'done'
        )
        if (drawingDone) {
          await updateDocument('projects', project.id, { pipelineStage: 'meeting_fabrikasi' })
          await notifyMeetingFabrikasi(project.salesPic, fabrikasiIds, project.name, project.id)
        }
      }
    } finally { setSaving(null) }
  }

  const savePlan = async (payments: Payment[]) => {
    if (!planModal) return
    await updateDocument('projects', planModal.id, { payments })
    setPlanModal(null)
  }

  const getProject = (id: string) => projects.find((p) => p.id === id)!

  // ── KPI computations (dari semua projects, bukan filtered) ──
  const totalKontrak   = projects.reduce((s, p) => s + p.estimatedValue, 0)
  const totalMasuk     = projects.reduce((s, p) => s + p.payments.filter((pay) => pay.status === 'paid').reduce((a, pay) => a + pay.amount, 0), 0)
  const totalPending   = projects.reduce((s, p) => s + p.payments.filter((pay) => pay.status === 'pending').reduce((a, pay) => a + pay.amount, 0), 0)
  const lunasProjects  = projects.filter((p) => p.payments.length > 0 && p.payments.every((pay) => pay.status === 'paid'))
  const lunasNilai     = lunasProjects.reduce((s, p) => s + p.estimatedValue, 0)

  const salesKpiCards = [
    {
      label: 'Total Kontrak',
      count: projects.length,
      nilai: totalKontrak,
      icon: <TrendingUp className="h-5 w-5" />,
      color: 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400',
      filter: null as 'all' | 'lunas' | 'belum_lunas' | null,
    },
    {
      label: 'Sudah Masuk',
      count: projects.filter((p) => p.payments.some((pay) => pay.status === 'paid')).length,
      nilai: totalMasuk,
      icon: <Wallet className="h-5 w-5" />,
      color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
      filter: null as 'all' | 'lunas' | 'belum_lunas' | null,
    },
    {
      label: 'Menunggu Bayar',
      count: projects.filter((p) => p.payments.some((pay) => pay.status === 'pending')).length,
      nilai: totalPending,
      icon: <Clock className="h-5 w-5" />,
      color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400',
      filter: 'belum_lunas' as 'all' | 'lunas' | 'belum_lunas' | null,
    },
    {
      label: 'Lunas',
      count: lunasProjects.length,
      nilai: lunasNilai,
      icon: <CheckCircle2 className="h-5 w-5" />,
      color: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400',
      filter: 'lunas' as 'all' | 'lunas' | 'belum_lunas' | null,
    },
  ]

  return (
    <div className="space-y-3">
      {/* KPI Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {salesKpiCards.map((c) => {
          const isActive = c.filter !== null && filterStatus === c.filter
          return (
            <button
              key={c.label}
              onClick={() => {
                if (!c.filter) return
                setFilterStatus(isActive ? 'all' : c.filter)
                setPage(1)
              }}
              className={cn(
                'bg-card border rounded-xl p-4 text-left transition-all',
                c.filter ? 'cursor-pointer hover:shadow-md' : 'cursor-default',
                isActive ? 'border-primary ring-1 ring-primary/30' : 'border-border'
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={cn('p-2 rounded-lg', c.color)}>{c.icon}</span>
                <span className="text-2xl font-bold">{c.count}</span>
              </div>
              <p className="text-sm font-medium">{c.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {c.nilai > 0 ? `Rp ${shortCost(c.nilai)}` : '—'}
              </p>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="Cari nama project atau customer..."
          className="flex-1 min-w-[200px] px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value as typeof filterStatus); setPage(1) }}
          className="px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Semua Status</option>
          <option value="lunas">Lunas</option>
          <option value="belum_lunas">Belum Lunas</option>
        </select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground">Nama Project</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Customer</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Total Kontrak</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Termin</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Jumlah</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Tgl Bayar</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, idx) => {
                const project = getProject(row.projectId)
                const savingKey = row.projectId + '_' + row.terminIdx
                return (
                  <tr key={row.projectId + '_' + (row.terminIdx ?? 'empty') + '_' + idx}
                    className={cn('transition-colors', row.isFirst && idx > 0 ? 'border-t-2 border-border' : '')}
                  >
                    {row.isFirst && (
                      <td className="p-3 font-medium align-top" rowSpan={row.rowSpan}>
                        {row.projectName}
                      </td>
                    )}
                    {row.isFirst && (
                      <td className="p-3 text-muted-foreground text-xs align-top" rowSpan={row.rowSpan}>
                        {row.customerName}
                      </td>
                    )}
                    {row.isFirst && (
                      <td className="p-3 font-medium text-xs align-top" rowSpan={row.rowSpan}>
                        {currency(row.totalValue)}
                      </td>
                    )}
                    {row.terminIdx === null ? (
                      <>
                        <td className="p-3 text-muted-foreground text-xs italic">Belum ada termin</td>
                        <td className="p-3" />
                        <td className="p-3" />
                        <td className="p-3" />
                        <td className="p-3 text-center">
                          <button
                            onClick={() => setPlanModal(project)}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Plus className="h-3 w-3" /> Catat Pembayaran
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-3 text-xs">{row.terminLabel}</td>
                        <td className="p-3 text-right font-medium text-xs">{currency(row.amount!)}</td>
                        <td className="p-3 text-center">
                          <span className={cn(
                            'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
                            row.status === 'paid'
                              ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                              : 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
                          )}>
                            {row.status === 'paid' ? 'Lunas' : 'Pending'}
                          </span>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {row.paidDate ? format(row.paidDate, 'd MMM yyyy', { locale: localeId }) : '-'}
                        </td>
                        <td className="p-3 text-center">
                          {row.status === 'pending' ? (
                            <button
                              onClick={() => markPaid(project, row.terminIdx!)}
                              disabled={saving === savingKey}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-500 hover:bg-green-600 text-white text-xs disabled:opacity-50 transition-colors"
                            >
                              {saving === savingKey
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Check className="h-3 w-3" />}
                              Tandai Lunas
                            </button>
                          ) : row.isFirst ? (
                            <button
                              onClick={() => setPlanModal(project)}
                              title="Ubah Termin"
                              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-muted-foreground">Belum ada data project</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {planModal && (
        <PlanModal
          title={`Atur Termin: ${planModal.name}`}
          totalValue={planModal.estimatedValue}
          onSave={savePlan}
          onClose={() => setPlanModal(null)}
        />
      )}
    </div>
  )
}

// ─── Project Satuan Table ──────────────────────────────────────────────────────
interface SatuanRow {
  leadId: string
  customerName: string
  productName: string
  salesName: string
  estimatedCost: number
  dpStatus: DpPelunasanStatus
  terminIdx: number | null
  terminLabel: string | null
  amount: number | null
  status: 'paid' | 'pending' | null
  paidDate: Date | null
  isFirst: boolean
  rowSpan: number
}

function buildSatuanRows(leads: Lead[], salesMap: Map<string, string>): SatuanRow[] {
  const rows: SatuanRow[] = []
  for (const l of leads) {
    const payments = l.payments ?? []
    const dp = l.dpPelunasan ?? 'belum_dp'
    if (payments.length === 0) {
      rows.push({
        leadId: l.id, customerName: l.customerName ?? '-', productName: l.productName,
        salesName: salesMap.get(l.assignedSales) ?? '-',
        estimatedCost: l.estimatedCost ?? 0, dpStatus: dp,
        terminIdx: null, terminLabel: null, amount: null, status: null, paidDate: null,
        isFirst: true, rowSpan: 1,
      })
    } else {
      payments.forEach((pay, i) => {
        rows.push({
          leadId: l.id, customerName: l.customerName ?? '-', productName: l.productName,
          salesName: salesMap.get(l.assignedSales) ?? '-',
          estimatedCost: l.estimatedCost ?? 0, dpStatus: dp,
          terminIdx: i, terminLabel: pay.label ?? `Termin ${i + 1}`,
          amount: pay.amount, status: pay.status,
          paidDate: pay.status === 'paid' ? new Date(pay.date) : null,
          isFirst: i === 0, rowSpan: i === 0 ? payments.length : 0,
        })
      })
    }
  }
  return rows
}

function ProjectSatuanSection({ leads, salesUsers, adminIds, currentUserId }: { leads: Lead[]; salesUsers: User[]; adminIds: string[]; currentUserId: string }) {
  const [search, setSearch] = useState('')
  const [filterDp, setFilterDp] = useState<DpPelunasanStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [planModal, setPlanModal] = useState<Lead | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  const salesMap = new Map(salesUsers.map((u) => [u.id, u.name]))

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase()
    const match = (l.customerName ?? '').toLowerCase().includes(q) || l.productName.toLowerCase().includes(q)
    const matchDp = filterDp === 'all' || (l.dpPelunasan ?? 'belum_dp') === filterDp
    return match && matchDp
  })

  const paginatedLeads = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const rows = buildSatuanRows(paginatedLeads, salesMap)

  const getLead = (id: string) => leads.find((l) => l.id === id)!

  const markPaid = async (lead: Lead, index: number) => {
    const payments = [...(lead.payments ?? [])].map((p, i) =>
      i === index ? { ...p, status: 'paid' as const, date: new Date() } : p
    )
    const paidCount = payments.filter((p) => p.status === 'paid').length
    const allPaid = paidCount === payments.length
    const wasLunas = (lead.dpPelunasan ?? 'belum_dp') === 'sudah_lunas'
    const updates: Record<string, unknown> = { payments }
    if (allPaid) { updates.dpPelunasan = 'sudah_lunas'; updates.pengiriman = 'proses' }
    else if (paidCount >= 1 && (lead.dpPelunasan ?? 'belum_dp') === 'belum_dp') updates.dpPelunasan = 'sudah_dp'

    setSaving(lead.id + '_' + index)
    try {
      await updateDocument('leads', lead.id, updates)
      if (allPaid && !wasLunas) {
        await createDoc('shipments', {
          projectId: lead.id,
          projectName: `${lead.customerName ?? '-'} — ${lead.productName}`,
          leadId: lead.id,
          picSalesId: lead.assignedSales,
          sku: lead.productName,
          quantity: 1,
          weight: 0,
          dimensions: { length: 0, width: 0, height: 0, unit: 'cm' },
          condition: 'baru',
          picPengiriman: '',
          packingNotes: '',
          createdBy: currentUserId,
        })
        await notifyShipmentReady(lead.assignedSales, adminIds, lead.customerName ?? '-', lead.productName, lead.id)
      }
    } finally { setSaving(null) }
  }

  const savePlan = async (payments: Payment[]) => {
    if (!planModal) return
    await updateDocument('leads', planModal.id, { payments })
    setPlanModal(null)
  }

  const dpLabel = (dp: DpPelunasanStatus) =>
    dp === 'sudah_lunas' ? 'Sudah Lunas' : dp === 'sudah_dp' ? 'Sudah DP' : 'Belum DP'
  const dpColor = (dp: DpPelunasanStatus) =>
    dp === 'sudah_lunas'
      ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
      : dp === 'sudah_dp'
        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'

  // ── KPI computations (dari semua leads) ──
  const belumDpLeads  = leads.filter((l) => (l.dpPelunasan ?? 'belum_dp') === 'belum_dp')
  const sudahDpLeads  = leads.filter((l) => l.dpPelunasan === 'sudah_dp')
  const sudahLunasLeads = leads.filter((l) => l.dpPelunasan === 'sudah_lunas')
  const totalMasukSat = leads.reduce((s, l) => s + (l.payments ?? []).filter((p) => p.status === 'paid').reduce((a, p) => a + p.amount, 0), 0)

  const satuanKpiCards = [
    {
      label: 'Belum DP',
      count: belumDpLeads.length,
      nilai: belumDpLeads.reduce((s, l) => s + (l.estimatedCost ?? 0), 0),
      icon: <Clock className="h-5 w-5" />,
      color: 'bg-gray-100 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400',
      filter: 'belum_dp' as DpPelunasanStatus | 'all',
    },
    {
      label: 'Sudah DP',
      count: sudahDpLeads.length,
      nilai: sudahDpLeads.reduce((s, l) => s + (l.estimatedCost ?? 0), 0),
      icon: <Wallet className="h-5 w-5" />,
      color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
      filter: 'sudah_dp' as DpPelunasanStatus | 'all',
    },
    {
      label: 'Sudah Lunas',
      count: sudahLunasLeads.length,
      nilai: sudahLunasLeads.reduce((s, l) => s + (l.estimatedCost ?? 0), 0),
      icon: <CheckCircle2 className="h-5 w-5" />,
      color: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400',
      filter: 'sudah_lunas' as DpPelunasanStatus | 'all',
    },
    {
      label: 'Total Terkumpul',
      count: leads.length,
      nilai: totalMasukSat,
      icon: <TrendingUp className="h-5 w-5" />,
      color: 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400',
      filter: 'all' as DpPelunasanStatus | 'all',
    },
  ]

  return (
    <div className="space-y-3">
      {/* KPI Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {satuanKpiCards.map((c) => {
          const isActive = c.filter !== 'all' && filterDp === c.filter
          return (
            <button
              key={c.label}
              onClick={() => {
                setFilterDp(isActive ? 'all' : c.filter)
                setPage(1)
              }}
              className={cn(
                'bg-card border rounded-xl p-4 text-left transition-all cursor-pointer hover:shadow-md',
                isActive ? 'border-primary ring-1 ring-primary/30' : 'border-border'
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={cn('p-2 rounded-lg', c.color)}>{c.icon}</span>
                <span className="text-2xl font-bold">{c.count}</span>
              </div>
              <p className="text-sm font-medium">{c.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {c.nilai > 0 ? `Rp ${shortCost(c.nilai)}` : '—'}
              </p>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="Cari customer atau produk..."
          className="flex-1 min-w-[200px] px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          value={filterDp}
          onChange={(e) => { setFilterDp(e.target.value as DpPelunasanStatus | 'all'); setPage(1) }}
          className="px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Semua Status</option>
          <option value="belum_dp">Belum DP</option>
          <option value="sudah_dp">Sudah DP</option>
          <option value="sudah_lunas">Sudah Lunas</option>
        </select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground">Customer</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Produk</th>
                <th className="text-left p-3 font-medium text-muted-foreground">PIC Sales</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Estimasi</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Status DP</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Termin</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Jumlah</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Tgl Bayar</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, idx) => {
                const lead = getLead(row.leadId)
                const savingKey = row.leadId + '_' + row.terminIdx
                return (
                  <tr key={row.leadId + '_' + (row.terminIdx ?? 'empty') + '_' + idx}
                    className="transition-colors hover:bg-muted/10"
                  >
                    {row.isFirst && (
                      <td className="p-3 font-medium align-top" rowSpan={row.rowSpan}>{row.customerName}</td>
                    )}
                    {row.isFirst && (
                      <td className="p-3 text-xs text-muted-foreground align-top" rowSpan={row.rowSpan}>{row.productName}</td>
                    )}
                    {row.isFirst && (
                      <td className="p-3 text-xs text-muted-foreground align-top" rowSpan={row.rowSpan}>{row.salesName}</td>
                    )}
                    {row.isFirst && (
                      <td className="p-3 text-xs font-medium align-top" rowSpan={row.rowSpan}>
                        {row.estimatedCost ? shortCost(row.estimatedCost) : <span className="text-muted-foreground">-</span>}
                      </td>
                    )}
                    {row.isFirst && (
                      <td className="p-3 text-center align-top" rowSpan={row.rowSpan}>
                        <span className={cn('inline-block px-2 py-0.5 rounded-full text-xs font-medium', dpColor(row.dpStatus))}>
                          {dpLabel(row.dpStatus)}
                        </span>
                      </td>
                    )}

                    {row.terminIdx === null ? (
                      <>
                        <td className="p-3 text-muted-foreground text-xs italic">Belum ada termin</td>
                        <td /><td /><td />
                        <td className="p-3 text-center">
                          <button
                            onClick={() => setPlanModal(lead)}
                            disabled={!row.estimatedCost}
                            className={cn(
                              'inline-flex items-center gap-1 text-xs',
                              row.estimatedCost ? 'text-primary hover:underline' : 'text-muted-foreground cursor-not-allowed'
                            )}
                            title={!row.estimatedCost ? 'Isi estimasi biaya di form Project Satuan' : undefined}
                          >
                            <Plus className="h-3 w-3" /> Catat Pembayaran
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-3 text-xs">{row.terminLabel}</td>
                        <td className="p-3 text-right font-medium text-xs">{currency(row.amount!)}</td>
                        <td className="p-3 text-center">
                          <span className={cn(
                            'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
                            row.status === 'paid'
                              ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                              : 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
                          )}>
                            {row.status === 'paid' ? 'Lunas' : 'Pending'}
                          </span>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {row.paidDate ? format(row.paidDate, 'd MMM yyyy', { locale: localeId }) : '-'}
                        </td>
                        <td className="p-3 text-center">
                          {row.status === 'pending' ? (
                            <button
                              onClick={() => markPaid(lead, row.terminIdx!)}
                              disabled={saving === savingKey}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-500 hover:bg-green-600 text-white text-xs disabled:opacity-50 transition-colors"
                            >
                              {saving === savingKey ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                              Tandai Lunas
                            </button>
                          ) : row.isFirst ? (
                            <button
                              onClick={() => setPlanModal(lead)}
                              title="Ubah Termin"
                              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-muted-foreground">Tidak ada data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {planModal && (
        <PlanModal
          title={`Atur Termin: ${planModal.customerName}`}
          totalValue={planModal.estimatedCost ?? 0}
          onSave={savePlan}
          onClose={() => setPlanModal(null)}
        />
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function PaymentPage() {
  const { user } = useAuthStore()
  const [projects, setProjects] = useState<Project[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [salesUsers, setSalesUsers] = useState<User[]>([])
  const [adminUsers, setAdminUsers] = useState<User[]>([])
  const [fabrikasiUsers, setFabrikasiUsers] = useState<User[]>([])
  const [drawingRequests, setDrawingRequests] = useState<DrawingRequest[]>([])
  const [activeTab, setActiveTab] = useState<'sales' | 'satuan'>('sales')

  useEffect(() => {
    const unsubProjects = subscribeToCollection('projects', [], (docs) => {
      setProjects(
        docs.map((d) => ({
          ...d,
          payments: ((d.payments as Payment[]) ?? []).map((p) => ({ ...p, date: toDate(p.date as never) ?? new Date() })),
        })) as unknown as Project[]
      )
    })
    const unsubLeads = subscribeToCollection('leads', [], (docs) => {
      setLeads(
        docs.map((d) => ({
          ...d,
          payments: ((d.payments as Payment[]) ?? []).map((p) => ({ ...p, date: toDate(p.date as never) ?? new Date() })),
        })) as unknown as Lead[]
      )
    })
    const unsubSales = subscribeToCollection('users', [where('role', '==', 'sales')], (docs) => {
      setSalesUsers(docs as unknown as User[])
    })
    const unsubAdmin = subscribeToCollection('users', [where('role', '==', 'admin')], (docs) => {
      setAdminUsers(docs as unknown as User[])
    })
    const unsubFabrikasi = subscribeToCollection('users', [where('role', '==', 'fabrikasi')], (docs) => {
      setFabrikasiUsers(docs as unknown as User[])
    })
    const unsubDrawing = subscribeToCollection('requests_drawing', [], (docs) => {
      setDrawingRequests(docs as unknown as DrawingRequest[])
    })
    return () => { unsubProjects(); unsubLeads(); unsubSales(); unsubAdmin(); unsubFabrikasi(); unsubDrawing() }
  }, [])

  const pendingProjectCount = projects.filter(
    (p) => p.payments.length > 0 && !p.payments.every((pay) => pay.status === 'paid')
  ).length
  const pendingLeadCount = leads.filter((l) => (l.dpPelunasan ?? 'belum_dp') !== 'sudah_lunas').length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Payment Tracking</h1>
        <p className="text-sm text-muted-foreground">Catat dan monitor pembayaran DP & pelunasan</p>
      </div>

      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {([
          { id: 'sales', label: 'Project Sales', count: pendingProjectCount },
          { id: 'satuan', label: 'Project Satuan', count: pendingLeadCount },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-xs rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'sales'
        ? <ProjectSalesSection
            projects={projects}
            drawingRequests={drawingRequests}
            fabrikasiIds={fabrikasiUsers.map((u) => u.id)}
            adminIds={adminUsers.map((u) => u.id)}
            currentUserId={user?.id ?? ''}
            salesUsers={salesUsers}
          />
        : <ProjectSatuanSection leads={leads} salesUsers={salesUsers} adminIds={adminUsers.map((u) => u.id)} currentUserId={user?.id ?? ''} />}
    </div>
  )
}
