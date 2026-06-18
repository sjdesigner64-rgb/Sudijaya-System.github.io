import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Lock, Mail, Loader2 } from 'lucide-react'
import { loginWithEmail, getUserProfile } from '@/services/auth.service'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/utils/cn'

const emailSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
})

type EmailForm = z.infer<typeof emailSchema>

export function LoginPage() {
  const navigate = useNavigate()
  const { setUser, theme } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<EmailForm>({ resolver: zodResolver(emailSchema) })

  const onEmailSubmit = async (data: EmailForm) => {
    setLoading(true)
    try {
      const cred = await loginWithEmail(data.email, data.password)
      const profile = await getUserProfile(cred.user.uid)
      if (profile) {
        setUser(profile)
        navigate('/', { replace: true })
      }
    } catch {
      setError('email', { message: 'Email atau password salah' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn('min-h-screen flex items-center justify-center bg-background p-4', theme === 'dark' && 'dark')}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center mx-auto mb-3">
            <span className="text-primary-foreground text-xl font-bold">SJ</span>
          </div>
          <h1 className="text-xl font-bold">Sudijaya Group</h1>
          <p className="text-sm text-muted-foreground mt-1">Sistem Manajemen Operasional</p>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm p-6">
          <h2 className="text-base font-semibold mb-4">Masuk ke Akun Anda</h2>
          <form onSubmit={handleSubmit(onEmailSubmit)} className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  {...register('email')}
                  type="email"
                  placeholder="email@sudijaya.com"
                  className="w-full pl-9 pr-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {errors.email && (
                <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••"
                  className="w-full pl-9 pr-9 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Masuk
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
