import { useEffect, useMemo, useState } from 'react'
import { TrendingUp, Users, CheckCircle, Clock, AlertTriangle } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { format, subMonths } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { toDate } from '@/utils/firestore'
import type { Lead, Project, User, PipelineStage } from '@/types'
import { subscribeToCollection, where } from '@/services/firestore.service'

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

export function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [salesUsers, setSalesUsers] = useState<User[]>([])

  useEffect(() => {
    const unsubL = subscribeToCollection('leads', [], (docs) => {
      setLeads(
        docs.map((d) => ({ ...d, lastFollowUp: toDate(d.lastFollowUp as never) ?? new Date() })) as unknown as Lead[]
      )
    })
    const unsubP = subscribeToCollection('projects', [], (docs) => {
      setProjects(
        docs.map((d) => ({ ...d, estimatedDelivery: toDate(d.estimatedDelivery as never) })) as unknown as Project[]
      )
    })
    const unsubU = subscribeToCollection('users', [where('role', '==', 'sales')], (docs) => {
      setSalesUsers(docs as unknown as User[])
    })
    return () => { unsubL(); unsubP(); unsubU() }
  }, [])

  const closedLeads = leads.filter((l) => l.status === 'closed_won')
  const onProgressProjects = projects.filter((p) => p.status === 'active')
  const lateProjects = onProgressProjects.filter(
    (p) => p.estimatedDelivery && p.estimatedDelivery.getTime() < Date.now()
  )

  const statsCards = [
    { label: 'Total Leads', value: String(leads.length), icon: Users, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950' },
    { label: 'Deals Closed', value: String(closedLeads.length), icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-950' },
    { label: 'On Progress', value: String(onProgressProjects.length), icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950' },
    { label: 'Terlambat', value: String(lateProjects.length), icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950' },
  ]

  const salesData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), 5 - i))
    return months.map((m) => {
      const monthKey = format(m, 'yyyy-MM')
      const monthLeads = leads.filter((l) => format(l.lastFollowUp, 'yyyy-MM') === monthKey)
      return {
        month: format(m, 'MMM', { locale: localeId }),
        leads: monthLeads.length,
        closing: monthLeads.filter((l) => l.status === 'closed_won').length,
      }
    })
  }, [leads])

  const salesProgress = salesUsers.map((u) => {
    const userLeads = leads.filter((l) => l.assignedSales === u.id)
    return {
      name: u.name,
      leads: userLeads.length,
      closed: userLeads.filter((l) => l.status === 'closed_won').length,
      target: 15,
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Ringkasan operasional Sudijaya Group</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((card) => (
          <div key={card.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Chart + Sales Progress */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Area chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Tren Leads & Closing</h2>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={salesData}>
              <defs>
                <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorClosing" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="leads" stroke="#3B82F6" fill="url(#colorLeads)" name="Leads" />
              <Area type="monotone" dataKey="closing" stroke="#10B981" fill="url(#colorClosing)" name="Closing" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Sales progress */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-4">Progress Sales</h2>
          <div className="space-y-4">
            {salesProgress.map((s) => {
              const pct = Math.min(100, Math.round((s.closed / s.target) * 100))
              return (
                <div key={s.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm truncate">{s.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{s.closed}/{s.target}</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
            {salesProgress.length === 0 && (
              <p className="text-sm text-muted-foreground">Belum ada data sales</p>
            )}
          </div>
        </div>
      </div>

      {/* On-progress projects */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-4">Project On Progress</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 font-medium text-muted-foreground">Nama Project</th>
                <th className="pb-2 font-medium text-muted-foreground">Customer</th>
                <th className="pb-2 font-medium text-muted-foreground">Deadline</th>
                <th className="pb-2 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {onProgressProjects.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 font-medium">{p.name}</td>
                  <td className="py-2.5 text-muted-foreground">{p.customerName}</td>
                  <td className="py-2.5 text-muted-foreground">
                    {p.estimatedDelivery ? format(p.estimatedDelivery, 'd MMM yyyy', { locale: localeId }) : '-'}
                  </td>
                  <td className="py-2.5">
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                      {STAGE_LABELS[p.pipelineStage]}
                    </span>
                  </td>
                </tr>
              ))}
              {onProgressProjects.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">Belum ada project on progress</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
