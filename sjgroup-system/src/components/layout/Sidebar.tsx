import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, FileText, Receipt, CreditCard,
  ClipboardList, Calendar, BarChart2, Package, Image,
  Settings, ChevronLeft, Layers,
  Inbox, ShieldCheck, Truck, Wrench, FolderOpen, Film,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/utils/cn'
import type { UserRole } from '@/types'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  roles: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, roles: ['super_admin', 'admin'] },
  { to: '/leads', label: 'Project Satuan', icon: <Users className="h-4 w-4" />, roles: ['super_admin', 'admin', 'sales'] },
  { to: '/pipeline', label: 'Project Sales', icon: <BarChart2 className="h-4 w-4" />, roles: ['super_admin', 'admin', 'sales'] },
  { to: '/quotation', label: 'Quotation', icon: <FileText className="h-4 w-4" />, roles: ['super_admin', 'admin', 'sales'] },
  { to: '/invoice', label: 'Invoice', icon: <Receipt className="h-4 w-4" />, roles: ['super_admin', 'admin', 'sales'] },
  { to: '/payment', label: 'Payment Tracking', icon: <CreditCard className="h-4 w-4" />, roles: ['super_admin', 'admin'] },
  { to: '/tasks', label: 'Daily Task', icon: <ClipboardList className="h-4 w-4" />, roles: ['super_admin', 'admin', 'sales'] },
  { to: '/meetings', label: 'Jadwal Meeting', icon: <Calendar className="h-4 w-4" />, roles: ['super_admin', 'admin', 'sales', 'fabrikasi', 'warehouse', 'media'] },
  { to: '/gantt', label: 'Project Fabrikasi', icon: <Layers className="h-4 w-4" />, roles: ['super_admin', 'admin', 'sales', 'fabrikasi'] },
  { to: '/drawing-request', label: 'Request Gambar', icon: <Image className="h-4 w-4" />, roles: ['super_admin', 'sales', 'fabrikasi'] },
  { to: '/bom-request', label: 'Request BOM', icon: <ClipboardList className="h-4 w-4" />, roles: ['super_admin', 'admin', 'sales', 'fabrikasi'] },
  { to: '/warehouse', label: 'Stok Warehouse', icon: <Package className="h-4 w-4" />, roles: ['super_admin', 'admin', 'warehouse'] },
  { to: '/content', label: 'Request Konten', icon: <Image className="h-4 w-4" />, roles: ['super_admin', 'sales', 'media'] },
  { to: '/media-assets', label: 'Asset Media', icon: <FolderOpen className="h-4 w-4" />, roles: ['super_admin', 'media'] },
  { to: '/content-data', label: 'Data Konten', icon: <Film className="h-4 w-4" />, roles: ['super_admin', 'media'] },
  { to: '/after-sales', label: 'After-Sales', icon: <ShieldCheck className="h-4 w-4" />, roles: ['super_admin', 'admin', 'sales'] },
  { to: '/shipment', label: 'Pengiriman', icon: <Truck className="h-4 w-4" />, roles: ['super_admin', 'admin', 'sales', 'fabrikasi'] },
  { to: '/installation', label: 'Instalasi', icon: <Wrench className="h-4 w-4" />, roles: ['super_admin', 'admin', 'sales', 'fabrikasi'] },
  { to: '/inbox', label: 'Inbox', icon: <Inbox className="h-4 w-4" />, roles: ['super_admin', 'admin', 'sales', 'fabrikasi', 'warehouse', 'media'] },
  { to: '/users', label: 'Kelola User', icon: <Settings className="h-4 w-4" />, roles: ['super_admin'] },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user } = useAuthStore()
  if (!user) return null

  const visible = NAV_ITEMS.filter((item) => item.roles.includes(user.role))

  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-30 flex flex-col w-56 bg-card border-r border-border transition-transform duration-200',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Close button mobile */}
        <div className="flex items-center justify-between p-3 lg:hidden border-b border-border">
          <span className="text-sm font-semibold">Menu</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent">
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {visible.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-border">
          <p className="text-[10px] text-muted-foreground text-center">
            v1.0.0 &copy; Sudijaya Group
          </p>
        </div>
      </aside>
    </>
  )
}
