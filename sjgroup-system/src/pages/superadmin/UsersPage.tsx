import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { User, UserRole } from '@/types'
import { getRoleLabel } from '@/store/authStore'
import { subscribeToCollection, orderBy } from '@/services/firestore.service'
import { createUserAccount, deleteUserAccount, updateUserProfile } from '@/services/user.service'

const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: 'bg-purple-100 dark:bg-purple-900 text-purple-700',
  admin: 'bg-blue-100 dark:bg-blue-900 text-blue-700',
  sales: 'bg-green-100 dark:bg-green-900 text-green-700',
  fabrikasi: 'bg-amber-100 dark:bg-amber-900 text-amber-700',
  warehouse: 'bg-cyan-100 dark:bg-cyan-900 text-cyan-700',
  media: 'bg-pink-100 dark:bg-pink-900 text-pink-700',
}

const ROLES: UserRole[] = ['super_admin', 'admin', 'sales', 'fabrikasi', 'warehouse', 'media']

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState<User | undefined>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('sales')

  useEffect(() => {
    const unsubscribe = subscribeToCollection('users', [orderBy('name', 'asc')], (docs) => {
      setUsers(docs as unknown as User[])
    })
    return unsubscribe
  }, [])

  const openCreateForm = () => {
    setEditUser(undefined)
    setName('')
    setEmail('')
    setPassword('')
    setRole('sales')
    setError('')
    setShowForm(true)
  }

  const openEditForm = (u: User) => {
    setEditUser(u)
    setName(u.name)
    setEmail(u.email)
    setRole(u.role)
    setError('')
    setShowForm(true)
  }

  const handleSubmit = async () => {
    setSaving(true)
    setError('')
    try {
      if (editUser) {
        await updateUserProfile(editUser.id, { name, role })
      } else {
        await createUserAccount({ name, email, password, role })
      }
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (u: User) => {
    if (!confirm(`Hapus user "${u.name}"? Tindakan ini tidak dapat dibatalkan.`)) return
    try {
      await deleteUserAccount(u.id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus user')
    }
  }

  const toggleActive = async (u: User) => {
    await updateUserProfile(u.id, { isActive: !u.isActive })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Kelola User</h1>
          <p className="text-sm text-muted-foreground">Manajemen akun seluruh departemen</p>
        </div>
        <button
          onClick={openCreateForm}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Tambah User
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-3 font-medium text-muted-foreground">Nama</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Role</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-muted/20">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                      {u.name.charAt(0)}
                    </div>
                    <span className="font-medium">{u.name}</span>
                  </div>
                </td>
                <td className="p-3 text-muted-foreground">{u.email}</td>
                <td className="p-3">
                  <span className={cn('px-2 py-0.5 text-xs rounded-full', ROLE_COLORS[u.role])}>
                    {getRoleLabel(u.role)}
                  </span>
                </td>
                <td className="p-3">
                  <button
                    onClick={() => toggleActive(u)}
                    className={cn('px-2 py-0.5 text-xs rounded-full', u.isActive ? 'bg-green-100 dark:bg-green-900 text-green-700' : 'bg-red-100 dark:bg-red-900 text-red-700')}
                  >
                    {u.isActive ? 'Aktif' : 'Nonaktif'}
                  </button>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEditForm(u)} className="p-1 text-muted-foreground hover:text-primary" title="Edit">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(u)} className="p-1 text-muted-foreground hover:text-destructive" title="Hapus">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">Belum ada user</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-md p-5">
            <h3 className="font-semibold mb-4">{editUser ? 'Edit User' : 'Tambah User Baru'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1">Nama Lengkap</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Email</label>
                <input type="email" value={email} disabled={!!editUser} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                  {ROLES.map(r => (
                    <option key={r} value={r}>{getRoleLabel(r)}</option>
                  ))}
                </select>
              </div>
              {!editUser && (
                <div>
                  <label className="text-sm font-medium block mb-1">Password Awal</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              )}
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
              <button onClick={handleSubmit} disabled={saving} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
