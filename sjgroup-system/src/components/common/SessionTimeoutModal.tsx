import { ShieldAlert, Clock, LogOut, RefreshCw } from 'lucide-react'
import { cn } from '@/utils/cn'

interface Props {
  countdown: number
  onExtend: () => void
  onLogout: () => void
}

export function SessionTimeoutModal({ countdown, onExtend, onLogout }: Props) {
  const pct = Math.max(0, Math.min(100, (countdown / 60) * 100))
  const urgent = countdown <= 15

  const circumference = 2 * Math.PI * 28 // radius 28
  const dashoffset = circumference * (1 - pct / 100)

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={cn(
        'bg-card border rounded-2xl w-full max-w-sm mx-4 shadow-2xl transition-all',
        urgent ? 'border-red-400 dark:border-red-600' : 'border-amber-300 dark:border-amber-700'
      )}>
        {/* Header */}
        <div className={cn(
          'flex items-center gap-3 px-6 pt-6 pb-4 rounded-t-2xl',
          urgent ? 'bg-red-50 dark:bg-red-950/40' : 'bg-amber-50 dark:bg-amber-950/40'
        )}>
          <div className={cn(
            'p-2 rounded-xl',
            urgent ? 'bg-red-100 dark:bg-red-900/60' : 'bg-amber-100 dark:bg-amber-900/60'
          )}>
            <ShieldAlert className={cn(
              'h-5 w-5',
              urgent ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
            )} />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Sesi Akan Berakhir</h3>
            <p className="text-xs text-muted-foreground">
              {urgent ? 'Segera lanjutkan sesi Anda!' : 'Anda tidak aktif cukup lama'}
            </p>
          </div>
        </div>

        {/* Countdown ring */}
        <div className="flex flex-col items-center gap-1 py-6">
          <div className="relative">
            <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
              {/* Track */}
              <circle
                cx="40" cy="40" r="28"
                fill="none"
                strokeWidth="6"
                className="stroke-muted"
              />
              {/* Progress */}
              <circle
                cx="40" cy="40" r="28"
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashoffset}
                className={cn(
                  'transition-all duration-1000',
                  urgent ? 'stroke-red-500' : 'stroke-amber-500'
                )}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn(
                'text-2xl font-bold tabular-nums leading-none',
                urgent ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
              )}>
                {countdown}
              </span>
              <span className="text-[10px] text-muted-foreground">detik</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
            <Clock className="h-3.5 w-3.5" />
            <span>Anda akan dikeluarkan otomatis</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onLogout}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-border rounded-xl text-sm text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Keluar
          </button>
          <button
            onClick={onExtend}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium text-white transition-colors',
              urgent
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-amber-500 hover:bg-amber-600'
            )}
          >
            <RefreshCw className="h-4 w-4" />
            Lanjutkan Sesi
          </button>
        </div>
      </div>
    </div>
  )
}
