import { useEffect, useState } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { toDate } from '@/utils/firestore'
import type { Installation, InstallationStatus, Project, User } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { createDoc, updateDocument, deleteDocument, subscribeToCollection, where } from '@/services/firestore.service'

const STATUS_LABELS: Record<InstallationStatus, string> = {
  pending: 'Pending',
  dijadwalkan: 'Dijadwalkan',
  reschedule: 'Reschedule',
  selesai: 'Selesai',
}
const STATUS_COLORS: Record<InstallationStatus, string> = {
  pending: 'bg-gray-100 dark:bg-gray-800 text-gray-700',
  dijadwalkan: 'bg-blue-100 dark:bg-blue-900 text-blue-700',
  reschedule: 'bg-amber-100 dark:bg-amber-900 text-amber-700',
  selesai: 'bg-green-100 dark:bg-green-900 text-green-700',
}

const toDateInput = (d?: Date) => (d ? d.toISOString().slice(0, 10) : '')

interface InstallationFormProps {
  projects: Project[]
  fabrikasiUsers: User[]
  initial?: Installation
  onClose: () => void
}

function InstallationForm({ projects, fabrikasiUsers, initial, onClose }: InstallationFormProps) {
  const { user } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [projectId, setProjectId] = useState(initial?.projectId ?? projects[0]?.id ?? '')
  const [picInstalasi, setPicInstalasi] = useState(initial?.picInstalasi ?? fabrikasiUsers[0]?.id ?? '')
  const [installationDate, setInstallationDate] = useState(toDateInput(initial?.installationDate) || new Date().toISOString().slice(0, 10))
  const [estimatedDuration, setEstimatedDuration] = useState(initial?.estimatedDuration ?? '')
  const [deadline, setDeadline] = useState(toDateInput(initial?.deadline))
  const [status, setStatus] = useState<InstallationStatus>(initial?.status ?? 'pending')

  const selectedProject = projects.find((p) => p.id === projectId)

  const handleSave = async () => {
    if (!selectedProject || !picInstalasi || !installationDate || !deadline || !user) return
    setSaving(true)
    try {
      const data = {
        projectId: selectedProject.id,
        projectName: selectedProject.name,
        picInstalasi,
        installationDate: new Date(installationDate),
        estimatedDuration,
        deadline: new Date(deadline),
        status,
      }
      if (initial) {
        await updateDocument('installations', initial.id, data)
      } else {
        await createDoc('installations', { ...data, createdBy: user.id })
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold mb-4">{initial ? 'Edit Instalasi' : 'Tambah Instalasi'}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Nama Project</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {projects.map((p) => (<option key={p.id} value={p.id}>{p.name} — {p.customerName}</option>))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">PIC Instalasi</label>
            <select value={picInstalasi} onChange={(e) => setPicInstalasi(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {fabrikasiUsers.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Tanggal Instalasi</label>
              <input type="date" value={installationDate} onChange={(e) => setInstallationDate(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Deadline Instalasi</label>
              <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Estimasi Durasi</label>
            <input value={estimatedDuration} onChange={(e) => setEstimatedDuration(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Contoh: 2 hari" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Status Jadwal</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as InstallationStatus)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {(Object.entries(STATUS_LABELS) as [InstallationStatus, string][]).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button onClick={handleSave} disabled={saving || !selectedProject || !picInstalasi} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Simpan
          </button>
        </div>
      </div>
    </div>
  )
}

export function InstallationPage() {
  const [installations, setInstallations] = useState<Installation[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [fabrikasiUsers, setFabrikasiUsers] = useState<User[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editInstallation, setEditInstallation] = useState<Installation | undefined>()

  useEffect(() => {
    const unsubI = subscribeToCollection('installations', [], (docs) => {
      setInstallations(
        docs.map((d) => ({
          ...d,
          installationDate: toDate(d.installationDate as never) ?? new Date(),
          deadline: toDate(d.deadline as never) ?? new Date(),
        })) as unknown as Installation[]
      )
    })
    const unsubP = subscribeToCollection('projects', [], (docs) => setProjects(docs as unknown as Project[]))
    const unsubF = subscribeToCollection('users', [where('role', '==', 'fabrikasi')], (docs) => setFabrikasiUsers(docs as unknown as User[]))
    return () => { unsubI(); unsubP(); unsubF() }
  }, [])

  const picName = (id: string) => fabrikasiUsers.find((u) => u.id === id)?.name ?? '-'

  const handleDelete = async (i: Installation) => {
    if (!confirm(`Hapus jadwal instalasi untuk "${i.projectName}"?`)) return
    await deleteDocument('installations', i.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Instalasi</h1>
          <p className="text-sm text-muted-foreground">Jadwal instalasi mesin di lokasi customer</p>
        </div>
        <button
          onClick={() => { setEditInstallation(undefined); setShowForm(true) }}
          disabled={projects.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Tambah Instalasi
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Nama Project</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">PIC Instalasi</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Tgl Instalasi</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Estimasi Durasi</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Deadline</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {installations.map((i) => (
                <tr key={i.id} className="hover:bg-muted/20">
                  <td className="p-3 font-medium whitespace-nowrap">{i.projectName}</td>
                  <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{picName(i.picInstalasi)}</td>
                  <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{format(i.installationDate, 'd MMM yyyy', { locale: localeId })}</td>
                  <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{i.estimatedDuration || '-'}</td>
                  <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{format(i.deadline, 'd MMM yyyy', { locale: localeId })}</td>
                  <td className="p-3"><span className={cn('px-2 py-0.5 text-xs rounded-full whitespace-nowrap', STATUS_COLORS[i.status])}>{STATUS_LABELS[i.status]}</span></td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <button onClick={() => { setEditInstallation(i); setShowForm(true) }} className="text-xs text-primary hover:underline">Edit</button>
                      <button onClick={() => handleDelete(i)} className="text-muted-foreground hover:text-destructive" title="Hapus">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {installations.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Belum ada jadwal instalasi</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <InstallationForm
          projects={projects}
          fabrikasiUsers={fabrikasiUsers}
          initial={editInstallation}
          onClose={() => { setShowForm(false); setEditInstallation(undefined) }}
        />
      )}
    </div>
  )
}
