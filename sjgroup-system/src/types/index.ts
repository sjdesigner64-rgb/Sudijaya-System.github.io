// ─── Roles ────────────────────────────────────────────────────────────────────
export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'sales'
  | 'fabrikasi'
  | 'warehouse'
  | 'media'

// ─── User ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  avatarUrl?: string
}

// ─── Customer ─────────────────────────────────────────────────────────────────
export type CustomerSource = 'whatsapp' | 'iklan' | 'offline'
export type CustomerStatus = 'lead' | 'prospect' | 'active' | 'closed' | 'cancelled'

export interface Customer {
  id: string
  name: string
  phone: string
  email: string
  source: CustomerSource
  status: CustomerStatus
  npwp?: string
  ktpUrl?: string
  lastFollowUp: Date
  createdBy: string
  isActive: boolean
  updatedAt: Date
}

// ─── Leads ────────────────────────────────────────────────────────────────────
export type LeadStatus = 'new' | 'follow_up' | 'qualified' | 'closed_won' | 'closed_lost'
export type ProductCategory = 'Zenchang' | 'VNT' | 'Nordic' | 'Zenyer' | 'Lijun' | 'Pinecone'

export interface Lead {
  id: string
  customerId: string
  customerName?: string
  productCategory: ProductCategory
  productName: string
  source: CustomerSource
  status: LeadStatus
  assignedSales: string
  lastFollowUp: Date
  notes: string
}

// ─── Project ──────────────────────────────────────────────────────────────────
export type ProjectStatus = 'active' | 'completed' | 'cancelled'

export type PipelineStage =
  | 'leads'
  | 'dp_layout'
  | 'meeting_fabrikasi'
  | 'fabrikasi_build'
  | 'pelunasan'
  | 'pengiriman'
  | 'instalasi'

export interface Payment {
  amount: number
  percentage: number
  date: Date
  status: 'pending' | 'paid'
}

export interface MeetingNote {
  date: Date
  notes: string
}

export interface Project {
  id: string
  name: string
  customerId: string
  customerName?: string
  salesPic: string
  category: ProductCategory
  status: ProjectStatus
  pipelineStage: PipelineStage
  estimatedValue: number
  dpPercentage: number
  dpDate?: Date
  fullPaymentDate?: Date
  warrantyStartDate?: Date
  warrantyEndDate?: Date
  estimatedDelivery?: Date
  payments: Payment[]
  meetingNotes: MeetingNote[]
}

// ─── Quotation ────────────────────────────────────────────────────────────────
export type QuotationStatus = 'diproses' | 'pending' | 'selesai'

export interface QuotationItem {
  description: string
  qty: number
  unit: string
  price: number
}

export interface Quotation {
  id: string
  projectId: string
  customerId: string
  requestedBy: string
  createdBy?: string
  status: QuotationStatus
  deadline: Date
  pdfUrl?: string
  items: QuotationItem[]
  totalAmount: number
  createdAt: Date
}

// ─── Invoice ──────────────────────────────────────────────────────────────────
export interface Invoice {
  id: string
  quotationId: string
  projectId: string
  customerId: string
  invoiceNumber: string
  createdBy: string
  pdfUrl?: string
  uploadedFileUrl?: string
  amount: number
  createdAt: Date
}

// ─── Task ─────────────────────────────────────────────────────────────────────
export type TaskStatus = 'pending' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  title: string
  description: string
  assignedTo: string
  assignedBy: string
  role: UserRole
  status: TaskStatus
  priority?: TaskPriority
  dueDate: Date
  reminderSent: boolean
  createdAt: Date
}

// ─── Drawing Request ──────────────────────────────────────────────────────────
export interface Attachment {
  url: string
  type: 'jpg' | 'png' | 'pdf'
  name: string
}

export interface DrawingRequest {
  id: string
  projectId: string
  requestedBy: string
  assignedTo: string[]
  projectName: string
  deadline: Date
  priority: TaskPriority
  status: TaskStatus
  attachments: Attachment[]
  resultAttachments: Attachment[]
  notes: string
}

// ─── BOM Request ──────────────────────────────────────────────────────────────
export type BomStatus = 'pending_admin' | 'pending_fabrikasi' | 'done'

export interface BomRequest {
  id: string
  projectId: string
  requestedBy: string
  status: BomStatus
  attachments: Attachment[]
  resultUrl?: string
  visibleTo: string[]
  notes: string
}

// ─── Gantt Chart ──────────────────────────────────────────────────────────────
export type GanttTaskName =
  | 'drawing'
  | 'purchase_material'
  | 'cutting_laser'
  | 'vendor'
  | 'fabrikasi'
  | 'electrical'
  | 'qc_fat'
  | 'instalasi'

export type GanttTaskStatus = 'pending' | 'in_progress' | 'done' | 'delayed'

export interface GanttNote {
  date: Date
  content: string
  createdBy: string
}

export interface GanttTask {
  id: string
  taskName: GanttTaskName
  deadline: Date
  startDate?: Date
  completedDate?: Date
  status: GanttTaskStatus
  pic: string[]
  notes: GanttNote[]
}

export interface ProductionGantt {
  id: string
  projectId: string
  projectName: string
  salesPic: string
  overallDeadline: Date
  status: 'active' | 'completed'
  tasks: GanttTask[]
}

// ─── Warehouse Stock ──────────────────────────────────────────────────────────
export type StockCategory =
  | 'mesin'
  | 'sparepart_pmx'
  | 'sparepart_basic_destoner'
  | 'sparepart_umum'

export type StockStatus = 'ready' | 'low_stock' | 'out_of_stock'

export interface Dimensions {
  length: number
  width: number
  height: number
  unit: 'cm'
}

export interface WarehouseStock {
  id: string
  name: string
  category: StockCategory
  quantity: number
  unit: string
  dimensions: Dimensions
  weight: number
  gdriveLink?: string
  status: StockStatus
  updatedAt: Date
}

// ─── Shipment (Pengiriman) ──────────────────────────────────────────────────────
export type ItemCondition = 'baru' | 'bekas' | 'servis' | 'retur'

export interface Shipment {
  id: string
  projectId: string
  projectName?: string
  sku: string
  quantity: number
  weight: number
  dimensions: Dimensions
  condition: ItemCondition
  address: string
  picPengiriman: string
  packingNotes?: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

// ─── Installation (Instalasi) ───────────────────────────────────────────────────
export type InstallationStatus = 'pending' | 'dijadwalkan' | 'reschedule' | 'selesai'

export interface Installation {
  id: string
  projectId: string
  projectName?: string
  picInstalasi: string
  installationDate: Date
  estimatedDuration: string
  deadline: Date
  status: InstallationStatus
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

// ─── Content Request ──────────────────────────────────────────────────────────
export type ContentMediaType = 'foto' | 'video' | 'desain' | 'reels' | 'katalog' | 'voice_over'
export type ContentPriority = 'low' | 'medium' | 'high' | 'urgent'
export type ContentRequestStatus = 'baru' | 'diproses' | 'revisi' | 'selesai'

export interface ContentRequest {
  id: string
  requestedBy: string
  assignedTo?: string
  productName: string
  contentType: ContentMediaType
  description: string
  priority: ContentPriority
  attachments: Attachment[]
  status: ContentRequestStatus
  revisionNotes?: string
  storageLink?: string
  deadline: Date
  createdAt: Date
}

// ─── Media Asset ──────────────────────────────────────────────────────────────
export type MediaAssetCategory =
  | 'logo_brand'
  | 'foto_produk'
  | 'video_produk'
  | 'template_desain'
  | 'font_warna_brand'
  | 'voice_over'
  | 'musik_sfx'
  | 'broll'

export interface MediaAsset {
  id: string
  category: MediaAssetCategory
  name: string
  fileUrl: string
  description?: string
  uploadedBy: string
  createdAt: Date
}

// ─── Content Data ─────────────────────────────────────────────────────────────
export type ContentCategory = 'produk' | 'edukasi' | 'testimoni' | 'promo' | 'event' | 'company_profile'
export type ContentPlatform = 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'website'
export type ContentFormat = '9:16' | '1:1' | '16:9' | 'a4' | 'banner'
export type ContentProductionStatus = 'draft' | 'editing' | 'review' | 'revisi' | 'approved' | 'final'

export interface ContentData {
  id: string
  seq: number
  title: string
  category: ContentCategory
  platform: ContentPlatform[]
  format: ContentFormat
  caption?: string
  voiceOverScript?: string
  hashtag?: string
  files: Attachment[]
  driveLink?: string
  productionStatus: ContentProductionStatus
  uploadDate?: Date
  pic: string
  createdBy: string
  createdAt: Date
}

// ─── Meeting ──────────────────────────────────────────────────────────────────
export type MeetingStatus = 'scheduled' | 'done' | 'cancelled'

export interface Meeting {
  id: string
  title: string
  createdBy: string
  participants: string[]
  scheduledAt: Date
  location: string
  agenda: string
  notes?: string
  status: MeetingStatus
}

// ─── Notification ─────────────────────────────────────────────────────────────
export type NotificationType =
  | 'task'
  | 'reminder'
  | 'invoice'
  | 'quotation'
  | 'dp_received'
  | 'warranty'
  | 'drawing_request'
  | 'bom_request'
  | 'content_request'
  | 'meeting'

export interface Notification {
  id: string
  recipientId: string
  type: NotificationType
  title: string
  message: string
  relatedId: string
  relatedCollection: string
  isRead: boolean
  createdAt: Date
}

// ─── After Sales (Service Ticket) ──────────────────────────────────────────────
export type ComplaintType = 'kerusakan' | 'instalasi' | 'training' | 'sparepart' | 'maintenance'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TicketStatus = 'baru' | 'diproses' | 'menunggu_sparepart' | 'selesai' | 'cancel'
export type WarrantyStatus = 'aktif' | 'habis' | 'tidak_garansi'

export interface AfterSales {
  id: string
  reportDate: Date
  customerId: string
  customerName?: string
  machineName: string
  complaintType: ComplaintType
  problemDescription: string
  mediaUrl?: string
  priority: TicketPriority
  ticketStatus: TicketStatus
  picAftersales: string
  technicianAssigned?: string
  purchaseDate?: Date
  installationDate?: Date
  warrantyPeriod?: string
  warrantyStatus: WarrantyStatus
  handlingDeadline?: Date
  createdBy: string
  updatedAt: Date
}
