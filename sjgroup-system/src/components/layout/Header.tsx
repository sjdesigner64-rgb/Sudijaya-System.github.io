import { Bell, Sun, Moon, Menu, LogOut } from 'lucide-react'
import { useAuthStore, getRoleLabel } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'
import { logoutUser } from '@/services/auth.service'
import { cn } from '@/utils/cn'

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, theme, toggleTheme, logout } = useAuthStore()
  const { unreadCount, setShowReminder } = useNotificationStore()

  const handleLogout = async () => {
    await logoutUser()
    logout()
  }

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-1.5 rounded-md hover:bg-accent transition-colors lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold">SJ</span>
          </div>
          <span className="font-semibold text-sm hidden sm:block">Sudijaya Group</span>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">
        {/* Reminder bell */}
        <button
          onClick={() => setShowReminder(true)}
          className="relative p-2 rounded-md hover:bg-accent transition-colors"
          title="Reminder"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-md hover:bg-accent transition-colors"
          title="Ganti tema"
        >
          {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </button>

        {/* User info */}
        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-primary text-xs font-semibold">
              {user?.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="hidden md:block leading-tight">
            <p className="text-sm font-medium truncate max-w-[120px]">{user?.name}</p>
            <p className={cn('text-[11px] text-muted-foreground')}>
              {user ? getRoleLabel(user.role) : ''}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
