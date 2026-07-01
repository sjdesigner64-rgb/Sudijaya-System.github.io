// @ts-nocheck
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const DEFAULT_PASSWORD = 'Sudijaya2026!'

async function upsertUser(data: { name: string; email: string; role: string }) {
  const password = await bcrypt.hash(DEFAULT_PASSWORD, 10)
  return prisma.user.upsert({
    where: { email: data.email },
    update: { name: data.name, role: data.role, password, isActive: true },
    create: { ...data, password, isActive: true },
  })
}

async function main() {
  // ── Users ───────────────────────────────────────────────────
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

  // Bersihkan data transaksional lama
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
    data: {
      name: 'PT Agro Makmur', phone: '081234560001', email: 'procurement@agromakmur.co.id',
      source: 'whatsapp', status: 'active', npwp: '01.234.567.8-901.000',
      lastFollowUp: new Date('2026-06-10'), createdBy: sales1.id, isActive: true,
    },
  })
  const customerSumberJaya = await prisma.customer.create({
    data: {
      name: 'CV Sumber Jaya', phone: '081234560002', email: 'cv.sumberjaya@gmail.com',
      source: 'iklan', status: 'prospect', npwp: '03.456.789.0-123.000',
      lastFollowUp: new Date('2026-06-09'), createdBy: sales2.id, isActive: true,
    },
  })
  const customerMajuBersama = await prisma.customer.create({
    data: {
      name: 'UD Maju Bersama', phone: '081234560003', email: 'majubersama@yahoo.com',
      source: 'offline', status: 'lead', npwp: '04.567.890.1-234.000',
      lastFollowUp: new Date('2026-06-08'), createdBy: sales1.id, isActive: true,
    },
  })
  const customerKaryaUtama = await prisma.customer.create({
    data: {
      name: 'PT Karya Utama', phone: '081234560004', email: 'purchasing@karyautama.com',
      source: 'whatsapp', status: 'closed', npwp: '02.345.678.9-012.000',
      lastFollowUp: new Date('2026-06-07'), createdBy: sales2.id, isActive: true,
    },
  })

  // ── Leads ────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.lead.createMany as any)({
    data: [
      {
        customerId: customerAgro.id, customerName: customerAgro.name,
        productCategory: 'Zenchang', productName: 'Mesin Sortir PMX-300',
        source: 'whatsapp', assignedSales: sales1.id, lastFollowUp: new Date('2026-06-10'),
        notes: 'Sudah meeting awal, minta quotation.', phone: '081234560001',
        estimatedCost: 420000000, dpPelunasan: 'sudah_dp',
        tanggal: new Date('2026-06-10'), lokasi: 'Bekasi',
        alamat: 'Jl. Industri Raya No. 45, Bekasi, Jawa Barat',
      },
      {
        customerId: customerSumberJaya.id, customerName: customerSumberJaya.name,
        productCategory: 'VNT', productName: 'VNT Destoner Basic',
        source: 'iklan', assignedSales: sales2.id, lastFollowUp: new Date('2026-06-09'),
        notes: 'Follow up besok pagi. Customer tertarik tapi minta demo dulu.', phone: '081234560002',
        estimatedCost: 280000000, dpPelunasan: 'belum_dp',
        tanggal: new Date('2026-06-09'), lokasi: 'Karawang',
        alamat: 'Jl. Surotokunto No. 20, Karawang, Jawa Barat',
      },
      {
        customerId: customerMajuBersama.id, customerName: customerMajuBersama.name,
        productCategory: 'Nordic', productName: 'Nordic Conveyor 5m',
        source: 'offline', assignedSales: sales1.id, lastFollowUp: new Date('2026-06-08'),
        notes: 'Sudah lunas dan sudah dikirim.', phone: '081234560003',
        estimatedCost: 175000000, dpPelunasan: 'sudah_lunas', pengiriman: 'selesai',
        tanggal: new Date('2026-05-20'), lokasi: 'Bandung',
        alamat: 'Jl. Soekarno Hatta No. 12, Bandung, Jawa Barat',
      },
      {
        customerId: customerKaryaUtama.id, customerName: customerKaryaUtama.name,
        productCategory: 'Zenyer', productName: 'Zenyer Cleaner Pro',
        source: 'whatsapp', assignedSales: sales2.id, lastFollowUp: new Date('2026-06-07'),
        notes: 'DP sudah masuk. Menunggu jadwal produksi.', phone: '081234560004',
        estimatedCost: 195000000, dpPelunasan: 'sudah_dp',
        tanggal: new Date('2026-06-01'), lokasi: 'Karawang',
        alamat: 'Jl. Kertabumi No. 88, Karawang, Jawa Barat',
      },
      {
        customerId: customerAgro.id, customerName: customerAgro.name,
        productCategory: 'Pinecone', productName: 'Pinecone Sifter X2',
        source: 'whatsapp', assignedSales: sales1.id, lastFollowUp: new Date('2026-05-20'),
        notes: 'Negosiasi gagal, budget tidak sesuai.', phone: '081234560001',
        estimatedCost: 90000000, dpPelunasan: 'belum_dp',
        tanggal: new Date('2026-05-15'), lokasi: 'Bekasi',
        alamat: 'Jl. Industri Raya No. 45, Bekasi, Jawa Barat',
      },
    ],
  })

  // ── Projects ─────────────────────────────────────────────────
  const projectPmx = await prisma.project.create({
    data: {
      name: 'Mesin Sortir PMX-300', customerId: customerAgro.id, customerName: customerAgro.name,
      salesPic: sales1.id, category: 'Zenchang', status: 'active', pipelineStage: 'fabrikasi_build',
      estimatedValue: 420000000, dpPercentage: 60, dpDate: new Date('2026-06-05'),
      estimatedDelivery: new Date('2026-07-15'),
      phone: '081234560001', alamat: 'Jl. Industri Raya No. 45, Bekasi, Jawa Barat',
      payments: [
        { amount: 252000000, percentage: 60, date: '2026-06-05T00:00:00.000Z', status: 'paid', label: 'Down Payment 60%' },
        { amount: 168000000, percentage: 40, date: '2026-07-10T00:00:00.000Z', status: 'pending', label: 'Pelunasan 40%' },
      ],
      meetingNotes: [
        { date: '2026-06-01T09:00:00.000Z', notes: 'Meeting awal: customer setuju spesifikasi PMX-300 standar, estimasi harga Rp 420jt.' },
        { date: '2026-06-04T14:00:00.000Z', notes: 'Konfirmasi DP 60%, transfer dijadwalkan 5 Juni 2026.' },
      ],
    },
  })

  const projectVnt = await prisma.project.create({
    data: {
      name: 'VNT Destoner Basic', customerId: customerSumberJaya.id, customerName: customerSumberJaya.name,
      salesPic: sales2.id, category: 'VNT', status: 'active', pipelineStage: 'dp_layout',
      estimatedValue: 280000000, dpPercentage: 30, dpDate: new Date('2026-06-08'),
      estimatedDelivery: new Date('2026-07-30'),
      phone: '081234560002', alamat: 'Jl. Surotokunto No. 20, Karawang, Jawa Barat',
      payments: [
        { amount: 84000000, percentage: 30, date: '2026-06-08T00:00:00.000Z', status: 'paid', label: 'Down Payment 30%' },
        { amount: 196000000, percentage: 70, date: '2026-07-25T00:00:00.000Z', status: 'pending', label: 'Pelunasan 70%' },
      ],
      meetingNotes: [
        { date: '2026-06-05T10:00:00.000Z', notes: 'Presentasi produk VNT Destoner Basic. Customer puas dengan demo, setuju harga Rp 280jt.' },
      ],
    },
  })

  const projectZenyer = await prisma.project.create({
    data: {
      name: 'Zenyer Cleaner Pro', customerId: customerKaryaUtama.id, customerName: customerKaryaUtama.name,
      salesPic: sales2.id, category: 'Zenyer', status: 'completed', pipelineStage: 'instalasi',
      estimatedValue: 195000000, dpPercentage: 100, dpDate: new Date('2026-05-15'),
      fullPaymentDate: new Date('2026-05-28'), estimatedDelivery: new Date('2026-06-01'),
      warrantyStartDate: new Date('2026-06-01'), warrantyEndDate: new Date('2027-06-01'),
      phone: '081234560004', alamat: 'Jl. Kertabumi No. 88, Karawang, Jawa Barat',
      payments: [
        { amount: 97500000, percentage: 50, date: '2026-05-15T00:00:00.000Z', status: 'paid', label: 'Down Payment 50%' },
        { amount: 97500000, percentage: 50, date: '2026-05-28T00:00:00.000Z', status: 'paid', label: 'Pelunasan 50%' },
      ],
      meetingNotes: [
        { date: '2026-05-10T09:00:00.000Z', notes: 'Deal final. Customer pilih Zenyer Cleaner Pro untuk kapasitas 2 ton/jam.' },
        { date: '2026-05-27T11:00:00.000Z', notes: 'Konfirmasi pelunasan hari ini. Pengiriman dijadwalkan 1 Juni 2026.' },
      ],
    },
  })

  await prisma.project.create({
    data: {
      name: 'Pinecone Sifter X2', customerId: customerMajuBersama.id, customerName: customerMajuBersama.name,
      salesPic: sales1.id, category: 'Pinecone', status: 'active', pipelineStage: 'leads',
      estimatedValue: 175000000, dpPercentage: 0, estimatedDelivery: new Date('2026-09-01'),
      phone: '081234560003', alamat: 'Jl. Soekarno Hatta No. 12, Bandung, Jawa Barat',
      payments: [],
      meetingNotes: [
        { date: '2026-06-08T10:00:00.000Z', notes: 'Pertemuan pertama. Customer tertarik tapi perlu diskusi internal dulu soal budget.' },
      ],
    },
  })

  // ── Quotations ───────────────────────────────────────────────
  const quotationPmx = await prisma.quotation.create({
    data: {
      projectId: projectPmx.id, customerId: customerAgro.id, requestedBy: sales1.id, createdBy: admin.id,
      customerName: customerAgro.name, machineName: 'Mesin Sortir PMX-300',
      picSales: sales1.id, lokasi: 'Bekasi, Jawa Barat', tanggal: new Date('2026-06-03'),
      status: 'selesai', deadline: new Date('2026-06-20'),
      items: [
        { description: 'Mesin Sortir PMX-300 (unit utama)', qty: 1, unit: 'unit', price: 380000000 },
        { description: 'Instalasi & komisioning', qty: 1, unit: 'paket', price: 25000000 },
        { description: 'Training operator (2 hari)', qty: 1, unit: 'paket', price: 15000000 },
      ],
      totalAmount: 420000000,
    },
  })

  const quotationVnt = await prisma.quotation.create({
    data: {
      projectId: projectVnt.id, customerId: customerSumberJaya.id, requestedBy: sales2.id, createdBy: admin.id,
      customerName: customerSumberJaya.name, machineName: 'VNT Destoner Basic',
      picSales: sales2.id, lokasi: 'Karawang, Jawa Barat', tanggal: new Date('2026-06-06'),
      status: 'diproses', deadline: new Date('2026-06-22'),
      items: [
        { description: 'VNT Destoner Basic (unit utama)', qty: 1, unit: 'unit', price: 255000000 },
        { description: 'Sparepart awal 1 tahun', qty: 1, unit: 'paket', price: 15000000 },
        { description: 'Ongkos kirim & instalasi', qty: 1, unit: 'paket', price: 10000000 },
      ],
      totalAmount: 280000000,
    },
  })

  const quotationZenyer = await prisma.quotation.create({
    data: {
      projectId: projectZenyer.id, customerId: customerKaryaUtama.id, requestedBy: sales2.id, createdBy: admin.id,
      customerName: customerKaryaUtama.name, machineName: 'Zenyer Cleaner Pro',
      picSales: sales2.id, lokasi: 'Karawang, Jawa Barat', tanggal: new Date('2026-05-08'),
      status: 'selesai', deadline: new Date('2026-05-12'),
      items: [
        { description: 'Zenyer Cleaner Pro (unit utama)', qty: 1, unit: 'unit', price: 175000000 },
        { description: 'Konveyor pengumpan', qty: 1, unit: 'unit', price: 12000000 },
        { description: 'Instalasi & komisioning', qty: 1, unit: 'paket', price: 8000000 },
      ],
      totalAmount: 195000000,
    },
  })

  // ── Invoices ─────────────────────────────────────────────────
  await prisma.invoice.create({
    data: {
      projectId: projectPmx.id, quotationId: quotationPmx.id,
      customerId: customerAgro.id, customerName: customerAgro.name, projectName: projectPmx.name,
      invoiceNumber: 'INV-2026-001', createdBy: admin.id, picSales: sales1.id, amount: 252000000,
    },
  })
  await prisma.invoice.create({
    data: {
      projectId: projectZenyer.id, quotationId: quotationZenyer.id,
      customerId: customerKaryaUtama.id, customerName: customerKaryaUtama.name, projectName: projectZenyer.name,
      invoiceNumber: 'INV-2026-002', createdBy: admin.id, picSales: sales2.id, amount: 97500000,
    },
  })
  await prisma.invoice.create({
    data: {
      projectId: projectZenyer.id, quotationId: quotationZenyer.id,
      customerId: customerKaryaUtama.id, customerName: customerKaryaUtama.name, projectName: projectZenyer.name,
      invoiceNumber: 'INV-2026-003', createdBy: admin.id, picSales: sales2.id, amount: 97500000,
    },
  })

  // ── Tasks ────────────────────────────────────────────────────
  await prisma.task.createMany({
    data: [
      { title: 'Follow up PT Agro Makmur', description: 'Konfirmasi keputusan quotation PMX-300 dan tanyakan jadwal transfer DP', assignedTo: sales1.id, assignedBy: admin.id, role: 'sales', status: 'pending', priority: 'high', dueDate: new Date('2026-06-28') },
      { title: 'Siapkan dokumen KTP & NPWP CV Sumber Jaya', description: 'Minta scan dokumen untuk keperluan invoice dan BPHTB', assignedTo: sales2.id, assignedBy: admin.id, role: 'sales', status: 'in_progress', priority: 'medium', dueDate: new Date('2026-06-29') },
      { title: 'Kirim laporan mingguan sales', description: 'Rekap leads, progress project, dan closing minggu ke-26', assignedTo: sales1.id, assignedBy: admin.id, role: 'sales', status: 'done', priority: 'low', dueDate: new Date('2026-06-21') },
      { title: 'Cek ketersediaan material PMX-300', description: 'Konfirmasi stok bearing, v-belt, dan komponen elektrikal ke supplier', assignedTo: fabrikasi.id, assignedBy: admin.id, role: 'fabrikasi', status: 'in_progress', priority: 'high', dueDate: new Date('2026-06-27') },
      { title: 'Update stok gudang', description: 'Input hasil penerimaan barang dari supplier minggu ini', assignedTo: warehouse.id, assignedBy: admin.id, role: 'warehouse', status: 'pending', priority: 'medium', dueDate: new Date('2026-06-30') },
    ],
  })

  // ── Drawing & BOM Requests ───────────────────────────────────
  await prisma.drawingRequest.create({
    data: {
      projectId: projectPmx.id, requestedBy: sales1.id, assignedTo: [fabrikasi.id],
      projectName: projectPmx.name, deadline: new Date('2026-06-20'), priority: 'high', status: 'in_progress',
      attachments: [], resultAttachments: [],
      notes: 'Perlu gambar 3D dan detail cutting plate. Ukuran sesuai spesifikasi lampiran quotation.',
    },
  })
  await prisma.drawingRequest.create({
    data: {
      projectId: projectVnt.id, requestedBy: sales2.id, assignedTo: [fabrikasi.id],
      projectName: projectVnt.name, deadline: new Date('2026-06-28'), priority: 'medium', status: 'pending',
      attachments: [], resultAttachments: [],
      notes: 'Gambar teknis untuk komponen destoner & dudukan konveyor. Mengacu standar VNT-B series.',
    },
  })
  await prisma.drawingRequest.create({
    data: {
      projectId: projectZenyer.id, requestedBy: sales2.id, assignedTo: [fabrikasi.id],
      projectName: projectZenyer.name, deadline: new Date('2026-05-18'), priority: 'high', status: 'done',
      attachments: [], resultAttachments: [],
      notes: 'Gambar sudah selesai dan disetujui customer. Proses fabrikasi sudah dimulai.',
    },
  })

  await prisma.bomRequest.create({
    data: {
      projectId: projectPmx.id, requestedBy: sales1.id, status: 'pending_fabrikasi',
      attachments: [], visibleTo: ['admin', 'fabrikasi'],
      notes: 'Butuh BOM lengkap termasuk material listrik (kabel, MCB, inverter). Sertakan estimasi harga dari supplier.',
    },
  })
  await prisma.bomRequest.create({
    data: {
      projectId: projectVnt.id, requestedBy: sales2.id, assignedAdmin: admin.id, status: 'pending_admin',
      attachments: [], visibleTo: ['admin', 'fabrikasi'],
      notes: 'BOM sudah dibuat oleh fabrikasi, menunggu review dan persetujuan admin untuk purchase order.',
    },
  })
  await prisma.bomRequest.create({
    data: {
      projectId: projectZenyer.id, requestedBy: sales2.id, assignedAdmin: admin.id, status: 'done',
      attachments: [], visibleTo: ['admin', 'fabrikasi', 'sales'],
      notes: 'BOM final sudah disetujui. Total material Rp 82jt dari 3 supplier.',
      resultUrl: 'https://drive.google.com/file/d/dummy-bom-zenyer/view',
    },
  })

  // ── Production Gantt ─────────────────────────────────────────
  const ganttPmx = await prisma.productionGantt.create({
    data: { projectId: projectPmx.id, projectName: projectPmx.name, salesPic: sales1.id, overallDeadline: new Date('2026-07-15'), status: 'active' },
  })
  await prisma.ganttTask.createMany({
    data: [
      { ganttId: ganttPmx.id, taskName: 'drawing', deadline: new Date('2026-06-18'), startDate: new Date('2026-06-12'), completedDate: new Date('2026-06-17'), status: 'done', pic: [fabrikasi.id], notes: [{ date: new Date('2026-06-17'), content: 'Gambar teknis selesai, sudah dikirim ke sales untuk konfirmasi customer.', createdBy: fabrikasi.id }] },
      { ganttId: ganttPmx.id, taskName: 'purchase_material', deadline: new Date('2026-06-22'), startDate: new Date('2026-06-19'), status: 'in_progress', pic: [fabrikasi.id], notes: [{ date: new Date('2026-06-20'), content: 'PO sudah dikirim ke supplier. Estimasi material tiba 22-23 Juni.', createdBy: fabrikasi.id }] },
      { ganttId: ganttPmx.id, taskName: 'cutting_laser', deadline: new Date('2026-06-28'), startDate: new Date('2026-06-23'), status: 'pending', pic: [fabrikasi.id], notes: [] },
      { ganttId: ganttPmx.id, taskName: 'vendor', deadline: new Date('2026-07-02'), startDate: new Date('2026-06-25'), status: 'pending', pic: [fabrikasi.id], notes: [] },
      { ganttId: ganttPmx.id, taskName: 'fabrikasi', deadline: new Date('2026-07-07'), startDate: new Date('2026-07-01'), status: 'pending', pic: [fabrikasi.id], notes: [] },
      { ganttId: ganttPmx.id, taskName: 'electrical', deadline: new Date('2026-07-10'), startDate: new Date('2026-07-06'), status: 'pending', pic: [fabrikasi.id], notes: [] },
      { ganttId: ganttPmx.id, taskName: 'qc_fat', deadline: new Date('2026-07-12'), startDate: new Date('2026-07-10'), status: 'pending', pic: [fabrikasi.id], notes: [] },
      { ganttId: ganttPmx.id, taskName: 'instalasi', deadline: new Date('2026-07-15'), startDate: new Date('2026-07-13'), status: 'pending', pic: [fabrikasi.id], notes: [] },
    ],
  })

  const ganttZenyer = await prisma.productionGantt.create({
    data: { projectId: projectZenyer.id, projectName: projectZenyer.name, salesPic: sales2.id, overallDeadline: new Date('2026-05-30'), status: 'completed' },
  })
  await prisma.ganttTask.createMany({
    data: [
      { ganttId: ganttZenyer.id, taskName: 'drawing', deadline: new Date('2026-05-14'), startDate: new Date('2026-05-11'), completedDate: new Date('2026-05-13'), status: 'done', pic: [fabrikasi.id], notes: [] },
      { ganttId: ganttZenyer.id, taskName: 'purchase_material', deadline: new Date('2026-05-17'), startDate: new Date('2026-05-14'), completedDate: new Date('2026-05-16'), status: 'done', pic: [fabrikasi.id], notes: [] },
      { ganttId: ganttZenyer.id, taskName: 'cutting_laser', deadline: new Date('2026-05-20'), startDate: new Date('2026-05-17'), completedDate: new Date('2026-05-19'), status: 'done', pic: [fabrikasi.id], notes: [] },
      { ganttId: ganttZenyer.id, taskName: 'vendor', deadline: new Date('2026-05-22'), startDate: new Date('2026-05-20'), completedDate: new Date('2026-05-21'), status: 'done', pic: [fabrikasi.id], notes: [] },
      { ganttId: ganttZenyer.id, taskName: 'fabrikasi', deadline: new Date('2026-05-26'), startDate: new Date('2026-05-22'), completedDate: new Date('2026-05-25'), status: 'done', pic: [fabrikasi.id], notes: [] },
      { ganttId: ganttZenyer.id, taskName: 'electrical', deadline: new Date('2026-05-28'), startDate: new Date('2026-05-26'), completedDate: new Date('2026-05-27'), status: 'done', pic: [fabrikasi.id], notes: [] },
      { ganttId: ganttZenyer.id, taskName: 'qc_fat', deadline: new Date('2026-05-30'), startDate: new Date('2026-05-28'), completedDate: new Date('2026-05-29'), status: 'done', pic: [fabrikasi.id], notes: [] },
      { ganttId: ganttZenyer.id, taskName: 'instalasi', deadline: new Date('2026-06-03'), startDate: new Date('2026-06-02'), completedDate: new Date('2026-06-03'), status: 'done', pic: [fabrikasi.id], notes: [] },
    ],
  })

  // ── Warehouse Stock ──────────────────────────────────────────
  await prisma.warehouseStock.createMany({
    data: [
      { name: 'Mesin Sortir PMX-300', category: 'mesin', quantity: 2, unit: 'unit', dimensions: { length: 200, width: 150, height: 180, unit: 'cm' }, weight: 850, gdriveLink: 'https://drive.google.com/drive/folders/dummy-stock-pmx300', status: 'ready' },
      { name: 'Bearing SKF 6205', category: 'sparepart_pmx', quantity: 5, unit: 'pcs', dimensions: { length: 10, width: 10, height: 5, unit: 'cm' }, weight: 0.5, gdriveLink: 'https://drive.google.com/drive/folders/dummy-stock-bearing', status: 'ready' },
      { name: 'V-Belt A-45', category: 'sparepart_basic_destoner', quantity: 2, unit: 'pcs', dimensions: { length: 50, width: 2, height: 1, unit: 'cm' }, weight: 0.2, gdriveLink: 'https://drive.google.com/drive/folders/dummy-stock-vbelt', status: 'low_stock' },
      { name: 'Baut M10x30', category: 'sparepart_umum', quantity: 0, unit: 'pcs', dimensions: { length: 3, width: 1, height: 1, unit: 'cm' }, weight: 0.05, gdriveLink: 'https://drive.google.com/drive/folders/dummy-stock-baut', status: 'out_of_stock' },
      { name: 'Motor Listrik 5.5kW', category: 'komponen_elektrikal', quantity: 1, unit: 'unit', dimensions: { length: 35, width: 25, height: 30, unit: 'cm' }, weight: 45, gdriveLink: 'https://drive.google.com/drive/folders/dummy-stock-motor', status: 'ready' },
    ],
  })

  // ── Shipment (Pengiriman) ──────────────────────────────────────
  await prisma.shipment.create({
    data: {
      projectId: projectZenyer.id, projectName: projectZenyer.name,
      picSalesId: sales2.id, sku: 'ZNY-CLP-001', quantity: 1, weight: 620,
      dimensions: { length: 180, width: 120, height: 160, unit: 'cm' }, condition: 'baru',
      address: 'Jl. Kertabumi No. 88, Karawang, Jawa Barat',
      suratJalanUrl: 'https://drive.google.com/file/d/dummy-suratjalan-zenyer/view',
      picPengiriman: fabrikasi.id,
      packingNotes: 'Packing kayu + bubble wrap, pallet standar ekspedisi. Fragile — jangan ditumpuk.',
      status: 'selesai', createdBy: fabrikasi.id,
    },
  })
  await prisma.shipment.create({
    data: {
      projectId: projectPmx.id, projectName: projectPmx.name,
      picSalesId: sales1.id, sku: 'PMX-300-001', quantity: 1, weight: 850,
      dimensions: { length: 200, width: 150, height: 180, unit: 'cm' }, condition: 'baru',
      address: 'Jl. Industri Raya No. 45, Bekasi, Jawa Barat',
      picPengiriman: fabrikasi.id,
      packingNotes: 'Menunggu jadwal QC FAT selesai sebelum packing. Koordinasi dengan tim fabrikasi.',
      status: 'pending', createdBy: fabrikasi.id,
    },
  })

  // ── Installation (Instalasi) ───────────────────────────────────
  await prisma.installation.create({
    data: {
      projectId: projectZenyer.id, projectName: projectZenyer.name,
      customerName: customerKaryaUtama.name,
      picInstalasi: fabrikasi.id,
      installationDate: new Date('2026-06-02'), estimatedDuration: '2 hari',
      deadline: new Date('2026-06-03'),
      lokasi: 'Jl. Kertabumi No. 88, Karawang, Jawa Barat',
      notes: 'Instalasi berjalan lancar. Mesin sudah dicoba dan komisioning selesai. Operator sudah ditraining 4 jam.',
      status: 'selesai', createdBy: fabrikasi.id,
    },
  })
  await prisma.installation.create({
    data: {
      projectId: projectPmx.id, projectName: projectPmx.name,
      customerName: customerAgro.name,
      picInstalasi: fabrikasi.id,
      installationDate: new Date('2026-07-16'), estimatedDuration: '3 hari',
      deadline: new Date('2026-07-18'),
      lokasi: 'Jl. Industri Raya No. 45, Bekasi, Jawa Barat',
      notes: 'Dijadwalkan setelah QC FAT selesai. Tim instalasi 2 orang, bawa toolkit lengkap.',
      status: 'dijadwalkan', createdBy: fabrikasi.id,
    },
  })

  // ── Content Requests ─────────────────────────────────────────
  await prisma.contentRequest.create({
    data: {
      requestedBy: sales1.id, assignedTo: media.id,
      productName: 'Mesin Sortir PMX-300', contentType: 'video',
      description: 'Video demo mesin PMX-300, angle 3 sisi dan close-up mekanisme sortir. Durasi 2–3 menit.',
      priority: 'high', attachments: [], status: 'diproses',
      deadline: new Date('2026-06-30'),
    },
  })
  await prisma.contentRequest.create({
    data: {
      requestedBy: sales2.id, assignedTo: media.id,
      productName: 'VNT Destoner Basic', contentType: 'reels',
      description: 'Konten Instagram Reels, durasi 30–45 detik. Tampilkan proses destoning gabah secara singkat dan menarik.',
      priority: 'medium', attachments: [], status: 'baru',
      deadline: new Date('2026-07-05'),
    },
  })
  await prisma.contentRequest.create({
    data: {
      requestedBy: sales2.id, assignedTo: media.id,
      productName: 'Zenyer Cleaner Pro', contentType: 'foto',
      description: 'Foto produk untuk katalog cetak dan website. Butuh 10 foto: 4 angle, 3 detail part, 3 in-action.',
      priority: 'urgent', attachments: [],
      status: 'revisi', revisionNotes: 'Foto kurang terang dan background berantakan. Tolong reshoot di ruang studio dengan pencahayaan ring light.',
      deadline: new Date('2026-06-28'),
    },
  })
  await prisma.contentRequest.create({
    data: {
      requestedBy: sales1.id, assignedTo: media.id,
      productName: 'Pinecone Sifter X2', contentType: 'foto',
      description: 'Foto produk untuk presentasi ke calon customer. Minimal 5 foto berbeda angle.',
      priority: 'low', attachments: [], status: 'selesai',
      storageLink: 'https://drive.google.com/drive/folders/dummy-foto-pinecone',
      deadline: new Date('2026-06-20'),
    },
  })

  // ── Media Assets ───────────────────────────────────────────────
  await prisma.mediaAsset.createMany({
    data: [
      { category: 'logo_brand', name: 'Logo Sudijaya Group (PNG transparan)', fileUrl: 'https://example.com/assets/logo-sudijaya-group.png', description: 'Logo utama, background transparan. Gunakan di atas background putih/gelap.', uploadedBy: media.id },
      { category: 'foto_produk', name: 'Foto Mesin Sortir PMX-300', fileUrl: 'https://example.com/assets/foto-pmx-300.jpg', description: 'Foto studio 4 angle. Resolusi 4K, format JPG.', uploadedBy: media.id },
      { category: 'video_produk', name: 'Video Demo VNT Destoner Basic', fileUrl: 'https://example.com/assets/video-vnt-destoner.mp4', description: 'Video mesin berjalan, durasi 2 menit, resolusi 1080p.', uploadedBy: media.id },
      { category: 'template_desain', name: 'Template Feed Instagram', fileUrl: 'https://example.com/assets/template-feed-ig.psd', description: 'Template 1:1 untuk feed IG, brand color Sudijaya. Format PSD editable.', uploadedBy: media.id },
      { category: 'font_warna_brand', name: 'Brand Guideline Sudijaya Group', fileUrl: 'https://example.com/assets/brand-guideline.pdf', description: 'Font primer: Montserrat. Palet warna: #1A3C5E (navy), #F5A623 (gold). PDF 24 halaman.', uploadedBy: media.id },
      { category: 'voice_over', name: 'VO Promosi Produk Q3 2026', fileUrl: 'https://example.com/assets/vo-promosi-q3.mp3', description: 'Narasi Bahasa Indonesia, durasi 45 detik. Talent: Dewi L. Format MP3 320kbps.', uploadedBy: media.id },
      { category: 'musik_sfx', name: 'Background Music Corporate', fileUrl: 'https://example.com/assets/bgm-corporate.mp3', description: 'Royalty-free, cocok untuk company profile dan video produk. BPM 95, key C major.', uploadedBy: media.id },
      { category: 'broll', name: 'B-roll Workshop Fabrikasi', fileUrl: 'https://example.com/assets/broll-workshop.mp4', description: 'Suasana proses fabrikasi di workshop: welding, cutting, assembly. Durasi 5 menit, 4K.', uploadedBy: media.id },
    ],
  })

  // ── Content Data ─────────────────────────────────────────────
  await prisma.contentData.create({
    data: {
      title: 'Promo Mesin Sortir PMX-300', category: 'promo', platform: ['instagram', 'facebook'], format: '1:1',
      caption: 'Tingkatkan efisiensi sortir hasil panen Anda dengan PMX-300! Kapasitas hingga 5 ton/jam dengan akurasi sortir 98%. 📞 Hubungi kami untuk penawaran terbaik.',
      voiceOverScript: 'Sudijaya Group menghadirkan Mesin Sortir PMX-300, solusi terdepan untuk meningkatkan kualitas hasil panen Anda.',
      hashtag: '#sudijayagroup #mesinsortir #pmx300 #agribusiness #mesinpertanian',
      driveLink: 'https://drive.google.com/drive/folders/dummy-promo-pmx300',
      productionStatus: 'final', uploadDate: new Date('2026-06-12'), pic: media.id, createdBy: media.id, files: [],
    },
  })
  await prisma.contentData.create({
    data: {
      title: 'Tutorial Pemakaian VNT Destoner Basic', category: 'edukasi', platform: ['youtube'], format: '16:9',
      caption: 'Panduan lengkap mengoperasikan VNT Destoner Basic untuk gabah bersih tanpa batu dan kerikil. Tonton sampai selesai!',
      voiceOverScript: 'Halo, di video kali ini kami akan menunjukkan cara mengoperasikan VNT Destoner Basic langkah demi langkah. Pastikan mesin sudah terhubung ke listrik 3 fasa sebelum memulai...',
      hashtag: '#tutorial #vntdestoner #mesinpertanian #sudijayagroup #gabah',
      driveLink: 'https://drive.google.com/drive/folders/dummy-tutorial-vnt',
      productionStatus: 'editing', pic: media.id, createdBy: media.id, files: [],
    },
  })
  await prisma.contentData.create({
    data: {
      title: 'Testimoni PT Karya Utama', category: 'testimoni', platform: ['instagram', 'tiktok'], format: '9:16',
      caption: 'Dengar langsung pengalaman PT Karya Utama setelah menggunakan Zenyer Cleaner Pro selama 3 bulan. Produktivitas meningkat 40%! 🚀',
      voiceOverScript: 'Sejak menggunakan Zenyer Cleaner Pro dari Sudijaya Group, kami berhasil meningkatkan kualitas sortir dan mengurangi waste hingga 35%.',
      hashtag: '#testimoni #zenyercleanerpro #customerreview #sudijayagroup',
      driveLink: 'https://drive.google.com/drive/folders/dummy-testimoni-karya',
      productionStatus: 'review', pic: media.id, createdBy: media.id, files: [],
    },
  })
  await prisma.contentData.create({
    data: {
      title: 'Company Profile Sudijaya Group 2026', category: 'company_profile', platform: ['website', 'youtube'], format: '16:9',
      caption: 'Sudijaya Group — Spesialis mesin fabrikasi pertanian berkualitas tinggi sejak berdiri. Lebih dari 500 unit terpasang di seluruh Indonesia.',
      voiceOverScript: 'Sudijaya Group adalah perusahaan manufaktur mesin pertanian yang berkomitmen menghadirkan solusi inovatif untuk meningkatkan produktivitas petani Indonesia...',
      hashtag: '#sudijayagroup #companyprofile #manufaktur #agritech #indonesia',
      driveLink: 'https://drive.google.com/drive/folders/dummy-compro-2026',
      productionStatus: 'draft', pic: media.id, createdBy: media.id, files: [],
    },
  })

  // ── Meetings ─────────────────────────────────────────────────
  await prisma.meeting.create({
    data: {
      title: 'Meeting Fabrikasi PMX-300', createdBy: admin.id,
      participants: [sales1.id, fabrikasi.id, admin.id],
      scheduledAt: new Date('2026-06-22T09:00:00'),
      location: 'Ruang Rapat Lantai 2',
      agenda: 'Briefing teknis: review drawing PMX-300, konfirmasi BOM, jadwal mulai fabrikasi, dan pembagian tugas tim.',
      notes: 'Disepakati fabrikasi mulai 23 Juni. Fajar bertanggung jawab cutting & assembly. Material harus datang paling lambat 22 Juni pagi.',
      status: 'done',
    },
  })
  await prisma.meeting.create({
    data: {
      title: 'Review Progress VNT Destoner', createdBy: admin.id,
      participants: [sales2.id, fabrikasi.id],
      scheduledAt: new Date('2026-06-13T13:00:00'),
      location: 'Workshop Fabrikasi',
      agenda: 'Cek progress drawing VNT Destoner, identifikasi kendala teknis, update timeline ke customer.',
      notes: 'Drawing 80% selesai. Kendala: ukuran hopper perlu konfirmasi ulang ke customer. Rina diminta WA customer sebelum akhir pekan.',
      status: 'done',
    },
  })
  await prisma.meeting.create({
    data: {
      title: 'Kick-off Project VNT Destoner Basic', createdBy: sales2.id,
      participants: [sales2.id, admin.id, fabrikasi.id],
      scheduledAt: new Date('2026-07-01T10:00:00'),
      location: 'Online (Google Meet)',
      agenda: 'Persiapan mulai fabrikasi VNT setelah DP masuk: review BOM, konfirmasi jadwal, distribusi tugas.',
      notes: '',
      status: 'scheduled',
    },
  })

  // ── After-Sales ──────────────────────────────────────────────
  await prisma.afterSales.create({
    data: {
      reportDate: new Date('2026-06-10'), projectId: projectZenyer.id,
      customerId: customerKaryaUtama.id, customerName: customerKaryaUtama.name,
      machineName: 'Zenyer Cleaner Pro', complaintType: 'maintenance',
      problemDescription: 'Permintaan maintenance rutin setelah 6 bulan penggunaan. Cek bearing, v-belt, dan kalibrasi sensor sortir.',
      priority: 'low', ticketStatus: 'selesai',
      picAftersales: sales2.id, technicianAssigned: fabrikasi.id,
      purchaseDate: new Date('2026-05-15'), installationDate: new Date('2026-06-01'),
      warrantyPeriod: '1 tahun', warrantyStatus: 'aktif',
      handlingDeadline: new Date('2026-06-15'),
      createdBy: admin.id,
    },
  })
  await prisma.afterSales.create({
    data: {
      reportDate: new Date('2026-06-18'), projectId: projectPmx.id,
      customerId: customerAgro.id, customerName: customerAgro.name,
      machineName: 'Mesin Sortir PMX-300 (unit demo)',
      complaintType: 'kerusakan',
      problemDescription: 'Unit demo di showroom tidak menyala setelah listrik padam mendadak. Diduga MCB trip atau inverter bermasalah.',
      priority: 'high', ticketStatus: 'diproses',
      picAftersales: sales1.id, technicianAssigned: fabrikasi.id,
      purchaseDate: new Date('2025-12-01'), installationDate: new Date('2025-12-10'),
      warrantyPeriod: '1 tahun', warrantyStatus: 'aktif',
      handlingDeadline: new Date('2026-06-22'),
      createdBy: admin.id,
    },
  })

  // ── Notifications ─────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      { recipientId: fabrikasi.id, type: 'dp_received', title: 'DP Masuk — PMX-300', message: 'Down Payment 60% (Rp 252jt) telah masuk untuk project Mesin Sortir PMX-300. Segera mulai proses produksi.', relatedId: projectPmx.id, relatedCollection: 'projects', isRead: false },
      { recipientId: sales1.id, type: 'quotation', title: 'Quotation Siap', message: 'Quotation untuk Mesin Sortir PMX-300 (Rp 420jt) telah selesai dibuat oleh tim admin.', relatedId: quotationPmx.id, relatedCollection: 'quotations', isRead: true },
      { recipientId: sales2.id, type: 'quotation', title: 'Quotation Siap', message: 'Quotation untuk VNT Destoner Basic (Rp 280jt) sedang diproses. Perkiraan selesai 2 hari kerja.', relatedId: quotationVnt.id, relatedCollection: 'quotations', isRead: false },
      { recipientId: admin.id, type: 'reminder', title: 'Pengingat Tugas Overdue', message: 'Terdapat 1 tiket after-sales prioritas Tinggi yang belum selesai dan mendekati deadline penanganan.', relatedId: projectPmx.id, relatedCollection: 'after_sales', isRead: false },
      { recipientId: fabrikasi.id, type: 'reminder', title: 'H-7 Deadline Produksi', message: 'Project "Mesin Sortir PMX-300" akan mencapai deadline produksi pada 15 Juli 2026. Pastikan semua tahapan on-track.', relatedId: ganttPmx.id, relatedCollection: 'production_gantt', isRead: false },
    ],
  })

  console.log('✅ Dummy data lengkap berhasil dibuat:\n  4 customers, 5 leads, 4 projects, 3 quotations, 3 invoices, 5 tasks,\n  3 drawing requests, 3 BOM requests, 2 gantt (16 tasks), 5 stok gudang,\n  2 shipment, 2 installation, 4 content requests, 8 media assets,\n  4 content data, 3 meetings, 2 after-sales, 5 notifikasi.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
