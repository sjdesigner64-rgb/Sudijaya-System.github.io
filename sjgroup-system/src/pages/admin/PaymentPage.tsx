import { useEffect, useState } from 'react'
import { Plus, Check, Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { toDate } from '@/utils/firestore'
import type { Project, Payment } from '@/types'
import { subscribeToCollection, updateDocument } from '@/services/firestore.service'

const currency = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(n)

function planLabel(percentage: number, isFirst: boolean, isLast: boolean): string {
  if (percentage === 100) return 'Full Payment 100%'
  if (isFirst) return `DP ${percentage}%`
  if (isLast) return `Pelunasan ${percentage}%`
  return `Termin ${percentage}%`
}

function NewPaymentPlanForm({ projects, onClose }: { projects: Project[]; onClose: () => void }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [plan, setPlan] = useState<'dp60' | 'full' | 'custom'>('dp60')
  const [customPct, setCustomPct] = useState('30')
  const [saving, setSaving] = useState(false)

  const selectedProject = projects.find((p) => p.id === projectId)

  const handleSave = async () => {
    if (!selectedProject) return
    setSaving(true)
    try {
      const total = selectedProject.estimatedValue
      let newPayments: Payment[]
      if (plan === 'full') {
        newPayments = [{ amount: total, percentage: 100, date: new Date(), status: 'pending' }]
      } else if (plan === 'dp60') {
        newPayments = [
          { amount: Math.round(total * 0.6), percentage: 60, date: new Date(), status: 'pending' },
          { amount: Math.round(total * 0.4), percentage: 40, date: new Date(), status: 'pending' },
        ]
      } else {
        const pct = Number(customPct) || 0
        newPayments = [
          ...selectedProject.payments,
          { amount: Math.round(total * (pct / 100)), percentage: pct, date: new Date(), status: 'pending' },
        ]
      }
      await updateDocument('projects', selectedProject.id, { payments: newPayments })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5">
        <h3 className="font-semibold mb-4">Catat Rencana Pembayaran</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Project</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.customerName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Skema Pembayaran</label>
            <select value={plan} onChange={(e) => setPlan(e.target.value as typeof plan)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="dp60">DP 60% + Pelunasan 40%</option>
              <option value="full">Full Payment 100%</option>
              <option value="custom">Tambah Termin Custom</option>
            </select>
          </div>
          {plan === 'custom' && (
            <div>
              <label className="text-sm font-medium block mb-1">Persentase Termin Baru (%)</label>
              <input type="number" value={customPct} onChange={(e) => setCustomPct(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          )}
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

export function PaymentPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    const unsubscribe = subscribeToCollection('projects', [], (docs) => {
      setProjects(
        docs.map((d) => ({
          ...d,
          payments: ((d.payments as Payment[]) ?? []).map((p) => ({ ...p, date: toDate(p.date as never) ?? new Date() })),
        })) as unknown as Project[]
      )
    })
    return unsubscribe
  }, [])

  const records = projects.filter((p) => p.payments.length > 0)

  const markPaid = async (project: Project, index: number) => {
    const newPayments = project.payments.map((p, i) =>
      i === index ? { ...p, status: 'paid' as const, date: new Date() } : p
    )
    await updateDocument('projects', project.id, { payments: newPayments })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Payment Tracking</h1>
          <p className="text-sm text-muted-foreground">Monitor pembayaran DP dan pelunasan per project</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={projects.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Catat Pembayaran
        </button>
      </div>

      <div className="space-y-4">
        {records.map((rec) => {
          const paid = rec.payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0)
          const paidPct = rec.estimatedValue > 0 ? Math.round((paid / rec.estimatedValue) * 100) : 0

          return (
            <div key={rec.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium">{rec.name}</h3>
                  <p className="text-sm text-muted-foreground">{rec.customerName}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{currency(rec.estimatedValue)}</p>
                  <p className="text-xs text-muted-foreground">Total kontrak</p>
                </div>
              </div>

              <div className="mb-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Sudah Dibayar: {currency(paid)}</span>
                  <span>{paidPct}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${paidPct}%` }} />
                </div>
              </div>

              <div className="space-y-2">
                {rec.payments.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => p.status === 'pending' && markPaid(rec, i)}
                    className={cn(
                      'w-full flex items-center justify-between p-2.5 rounded-lg border text-sm text-left',
                      p.status === 'paid' ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950' : 'border-border hover:border-primary/50'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center',
                        p.status === 'paid' ? 'bg-green-500 text-white' : 'border-2 border-border'
                      )}>
                        {p.status === 'paid' && <Check className="h-3 w-3" />}
                      </div>
                      <span className="font-medium">{planLabel(p.percentage, i === 0, i === rec.payments.length - 1)}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{currency(p.amount)}</p>
                      {p.status === 'paid' ? (
                        <p className="text-xs text-green-600">{format(p.date, 'd MMM yyyy', { locale: localeId })}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Klik untuk tandai lunas</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
        {records.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm bg-card border border-border rounded-xl">
            Belum ada rencana pembayaran
          </div>
        )}
      </div>

      {showForm && <NewPaymentPlanForm projects={projects} onClose={() => setShowForm(false)} />}
    </div>
  )
}
