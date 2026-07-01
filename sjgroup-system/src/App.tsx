import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/router/ProtectedRoute'
import { LoginPage } from '@/pages/auth/LoginPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { LeadsPage } from '@/pages/sales/LeadsPage'
import { PipelinePage } from '@/pages/sales/PipelinePage'
import { DrawingRequestPage } from '@/pages/sales/DrawingRequestPage'
import { QuotationPage } from '@/pages/admin/QuotationPage'
import { InvoicePage } from '@/pages/admin/InvoicePage'
import { PaymentPage } from '@/pages/admin/PaymentPage'
import { AfterSalesPage } from '@/pages/admin/AfterSalesPage'
import { GanttPage } from '@/pages/fabrikasi/GanttPage'
import { BomRequestPage } from '@/pages/fabrikasi/BomRequestPage'
import { ShipmentPage } from '@/pages/fabrikasi/ShipmentPage'
import { InstallationPage } from '@/pages/fabrikasi/InstallationPage'
import { WarehousePage } from '@/pages/warehouse/WarehousePage'
import { ContentPage } from '@/pages/media/ContentPage'
import { AssetMediaPage } from '@/pages/media/AssetMediaPage'
import { ContentDataPage } from '@/pages/media/ContentDataPage'
import { TasksPage } from '@/pages/shared/TasksPage'
import { MeetingsPage } from '@/pages/shared/MeetingsPage'
import { InboxPanel } from '@/components/inbox/InboxPanel'
import { UsersPage } from '@/pages/superadmin/UsersPage'
import { useAuthStore } from '@/store/authStore'
import { useAuth } from '@/hooks/useAuth'

function RootRedirect() {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  if (['super_admin', 'admin'].includes(user.role)) return <Navigate to="/dashboard" replace />
  if (user.role === 'sales') return <Navigate to="/leads" replace />
  if (user.role === 'fabrikasi') return <Navigate to="/gantt" replace />
  if (user.role === 'warehouse') return <Navigate to="/warehouse" replace />
  if (user.role === 'media') return <Navigate to="/content" replace />
  return <Navigate to="/inbox" replace />
}

function AppWithAuth() {
  const { theme } = useAuthStore()
  useAuth()

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [theme])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<RootRedirect />} />
          <Route path="dashboard" element={
            <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
              <DashboardPage />
            </ProtectedRoute>
          } />
          <Route path="leads" element={
            <ProtectedRoute allowedRoles={['super_admin', 'admin', 'sales']}>
              <LeadsPage />
            </ProtectedRoute>
          } />
          <Route path="pipeline" element={
            <ProtectedRoute allowedRoles={['super_admin', 'admin', 'sales']}>
              <PipelinePage />
            </ProtectedRoute>
          } />
          <Route path="quotation" element={
            <ProtectedRoute allowedRoles={['super_admin', 'admin', 'sales']}>
              <QuotationPage />
            </ProtectedRoute>
          } />
          <Route path="invoice" element={
            <ProtectedRoute allowedRoles={['super_admin', 'admin', 'sales']}>
              <InvoicePage />
            </ProtectedRoute>
          } />
          <Route path="payment" element={
            <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
              <PaymentPage />
            </ProtectedRoute>
          } />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="meetings" element={<MeetingsPage />} />
          <Route path="gantt" element={
            <ProtectedRoute allowedRoles={['super_admin', 'admin', 'sales', 'fabrikasi']}>
              <GanttPage />
            </ProtectedRoute>
          } />
          <Route path="drawing-request" element={
            <ProtectedRoute allowedRoles={['super_admin', 'sales', 'fabrikasi']}>
              <DrawingRequestPage />
            </ProtectedRoute>
          } />
          <Route path="bom-request" element={
            <ProtectedRoute allowedRoles={['super_admin', 'admin', 'sales', 'fabrikasi']}>
              <BomRequestPage />
            </ProtectedRoute>
          } />
          <Route path="warehouse" element={
            <ProtectedRoute allowedRoles={['super_admin', 'admin', 'warehouse']}>
              <WarehousePage />
            </ProtectedRoute>
          } />
          <Route path="content" element={
            <ProtectedRoute allowedRoles={['super_admin', 'sales', 'media']}>
              <ContentPage />
            </ProtectedRoute>
          } />
          <Route path="media-assets" element={
            <ProtectedRoute allowedRoles={['super_admin', 'media']}>
              <AssetMediaPage />
            </ProtectedRoute>
          } />
          <Route path="content-data" element={
            <ProtectedRoute allowedRoles={['super_admin', 'media']}>
              <ContentDataPage />
            </ProtectedRoute>
          } />
          <Route path="after-sales" element={
            <ProtectedRoute allowedRoles={['super_admin', 'admin', 'sales']}>
              <AfterSalesPage />
            </ProtectedRoute>
          } />
          <Route path="shipment" element={
            <ProtectedRoute allowedRoles={['super_admin', 'admin', 'sales', 'fabrikasi']}>
              <ShipmentPage />
            </ProtectedRoute>
          } />
          <Route path="installation" element={
            <ProtectedRoute allowedRoles={['super_admin', 'admin', 'sales', 'fabrikasi']}>
              <InstallationPage />
            </ProtectedRoute>
          } />
          <Route path="inbox" element={<InboxPanel />} />
          <Route path="users" element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <UsersPage />
            </ProtectedRoute>
          } />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default AppWithAuth
