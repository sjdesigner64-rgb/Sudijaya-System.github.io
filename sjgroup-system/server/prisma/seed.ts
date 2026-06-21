import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const DEFAULT_PASSWORD = 'Sudijaya2026!'

async function upsertUser(data: { name: string; email: string; role: string }) {
  const password = await bcrypt.hash(DEFAULT_PASSWORD, 10)
  return prisma.user.upsert({
    where: { email: data.email },
    update: {},
    create: { ...data, password, isActive: true },
  })
}

async function main() {
  // ── Users — satu per role ───────────────────────────────────
  const superAdmin = await upsertUser({ name: 'Super Admin', email: 'admin@sudijayagroup.com', role: 'super_admin' })
  const admin = await upsertUser({ name: 'Sinta Rahayu', email: 'finance@sudijayagroup.com', role: 'admin' })
  const sales1 = await upsertUser({ name: 'Budi Santoso', email: 'budi.sales@sudijayagroup.com', role: 'sales' })
  const sales2 = await upsertUser({ name: 'Rina Dewi', email: 'rina.sales@sudijayagroup.com', role: 'sales' })
  const fabrikasi = await upsertUser({ name: 'Fajar Nugroho', email: 'fajar.fabrikasi@sudijayagroup.com', role: 'fabrikasi' })
  const warehouse = await upsertUser({ name: 'Wahyu Prasetyo', email: 'wahyu.warehouse@sudijayagroup.com', role: 'warehouse' })
  const media = await upsertUser({ name: 'Dewi Lestari', email: 'dewi.media@sudijayagroup.com', role: 'media' })

  console.log('Users siap (password semua: %s):', DEFAULT_PASSWORD)
  ;[superAdmin, admin, sales1, sales2, fabrikasi, warehouse, media].forEach((u) =>
    console.log(`  - ${u.role.padEnd(11)} ${u.email}`)
  )

  // Bersihkan data transaksional lama (mis. hasil coba-coba form) supaya seed idempotent
  await prisma.notification.deleteMany()
  await prisma.afterSales.deleteMany()
  await prisma.meeting.deleteMany()
  await prisma.contentData.deleteMany()
  await prisma.mediaAsset.deleteMany()
  await prisma.contentRequest.deleteMany()
  await prisma.installation.deleteMany()
  await prisma.shipment.deleteMany()
  await prisma.warehouseStock.deleteMany()
  await prisma.ganttTask.deleteMany()
  await prisma.productionGantt.deleteMany()
  await prisma.bomRequest.deleteMany()
  await prisma.drawingRequest.deleteMany()
  await prisma.task.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.quotation.deleteMany()
  await prisma.project.deleteMany()
  await prisma.lead.deleteMany()
  await prisma.customer.deleteMany()

  // ── Customers ────────────────────────────────────────────────
  const customerAgro = await prisma.customer.create({
    data: { name: 'PT Agro Makmur', phone: '081234560001', email: 'procurement@agromakmur.co.id', source: 'whatsapp', status: 'active', npwp: '01.234.567.8-901.000', lastFollowUp: new Date('2026-06-10'), createdBy: sales1.id, isActive: true },
  })
  const customerSumberJaya = await prisma.customer.create({
    data: { name: 'CV Sumber Jaya', phone: '081234560002', email: 'cv.sumberjaya@gmail.com', source: 'iklan', status: 'prospect', lastFollowUp: new Date('2026-06-09'), createdBy: sales2.id, isActive: true },
  })
  const customerMajuBersama = await prisma.customer.create({
    data: { name: 'UD Maju Bersama', phone: '081234560003', email: 'majubersama@yahoo.com', source: 'offline', status: 'lead', lastFollowUp: new Date('2026-06-08'), createdBy: sales1.id, isActive: true },
  })
  const customerKaryaUtama = await prisma.customer.create({
    data: { name: 'PT Karya Utama', phone: '081234560004', email: 'purchasing@karyautama.com', source: 'whatsapp', status: 'closed', npwp: '02.345.678.9-012.000', lastFollowUp: new Date('2026-06-07'), createdBy: sales2.id, isActive: true },
  })

  // ── Leads ────────────────────────────────────────────────────
  await prisma.lead.createMany({
    data: [
      { customerId: customerAgro.id, customerName: customerAgro.name, productCategory: 'Zenchang', productName: 'Mesin Sortir PMX-300', source: 'whatsapp', status: 'qualified', assignedSales: sales1.id, lastFollowUp: new Date('2026-06-10'), notes: 'Sudah meeting awal, minta quotation.' },
      { customerId: customerSumberJaya.id, customerName: customerSumberJaya.name, productCategory: 'VNT', productName: 'VNT Destoner Basic', source: 'iklan', status: 'follow_up', assignedSales: sales2.id, lastFollowUp: new Date('2026-06-09'), notes: 'Follow up besok pagi.' },
      { customerId: customerMajuBersama.id, customerName: customerMajuBersama.name, productCategory: 'Nordic', productName: 'Nordic Conveyor 5m', source: 'offline', status: 'new', assignedSales: sales1.id, lastFollowUp: new Date('2026-06-08'), notes: '' },
      { customerId: customerKaryaUtama.id, customerName: customerKaryaUtama.name, productCategory: 'Zenyer', productName: 'Zenyer Cleaner Pro', source: 'whatsapp', status: 'closed_won', assignedSales: sales2.id, lastFollowUp: new Date('2026-06-07'), notes: 'Deal! DP sudah masuk.' },
      { customerId: customerAgro.id, customerName: customerAgro.name, productCategory: 'Pinecone', productName: 'Pinecone Sifter X2', source: 'whatsapp', status: 'closed_lost', assignedSales: sales1.id, lastFollowUp: new Date('2026-05-20'), notes: 'Budget tidak sesuai.' },
    ],
  })

  // ── Projects ─────────────────────────────────────────────────
  const projectPmx = await prisma.project.create({
    data: {
      name: 'Mesin Sortir PMX-300', customerId: customerAgro.id, customerName: customerAgro.name,
      salesPic: sales1.id, category: 'Zenchang', status: 'active', pipelineStage: 'fabrikasi_build',
      estimatedValue: 420000000, dpPercentage: 60, dpDate: new Date('2026-06-05'),
      estimatedDelivery: new Date('2026-07-15'),
      payments: [
        { amount: 252000000, percentage: 60, date: '2026-06-05T00:00:00.000Z', status: 'paid' },
        { amount: 168000000, percentage: 40, date: '2026-06-05T00:00:00.000Z', status: 'pending' },
      ],
    },
  })
  const projectVnt = await prisma.project.create({
    data: {
      name: 'VNT Destoner Basic', customerId: customerSumberJaya.id, customerName: customerSumberJaya.name,
      salesPic: sales2.id, category: 'VNT', status: 'active', pipelineStage: 'dp_layout',
      estimatedValue: 280000000, dpPercentage: 30, estimatedDelivery: new Date('2026-07-30'),
      payments: [{ amount: 84000000, percentage: 30, date: '2026-06-08T00:00:00.000Z', status: 'paid' }],
    },
  })
  const projectZenyer = await prisma.project.create({
    data: {
      name: 'Zenyer Cleaner Pro', customerId: customerKaryaUtama.id, customerName: customerKaryaUtama.name,
      salesPic: sales2.id, category: 'Zenyer', status: 'completed', pipelineStage: 'instalasi',
      estimatedValue: 195000000, dpPercentage: 100, estimatedDelivery: new Date('2026-06-01'),
      warrantyStartDate: new Date('2026-06-01'), warrantyEndDate: new Date('2027-06-01'),
      payments: [{ amount: 195000000, percentage: 100, date: '2026-05-15T00:00:00.000Z', status: 'paid' }],
    },
  })
  await prisma.project.create({
    data: {
      name: 'Pinecone Sifter X2', customerId: customerMajuBersama.id, customerName: customerMajuBersama.name,
      salesPic: sales1.id, category: 'Pinecone', status: 'active', pipelineStage: 'leads',
      estimatedValue: 175000000, dpPercentage: 0, payments: [],
    },
  })

  // ── Quotations ───────────────────────────────────────────────
  await prisma.quotation.create({
    data: {
      projectId: projectPmx.id, customerId: customerAgro.id, requestedBy: sales1.id, createdBy: admin.id,
      status: 'selesai', deadline: new Date('2026-06-20'),
      items: [{ description: 'Mesin Sortir PMX-300', qty: 1, unit: 'unit', price: 420000000 }],
      totalAmount: 420000000,
    },
  })
  await prisma.quotation.create({
    data: {
      projectId: projectVnt.id, customerId: customerSumberJaya.id, requestedBy: sales2.id, createdBy: admin.id,
      status: 'diproses', deadline: new Date('2026-06-22'),
      items: [{ description: 'VNT Destoner Basic', qty: 1, unit: 'unit', price: 280000000 }],
      totalAmount: 280000000,
    },
  })

  // ── Invoices ─────────────────────────────────────────────────
  await prisma.invoice.create({
    data: { projectId: projectPmx.id, customerId: customerAgro.id, invoiceNumber: 'INV-2026-001', createdBy: admin.id, amount: 420000000 },
  })
  await prisma.invoice.create({
    data: { projectId: projectZenyer.id, customerId: customerKaryaUtama.id, invoiceNumber: 'INV-2026-002', createdBy: admin.id, amount: 195000000 },
  })

  // ── Tasks ────────────────────────────────────────────────────
  await prisma.task.createMany({
    data: [
      { title: 'Follow up PT Agro Makmur', description: 'Konfirmasi keputusan quotation', assignedTo: sales1.id, assignedBy: admin.id, role: 'sales', status: 'pending', priority: 'high', dueDate: new Date('2026-06-20') },
      { title: 'Siapkan dokumen KTP & NPWP', description: 'Minta scan dokumen customer CV Sumber Jaya', assignedTo: sales2.id, assignedBy: admin.id, role: 'sales', status: 'in_progress', priority: 'medium', dueDate: new Date('2026-06-21') },
      { title: 'Kirim laporan mingguan', description: 'Rekap leads & closing minggu ini', assignedTo: sales1.id, assignedBy: admin.id, role: 'sales', status: 'done', priority: 'low', dueDate: new Date('2026-06-15') },
    ],
  })

  // ── Drawing & BOM Requests ───────────────────────────────────
  await prisma.drawingRequest.create({
    data: {
      projectId: projectPmx.id, requestedBy: sales1.id, assignedTo: [fabrikasi.id],
      projectName: projectPmx.name, deadline: new Date('2026-06-20'), priority: 'high', status: 'in_progress',
      attachments: [], resultAttachments: [], notes: 'Perlu gambar 3D dan detail cutting.',
    },
  })
  await prisma.drawingRequest.create({
    data: {
      projectId: projectVnt.id, requestedBy: sales2.id, assignedTo: [fabrikasi.id],
      projectName: projectVnt.name, deadline: new Date('2026-06-25'), priority: 'medium', status: 'pending',
      attachments: [], resultAttachments: [], notes: '',
    },
  })

  await prisma.bomRequest.create({
    data: { projectId: projectPmx.id, requestedBy: sales1.id, status: 'pending_fabrikasi', attachments: [], visibleTo: ['admin'], notes: 'Butuh BOM lengkap termasuk material listrik.' },
  })
  await prisma.bomRequest.create({
    data: { projectId: projectVnt.id, requestedBy: sales2.id, status: 'pending_admin', attachments: [], visibleTo: ['admin'], notes: '' },
  })

  // ── Production Gantt ─────────────────────────────────────────
  const gantt = await prisma.productionGantt.create({
    data: { projectId: projectPmx.id, projectName: projectPmx.name, salesPic: sales1.id, overallDeadline: new Date('2026-07-15'), status: 'active' },
  })
  await prisma.ganttTask.createMany({
    data: [
      { ganttId: gantt.id, taskName: 'drawing', deadline: new Date('2026-06-18'), startDate: new Date('2026-06-12'), status: 'done', pic: [fabrikasi.id], notes: [] },
      { ganttId: gantt.id, taskName: 'purchase_material', deadline: new Date('2026-06-22'), startDate: new Date('2026-06-19'), status: 'in_progress', pic: [fabrikasi.id], notes: [] },
      { ganttId: gantt.id, taskName: 'cutting_laser', deadline: new Date('2026-06-28'), startDate: new Date('2026-06-23'), status: 'pending', pic: [fabrikasi.id], notes: [] },
      { ganttId: gantt.id, taskName: 'vendor', deadline: new Date('2026-07-02'), startDate: new Date('2026-06-25'), status: 'pending', pic: [fabrikasi.id], notes: [] },
      { ganttId: gantt.id, taskName: 'fabrikasi', deadline: new Date('2026-07-07'), startDate: new Date('2026-07-01'), status: 'pending', pic: [fabrikasi.id], notes: [] },
      { ganttId: gantt.id, taskName: 'electrical', deadline: new Date('2026-07-10'), startDate: new Date('2026-07-06'), status: 'pending', pic: [fabrikasi.id], notes: [] },
      { ganttId: gantt.id, taskName: 'qc_fat', deadline: new Date('2026-07-12'), startDate: new Date('2026-07-10'), status: 'pending', pic: [fabrikasi.id], notes: [] },
      { ganttId: gantt.id, taskName: 'instalasi', deadline: new Date('2026-07-15'), startDate: new Date('2026-07-13'), status: 'pending', pic: [fabrikasi.id], notes: [] },
    ],
  })

  // ── Warehouse Stock ──────────────────────────────────────────
  await prisma.warehouseStock.createMany({
    data: [
      { name: 'Mesin Sortir PMX-300', category: 'mesin', quantity: 2, unit: 'unit', dimensions: { length: 200, width: 150, height: 180, unit: 'cm' }, weight: 850, status: 'ready' },
      { name: 'Bearing SKF 6205', category: 'sparepart_pmx', quantity: 5, unit: 'pcs', dimensions: { length: 10, width: 10, height: 5, unit: 'cm' }, weight: 0.5, status: 'ready' },
      { name: 'V-Belt A-45', category: 'sparepart_basic_destoner', quantity: 2, unit: 'pcs', dimensions: { length: 50, width: 2, height: 1, unit: 'cm' }, weight: 0.2, status: 'low_stock' },
      { name: 'Baut M10x30', category: 'sparepart_umum', quantity: 0, unit: 'pcs', dimensions: { length: 3, width: 1, height: 1, unit: 'cm' }, weight: 0.05, status: 'out_of_stock' },
    ],
  })

  // ── Shipment (Pengiriman) ──────────────────────────────────────
  await prisma.shipment.create({
    data: {
      projectId: projectZenyer.id, projectName: projectZenyer.name, sku: 'ZNY-CLP-001', quantity: 1, weight: 620,
      dimensions: { length: 180, width: 120, height: 160, unit: 'cm' }, condition: 'baru',
      address: 'Jl. Industri Raya No. 45, Karawang, Jawa Barat', picPengiriman: fabrikasi.id,
      packingNotes: 'Packing kayu + bubble wrap, pallet standar ekspedisi.', createdBy: fabrikasi.id,
    },
  })
  await prisma.shipment.create({
    data: {
      projectId: projectPmx.id, projectName: projectPmx.name, sku: 'PMX-300-001', quantity: 1, weight: 850,
      dimensions: { length: 200, width: 150, height: 180, unit: 'cm' }, condition: 'baru',
      address: 'Jl. Raya Bekasi KM 27, Bekasi, Jawa Barat', picPengiriman: fabrikasi.id,
      packingNotes: 'Menunggu jadwal QC FAT selesai sebelum packing.', createdBy: fabrikasi.id,
    },
  })

  // ── Installation (Instalasi) ───────────────────────────────────
  await prisma.installation.create({
    data: {
      projectId: projectZenyer.id, projectName: projectZenyer.name, picInstalasi: fabrikasi.id,
      installationDate: new Date('2026-06-02'), estimatedDuration: '2 hari', deadline: new Date('2026-06-03'),
      status: 'selesai', createdBy: fabrikasi.id,
    },
  })
  await prisma.installation.create({
    data: {
      projectId: projectPmx.id, projectName: projectPmx.name, picInstalasi: fabrikasi.id,
      installationDate: new Date('2026-07-16'), estimatedDuration: '3 hari', deadline: new Date('2026-07-18'),
      status: 'dijadwalkan', createdBy: fabrikasi.id,
    },
  })

  // ── Content Requests ─────────────────────────────────────────
  await prisma.contentRequest.create({
    data: {
      requestedBy: sales1.id, assignedTo: media.id, productName: 'Mesin Sortir PMX-300', contentType: 'video',
      description: 'Foto dan video demo mesin, angle 3 sisi.', priority: 'high', attachments: [],
      status: 'diproses', deadline: new Date('2026-06-25'),
    },
  })
  await prisma.contentRequest.create({
    data: {
      requestedBy: sales2.id, productName: 'VNT Destoner Basic', contentType: 'reels',
      description: 'Konten untuk Instagram Reels, durasi 30 detik.', priority: 'medium', attachments: [],
      status: 'baru', deadline: new Date('2026-06-30'),
    },
  })
  await prisma.contentRequest.create({
    data: {
      requestedBy: sales2.id, assignedTo: media.id, productName: 'Zenyer Cleaner Pro', contentType: 'foto',
      description: 'Foto produk untuk katalog dan website.', priority: 'urgent', attachments: [],
      status: 'revisi', revisionNotes: 'Foto kurang terang, tolong reshoot dengan pencahayaan lebih baik.',
      deadline: new Date('2026-06-18'),
    },
  })

  // ── Media Assets ───────────────────────────────────────────────
  await prisma.mediaAsset.createMany({
    data: [
      { category: 'logo_brand', name: 'Logo Sudijaya Group (PNG transparan)', fileUrl: 'https://example.com/assets/logo-sudijaya-group.png', description: 'Logo utama, background transparan.', uploadedBy: media.id },
      { category: 'foto_produk', name: 'Foto Mesin Sortir PMX-300', fileUrl: 'https://example.com/assets/foto-pmx-300.jpg', description: 'Foto studio, 4 angle.', uploadedBy: media.id },
      { category: 'video_produk', name: 'Video Demo VNT Destoner Basic', fileUrl: 'https://example.com/assets/video-vnt-destoner.mp4', description: 'Mesin berjalan, durasi 2 menit.', uploadedBy: media.id },
      { category: 'template_desain', name: 'Template Feed Instagram', fileUrl: 'https://example.com/assets/template-feed-ig.psd', description: 'Template 1:1, brand color Sudijaya.', uploadedBy: media.id },
      { category: 'font_warna_brand', name: 'Brand Guideline Sudijaya Group', fileUrl: 'https://example.com/assets/brand-guideline.pdf', description: 'Font, palet warna, dan logo usage.', uploadedBy: media.id },
      { category: 'voice_over', name: 'VO Promosi Produk Q3 2026', fileUrl: 'https://example.com/assets/vo-promosi-q3.mp3', description: 'Narasi Bahasa Indonesia, durasi 45 detik.', uploadedBy: media.id },
      { category: 'musik_sfx', name: 'Background Music Corporate', fileUrl: 'https://example.com/assets/bgm-corporate.mp3', description: 'Royalty-free, cocok utk company profile.', uploadedBy: media.id },
      { category: 'broll', name: 'B-roll Workshop Fabrikasi', fileUrl: 'https://example.com/assets/broll-workshop.mp4', description: 'Suasana proses fabrikasi di workshop.', uploadedBy: media.id },
    ],
  })

  // ── Content Data ─────────────────────────────────────────────
  await prisma.contentData.create({
    data: {
      title: 'Promo Mesin Sortir PMX-300', category: 'promo', platform: ['instagram', 'facebook'], format: '1:1',
      caption: 'Tingkatkan efisiensi sortir hasil panen Anda dengan PMX-300! Hubungi kami untuk penawaran terbaik.',
      hashtag: '#sudijayagroup #mesinsortir #pmx300', driveLink: 'https://drive.google.com/drive/folders/dummy-promo-pmx300',
      productionStatus: 'final', uploadDate: new Date('2026-06-12'), pic: media.id, createdBy: media.id, files: [],
    },
  })
  await prisma.contentData.create({
    data: {
      title: 'Tutorial Pemakaian VNT Destoner Basic', category: 'edukasi', platform: ['youtube'], format: '16:9',
      caption: 'Panduan lengkap mengoperasikan VNT Destoner Basic untuk hasil panen lebih bersih.',
      voiceOverScript: 'Halo, di video kali ini kami akan menunjukkan cara mengoperasikan VNT Destoner Basic...',
      productionStatus: 'editing', pic: media.id, createdBy: media.id, files: [],
    },
  })
  await prisma.contentData.create({
    data: {
      title: 'Testimoni PT Karya Utama', category: 'testimoni', platform: ['instagram', 'tiktok'], format: '9:16',
      caption: 'Dengar langsung pengalaman PT Karya Utama menggunakan Zenyer Cleaner Pro.',
      hashtag: '#testimoni #zenyercleanerpro', productionStatus: 'review', pic: media.id, createdBy: media.id, files: [],
    },
  })
  await prisma.contentData.create({
    data: {
      title: 'Company Profile Sudijaya Group 2026', category: 'company_profile', platform: ['website', 'youtube'], format: '16:9',
      caption: 'Profil perusahaan Sudijaya Group — mesin fabrikasi berkualitas sejak berdiri.',
      productionStatus: 'draft', pic: media.id, createdBy: media.id, files: [],
    },
  })

  // ── Meetings ─────────────────────────────────────────────────
  await prisma.meeting.create({
    data: { title: 'Meeting Fabrikasi PMX-300', createdBy: admin.id, participants: [sales1.id, fabrikasi.id], scheduledAt: new Date('2026-06-22T09:00:00'), location: 'Ruang Rapat Lantai 2', agenda: 'Briefing teknis drawing dan BOM untuk PMX-300', status: 'scheduled' },
  })
  await prisma.meeting.create({
    data: { title: 'Review Progress VNT Destoner', createdBy: admin.id, participants: [sales2.id, fabrikasi.id], scheduledAt: new Date('2026-06-13T13:00:00'), location: 'Workshop Fabrikasi', agenda: 'Cek progress fabrikasi dan kendala teknis', status: 'done' },
  })

  // ── After-Sales ──────────────────────────────────────────────
  await prisma.afterSales.create({
    data: {
      reportDate: new Date('2026-06-10'), customerId: customerKaryaUtama.id, customerName: customerKaryaUtama.name,
      machineName: 'Zenyer Cleaner Pro', complaintType: 'maintenance', problemDescription: 'Permintaan maintenance rutin 6 bulan pertama.',
      priority: 'low', ticketStatus: 'selesai', picAftersales: sales2.id, technicianAssigned: fabrikasi.id,
      purchaseDate: new Date('2026-05-15'), installationDate: new Date('2026-06-01'),
      warrantyPeriod: '1 tahun', warrantyStatus: 'aktif', handlingDeadline: new Date('2026-06-15'),
      createdBy: admin.id,
    },
  })

  // ── Notifications (contoh untuk inbox) ────────────────────────
  await prisma.notification.createMany({
    data: [
      { recipientId: fabrikasi.id, type: 'dp_received', title: 'DP Masuk', message: 'Down Payment telah masuk untuk project Mesin Sortir PMX-300.', relatedId: projectPmx.id, relatedCollection: 'projects', isRead: false },
      { recipientId: sales1.id, type: 'quotation', title: 'Quotation Siap', message: 'Quotation untuk Mesin Sortir PMX-300 telah selesai dibuat.', relatedId: projectPmx.id, relatedCollection: 'quotations', isRead: true },
    ],
  })

  console.log('Dummy data transaksional berhasil dibuat: 4 customers, 5 leads, 4 projects, 2 quotations, 2 invoices, 3 tasks, 2 drawing requests, 2 BOM requests, 1 gantt (8 tasks), 4 stok gudang, 2 shipment, 2 installation, 3 content requests, 8 media assets, 4 content data, 2 meetings, 1 after-sales, 2 notifikasi.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
