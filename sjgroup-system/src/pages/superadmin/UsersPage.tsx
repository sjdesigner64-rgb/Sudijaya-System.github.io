import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, Loader2, KeyRound, Eye, EyeOff, RotateCcw } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { User, UserRole } from '@/types'
import { getRoleLabel } from '@/store/authStore'
import { subscribeToCollection, orderBy } from '@/services/firestore.service'
import { createUserAccount, deleteUserAccount, updateUserProfile, resetUserPassword } from '@/services/user.service'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

const DEFAULT_PASSWORD = 'Sudijaya2026!'

const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: 'bg-purple-100 dark:bg-purple-900 text-purple-700',
  admin:       'bg-blue-100 dark:bg-blue-900 text-blue-700',
  sales:       'bg-green-100 dark:bg-green-900 text-green-700',
  fabrikasi:   'bg-amber-100 dark:bg-amber-900 text-amber-700',
  warehouse:   'bg-cyan-100 dark:bg-cyan-900 text-cyan-700',
  media:       'bg-pink-100 dark:bg-pink-900 text-pink-700',
}

const ROLES: UserRole[] = ['super_admin', 'admin', 'sales', 'fabrikasi', 'warehouse', 'media']

// ─── Edit / Tambah Modal ──────────────────────────────────────────────────────
function UserFormModal({
  editUser, onClose, onSaved,
}: {
  editUser: User | undefined
  onClose: () => void
  onSaved: () => void
}) {
  const [name,    setName]    = useState(editUser?.name    ?? '')
  const [email,   setEmail]   = useState(editUser?.email   ?? '')
  const [password, setPassword] = useState('')
  const [role,    setRole]    = useState<UserRole>(editUser?.role ?? 'sales')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim()) { setError('Nama dan email wajib diisi'); return }
    setSaving(true)
    setError('')
    try {
      if (editUser) {
        const updates: Parameters<typeof updateUserProfile>[1] = { name, role }
        if (email.trim() !== editUser.email) updates.email = email.trim()
        await updateUserProfile(editUser.id, updates)
      } else {
        if (!password) { setError('Password awal wajib diisi'); setSaving(false); return }
        await createUserAccount({ name, email, password, role })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-5">
        <h3 className="font-semibold mb-4">{editUser ? 'Edit User' : 'Tambah User Baru'}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Nama Lengkap</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {ROLES.map((r) => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
            </select>
          </div>
          {!editUser && (
            <div>
              <label className="text-sm font-medium block mb-1">Password Awal</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={`Contoh: ${DEFAULT_PASSWORD}`}
                className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Simpan
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Reset Password Modal ─────────────────────────────────────────────────────
function ResetPasswordModal({ user, onClose }: { user: User; onClose: () => void }) {
  const [mode,            setMode]            = useState<'choose' | 'custom'>('choose')
  const [newPassword,     setNewPassword]     = useState('')
  const [showPassword,    setShowPassword]    = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [done,            setDone]            = useState('')
  const [error,           setError]           = useState('')

  const doReset = async (pwd: string) => {
    setSaving(true)
    setError('')
    try {
      await resetUserPassword(user.id, pwd)
      setDone(pwd)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mereset password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center shrink-0">
            <KeyRound className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Reset Password</h3>
            <p className="text-xs text-muted-foreground">{user.name}</p>
          </div>
        </div>

        {done ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4">
              <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">Password berhasil direset!</p>
              <p className="text-xs text-muted-foreground mb-1">Beritahu <strong>{user.name}</strong> password barunya:</p>
              <div className="flex items-center gap-2 mt-2">
                <code className="flex-1 px-3 py-2 bg-card border border-border rounded-md text-sm font-mono font-semibold select-all">
                  {done}
                </code>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">Sarankan user untuk segera mengganti password setelah login.</p>
            </div>
            <button onClick={onClose}
              className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium">
              Selesai
            </button>
          </div>
        ) : mode === 'choose' ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Pilih metode reset password:</p>

            {/* Reset ke default */}
            <button
              onClick={() => doReset(DEFAULT_PASSWORD)}
              disabled={saving}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-accent text-left disabled:opacity-50 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
                {saving ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> : <RotateCcw className="h-4 w-4 text-blue-600" />}
              </div>
              <div>
                <p className="text-sm font-medium">Reset ke Password Default</p>
                <p className="text-xs text-muted-foreground">Password diubah ke <code className="font-mono">{DEFAULT_PASSWORD}</code></p>
              </div>
            </button>

            {/* Set custom password */}
            <button
              onClick={() => setMode('custom')}
              disabled={saving}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-accent text-left disabled:opacity-50 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900 flex items-center justify-center shrink-0">
                <KeyRound className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Atur Password Baru</p>
                <p className="text-xs text-muted-foreground">Tentukan password baru secara manual</p>
              </div>
            </button>

            {error && <p className="text-xs text-destructive">{error}</p>}
            <button onClick={onClose} className="w-full py-2 border border-border rounded-md text-sm hover:bg-accent">Batal</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium block mb-1">Password Baru</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-3 pr-9 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => setMode('choose')} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Kembali</button>
              <button
                onClick={() => {
                  if (newPassword.length < 6) { setError('Password minimal 6 karakter'); return }
                  doReset(newPassword)
                }}
                disabled={saving}
                className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Simpan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function UsersPage() {
  const [users,        setUsers]        = useState<User[]>([])
  const [showForm,     setShowForm]     = useState(false)
  const [editUser,     setEditUser]     = useState<User | undefined>()
  const [resetTarget,  setResetTarget]  = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [deleting,     setDeleting]     = useState(false)

  useEffect(() => {
    return subscribeToCollection('users', [orderBy('name', 'asc')], (docs) => {
      setUsers(docs as unknown as User[])
    })
  }, [])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteUserAccount(deleteTarget.id)
      setDeleteTarget(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus user')
    } finally {
      setDeleting(false)
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
          onClick={() => { setEditUser(undefined); setShowForm(true) }}
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
                    className={cn('px-2 py-0.5 text-xs rounded-full', u.isActive
                      ? 'bg-green-100 dark:bg-green-900 text-green-700'
                      : 'bg-red-100 dark:bg-red-900 text-red-700')}
                  >
                    {u.isActive ? 'Aktif' : 'Nonaktif'}
                  </button>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditUser(u); setShowForm(true) }}
                      className="p-1.5 text-muted-foreground hover:text-primary hover:bg-accent rounded"
                      title="Edit user"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setResetTarget(u)}
                      className="p-1.5 text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950 rounded"
                      title="Reset password"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(u)}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"
                      title="Hapus user"
                    >
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
        <UserFormModal
          editUser={editUser}
          onClose={() => setShowForm(false)}
          onSaved={() => setShowForm(false)}
        />
      )}

      {resetTarget && (
        <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Hapus user "${deleteTarget.name}"? Tindakan ini tidak dapat dibatalkan.`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
