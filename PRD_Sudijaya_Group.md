# Product Requirements Document (PRD)
## Sistem Manajemen Operasional — Sudijaya Group
**Versi:** 1.0.0  
**Tanggal:** Juni 2026  
**Status:** Draft  
**Platform:** Web Application (ReactJS + Firebase)

---

## Daftar Isi

- [Ringkasan Eksekutif] (#1-ringkasan-eksekutif)
- [Tujuan Produk] (#2-tujuan-produk)
- [Scope Proyek] (#3-scope-proyek)
- [User Roles & Permissions] (#4-user-roles--permissions)
- [Fitur Lengkap Per Role] (#5-fitur-lengkap-per-role)
- [User Flow] (#6-user-flow)
- [UI/UX Guidelines] (#7-uiux-guidelines)
- [Database Overview (Firebase)] (#8-database-overview-firebase)
- [Technical Requirements] (#9-technical-requirements)
- [Out of Scope] (#10-out-of-scope)
- [Risiko & Mitigasi] (#11-risiko--mitigasi)
- [Timeline & Milestone] (#12-timeline--milestone)

---

## 1. Ringkasan Eksekutif

Sudijaya Group adalah perusahaan yang bergerak di bidang penjualan dan fabrikasi mesin industri. Saat ini proses operasional berjalan secara manual dan tersebar di berbagai saluran komunikasi (WhatsApp, spreadsheet, email) sehingga menyebabkan inefisiensi, miskomunikasi antar departemen, dan sulitnya pelacakan progress pekerjaan.

**Solusi:** Membangun sistem manajemen operasional berbasis web yang mengintegrasikan seluruh alur kerja dari Sales, Admin, Fabrikasi, Warehouse, hingga Media dalam satu platform terpusat. Sistem dilengkapi dengan manajemen leads, quotation, invoice, produksi (Gantt Chart), manajemen stok, pengingat tugas otomatis, dan after-sales (garansi).

---

## 2. Tujuan Produk

| No | Tujuan | Metrik Keberhasilan |
|----|--------|---------------------|
| 1 | Memusatkan seluruh komunikasi dan dokumen antar departemen | Pengurangan komunikasi WhatsApp operasional > 70% |
| 2 | Melacak progress proyek secara real-time (Gantt Chart) | 100% proyek terlacak dalam sistem |
| 3 | Mempercepat proses dari leads ke closing | Rata-rata lead time berkurang >= 20% |
| 4 | Transparansi pembayaran dan invoice | Zero dokumen hilang / tidak tercatat |
| 5 | Manajemen stok dan spare part Warehouse | Akurasi stok >= 95% |
| 6 | Automasi pengingat tugas per role | Tingkat ketepatan penyelesaian tugas meningkat >= 30% |

---

## 3. Scope Proyek

### 3.1 Dalam Scope (In Scope)

- **Autentikasi:** Login dengan email + PIN per user, manajemen user oleh Super Admin
- **Dashboard:** Statistik sales, progress bar, timeline progress (khusus Super Admin & Admin)
- **Modul Admin:** Quotation, Invoice (generate PDF + upload), Daily Task, Jadwal Meeting, Payment Tracking, notifikasi ke Fabrikasi saat DP masuk, input masa garansi after-sales
- **Modul Sales:** CRM Leads (WA/Iklan/Offline), pipeline project dengan kategori brand, request ke Fabrikasi (Gambar + BOM), request konten ke Media, timeline progress per project, input NPWP & KTP saat closing
- **Modul Fabrikasi:** Penerimaan request gambar & BOM dari Sales, estimasi deadline produksi, BOM calculator, instalasi timeline, Gantt Chart produksi (Drawing - Purchase - Cutting - Vendor - Fabrikasi - Electrical - QC - Instalasi), notifikasi catatan per tanggal kalender
- **Modul Warehouse:** Manajemen stok (mesin, spare part PMX, spare part Basic Destoner, spare part umum), dimensi barang untuk kalkulasi shipping, link Google Drive per item
- **Modul Media:** Penerimaan request konten dari Sales, konten bulanan, tools konten, take konten ke Fabrikasi, link penyimpanan konten
- **Inbox:** Notifikasi belum dibaca / semua / berdasarkan tugas masuk; dapat diklik dan diedit oleh role yang bersangkutan
- **Reminder:** Trigger saat login, pukul 09.00, 13.00, 17.00; H-7 sebelum mesin selesai untuk Admin & Sales; reminder dapat diklik dan diedit
- **Tema:** Mode Light dan Dark
- **After-Sales:** Pencatatan masa garansi per customer setelah pembayaran

### 3.2 Luar Scope (Out of Scope)

- Integrasi langsung dengan platform e-commerce atau marketplace
- Modul akuntansi / pembukuan otomatis (ERP-grade)
- Aplikasi mobile native (Android/iOS)
- Integrasi API WhatsApp otomatis
- Customer portal (akses langsung untuk customer eksternal)
- Payment gateway otomatis

---

## 4. User Roles & Permissions

| Role | Deskripsi | Akses Dashboard Utama |
|------|-----------|-----------------------|
| **Super Admin** | Mengelola seluruh sistem, user, dan melihat semua data | Full |
| **Admin** | Operasional keuangan, dokumen, koordinasi antar departemen | Full |
| **Sales** | Manajemen leads, pipeline project, request ke departemen lain | Timeline project saja |
| **Fabrikasi** | Penerimaan request, produksi, Gantt Chart | Progress fabrikasi saja |
| **Warehouse** | Manajemen stok dan persiapan pengiriman | Stok saja |
| **Media** | Pembuatan konten dan manajemen aset visual | Konten saja |

### 4.1 Matrix Akses Fitur

| Fitur | Super Admin | Admin | Sales | Fabrikasi | Warehouse | Media |
|-------|:-----------:|:-----:|:-----:|:---------:|:---------:|:-----:|
| Kelola User & PIN | Ya | Tidak | Tidak | Tidak | Tidak | Tidak |
| Dashboard Statistik | Ya | Ya | Tidak | Tidak | Tidak | Tidak |
| Quotation | Ya | Ya | Request | Tidak | Tidak | Tidak |
| Invoice | Ya | Ya | Download | Tidak | Tidak | Tidak |
| CRM Leads | Ya | View | Ya | Tidak | Tidak | Tidak |
| BOM | Ya | Ya | Tidak | Ya | Tidak | Tidak |
| Request Gambar | Ya | View | Ya | Terima | Tidak | Tidak |
| Gantt Chart Produksi | Ya | Ya | View | Ya | Tidak | Tidak |
| Stok Warehouse | Ya | Ya | Tidak | Tidak | Ya | Tidak |
| Konten Media | Ya | View | Request | Tidak | Tidak | Ya |
| After-Sales Garansi | Ya | Ya | View | Tidak | Tidak | Tidak |
| Jadwal Meeting | Ya | Ya (buat) | View | View | View | View |
| Daily Task | Ya | Buat | Terima | Tidak | Tidak | Tidak |
| Tutup Akun Customer | Ya | Ya | Tidak | Tidak | Tidak | Tidak |

---

## 5. Fitur Lengkap Per Role

### 5.1 Super Admin

- Kelola user: tambah, edit, hapus akun dan PIN
- Akses semua modul dan data
- Menutup/membatalkan akun customer
- Melihat laporan statistik dan timeline seluruh role

---

### 5.2 Admin

**A. Quotation Management**
- Buat quotation berdasarkan request Sales
- Status quotation: `Diproses` | `Pending` | `Selesai`
- Deadline quotation dengan notifikasi otomatis
- Generate PDF penawaran untuk di-download Sales

**B. Invoice Management**
- Buat invoice asli berdasarkan request Sales
- Upload file invoice (PDF)
- Invoice dapat di-download oleh Sales

**C. Payment Tracking**
- Catat data customer yang sudah bayar (tanggal, persentase DP)
- Default DP: 60% atau Full Payment
- Pembayaran dapat dikustomisasi lebih dari 2x beserta tanggal tiap termin
- Ketika DP masuk -> sistem otomatis notifikasi ke Fabrikasi

**D. Daily Task & Meeting**
- Buat dan distribusikan daily task ke Sales
- Buat jadwal meeting (hanya Admin yang bisa membuat)
- Jadwal estimasi PO dan tanggal pelunasan

**E. After-Sales**
- Input masa garansi per customer setelah pembayaran dilakukan
- Notifikasi garansi mendekati habis masa berlaku

**F. Koordinasi**
- Terima BOM dari Fabrikasi -> Warehouse (Sales tidak dapat melihat BOM)
- Jadwal pengiriman ke Warehouse
- Reminder H-7 sebelum mesin selesai

---

### 5.3 Sales

**A. CRM Leads**
- Daftar leads dari sumber: WhatsApp, Iklan, Offline
- Data per lead: Nama Customer, Produk yang diminati, Last Follow-Up, Status Leads
- Nama customer/leads tersimpan otomatis ke database saat pertama kali diinput

**B. Pipeline Project**
- Kategori brand mesin: `Zenchang`, `VNT`, `Nordic`, `Zenyer`, `Lijun`, `Pinecone`
- Status customer yang sudah beli
- Input NPWP & KTP customer saat closing deal

**C. Request ke Fabrikasi**
- Request Gambar: upload format JPG / PNG, sertakan deadline, nama project, priority, custom PIC (lebih dari 1 nama sesuai role yang terdaftar)
- Request BOM: upload format PDF; alur -> Sales -> Admin -> Fabrikasi -> Admin

**D. Request ke Media**
- Request pembuatan konten mesin dengan keterangan produk

**E. Timeline Progress**
- Lihat timeline progress pekerjaan per role yang terkait dengan project Sales
- Gantt Chart produksi (view only)

**F. Leads Timeline (per project)**

```
Leads -> DP + Layout + Mesin + Tanggal
     -> Meeting dengan Fabrikasi
     -> Report ke Customer hasil meeting
     -> Admin Order
     -> Fabrikasi Build Produk
     -> Pelunasan
     -> Pengiriman Produk (Warehouse)
     -> Instalasi
```

---

### 5.4 Fabrikasi

**A. Penerimaan Request**
- Terima request gambar dari Sales (attachment JPG/PNG, deadline, priority, multi-PIC)
- Terima request BOM dari Sales (via Admin)

**B. Produksi & Estimasi**
- Input deadline estimasi produksi mesin
- Hitung BOM berdasarkan permintaan Sales
- Set instalasi project timeline: PIC, tools yang dibutuhkan, tanggal instalasi

**C. Gantt Chart Produksi**

Tampilan Gantt Chart per project:

| Task | Deadline | Kalender Harian |
|------|----------|-----------------|
| Drawing | dd/mm/yyyy | Tersedia |
| Purchase Material | dd/mm/yyyy | Tersedia |
| Cutting Laser | dd/mm/yyyy | Tersedia |
| Vendor | dd/mm/yyyy | Tersedia |
| Fabrikasi | dd/mm/yyyy | Tersedia |
| Electrical | dd/mm/yyyy | Tersedia |
| QC & FAT | dd/mm/yyyy | Tersedia |
| Instalasi | dd/mm/yyyy | Tersedia |

- Tombol Catatan di setiap sel tanggal kalender
- Dashboard Gantt menampilkan: Nama Project, PIC Sales, Deadline keseluruhan

**D. Alur Fabrikasi (setelah DP masuk)**

```
Admin info DP masuk
  ├── Fabrikasi -> Drawing
  ├── Fabrikasi -> Production (Fabrikasi & Electrical)
  └── Fabrikasi -> FAT & QC
```

**E. Koordinasi Media**
- Terima request take konten dari Media

---

### 5.5 Warehouse

**A. Manajemen Stok**

Kategori stok:
- Stok Mesin (unit siap kirim)
- Stok Spare Part PMX
- Stok Spare Part Basic Destoner
- Stok Spare Part Mesin Umum

Atribut per item:
- Nama item, kategori, jumlah stok
- Dimensi (P x L x T) untuk kalkulasi shipping
- Link Google Drive (dokumentasi / foto)
- Input status stok mesin

**B. Pemenuhan Order**
- Terima jadwal pengiriman dari Admin
- Siapkan barang berdasarkan permintaan Sales (via Admin)
- Update status stok setelah pengiriman

---

### 5.6 Media

**A. Penerimaan Request Konten**
- Terima request konten mesin dari Sales
- Kolom: link penyimpanan konten (Google Drive / cloud storage)

**B. Perencanaan Konten**
- Konten bulanan (content calendar)
- Tools pembuatan konten

**C. Take Konten**
- Koordinasi take konten ke lokasi Fabrikasi
- Request take konten -> Fabrikasi

---

### 5.7 Fitur Global (Semua Role)

**A. Inbox**
- Tab: `Belum Dibaca` | `Semua` | `Tugas Masuk`
- Notifikasi dapat diklik dan diedit oleh role yang bersangkutan

**B. Reminder Otomatis**
- Trigger: saat login, pukul 09.00, 13.00, 17.00 (WIB)
- Konten reminder: tugas per role + tugas yang diberikan role lain
- Reminder dapat diklik (buka detail) dan diedit
- Notifikasi khusus H-7 sebelum mesin selesai (Admin + Sales)

**C. Timeline Progress**
- Setiap role melihat progress pekerjaan yang relevan dengan role-nya
- Tracking: tahapan mana yang sudah selesai, sedang berjalan, belum dimulai

**D. PIC Auto-Complete**
- Kolom PIC di setiap form terisi otomatis berdasarkan nama user yang terdaftar di sistem, difilter sesuai role yang relevan

---

## 6. User Flow

### 6.1 Flow Onboarding & Autentikasi

```
Buka Aplikasi
    |
    v
Halaman Login
    |
    +-- Input Email + PIN
    |
    v
Verifikasi Firebase Auth
    |
    +-- Berhasil -> Redirect ke Dashboard sesuai Role
    |               + Trigger Reminder Login
    |
    +-- Gagal -> Tampilkan pesan error, coba lagi
```

---

### 6.2 Flow Sales: Leads ke Closing

```
Sales tambah Leads baru
    | (Nama, Produk, Sumber, Status)
    v
Follow-Up & Update Status Leads
    |
    v
Closing Decision
    |
    +-- Tertarik -> Request Quotation ke Admin
    |                   |
    |                   v
    |              Admin buat Quotation (PDF)
    |                   | Status: Diproses -> Selesai
    |                   v
    |              Sales download PDF Penawaran
    |                   |
    |                   v
    |              Customer setuju -> DP masuk
    |                   |
    |                   v
    |              Admin catat DP, input garansi
    |              Admin notifikasi -> Fabrikasi
    |                   |
    |                   v
    |              Sales input NPWP & KTP Customer
    |                   |
    |                   v
    |              Request Gambar & BOM ke Fabrikasi
    |                   |
    |                   v
    |              Fabrikasi proses (Gantt Chart)
    |                   |
    |                   v
    |              Pelunasan -> Pengiriman -> Instalasi
    |
    +-- Batal -> Admin tutup akun customer
```

---

### 6.3 Flow Request Gambar (Sales ke Fabrikasi)

```
Sales buka form Request Gambar
    | Upload JPG/PNG + isi Nama Project,
    | Deadline, Priority, PIC (multi-select)
    v
Sistem kirim notifikasi ke Fabrikasi
    |
    v
Fabrikasi terima di Inbox
    | Klik -> Buka detail request
    | Edit status & upload hasil gambar
    v
Sales terima notifikasi hasil gambar
```

---

### 6.4 Flow Request BOM (Sales ke Admin ke Fabrikasi ke Admin)

```
Sales buat Request BOM
    | Upload PDF + keterangan
    v
Notifikasi masuk ke Admin
    |
    v
Admin forward ke Fabrikasi
    |
    v
Fabrikasi hitung BOM, upload hasil
    |
    v
Hasil BOM kembali ke Admin
    | (Sales tidak dapat melihat BOM)
    v
Admin gunakan BOM untuk quotation / order
```

---

### 6.5 Flow Gantt Chart Fabrikasi

```
Admin input info DP masuk
    |
    v
Fabrikasi terima notifikasi
    |
    v
Fabrikasi buka/buat project Gantt Chart
    | Isi: Drawing, Purchase Material,
    | Cutting Laser, Vendor, Fabrikasi,
    | Electrical, QC & FAT, Instalasi
    | (tiap baris: Deadline + tanggal kalender)
    v
Update progress harian per task
    | (klik tanggal -> tambah catatan)
    v
Reminder H-7 -> notifikasi Admin & Sales
    |
    v
Mesin selesai -> update status -> Warehouse siapkan pengiriman
```

---

### 6.6 Flow Reminder Otomatis

```
Sistem cek waktu: Login / 09:00 / 13:00 / 17:00
    |
    v
Query tugas aktif per user (berdasarkan role & assignment)
    |
    v
Tampilkan notifikasi/popup Reminder
    |
    +-- User klik reminder -> buka detail tugas
    |
    +-- User edit reminder -> update data tugas
```

---

## 7. UI/UX Guidelines

### 7.1 Tema & Visual

| Aspek | Light Mode | Dark Mode |
|-------|-----------|-----------|
| Background utama | #FFFFFF / #F5F7FA | #1A1D23 / #141720 |
| Background card | #FFFFFF | #22262F |
| Warna primer | #2563EB (Biru) | #3B82F6 |
| Warna aksen | #10B981 (Hijau) | #10B981 |
| Teks utama | #111827 | #F9FAFB |
| Teks sekunder | #6B7280 | #9CA3AF |
| Border / divider | #E5E7EB | #374151 |
| Toggle tema | Switch icon di navbar | Switch icon di navbar |

### 7.2 Layout Utama

```
+--------------------------------------------------+
|  HEADER: Logo | Nama Role | Notif Bell | Theme    |
|           Toggle | Avatar + Nama User             |
+----------+---------------------------------------+
|          |                                        |
| SIDEBAR  |           MAIN CONTENT                 |
|          |                                        |
| Dashboard|  - Header Breadcrumb                   |
| Modul    |  - Content Cards / Table               |
| Inbox    |  - Action Buttons                      |
| Reminder |  - Modals / Drawers                    |
| Settings |  - Gantt Chart (if needed)             |
|          |                                        |
+----------+---------------------------------------+
|  FOOTER: Version | © Sudijaya Group              |
+--------------------------------------------------+
```

### 7.3 Komponen UI Kunci

**Dashboard (Admin/Super Admin)**
- Card statistik: Total Leads, Deals Closed, Revenue Target, On-Progress Projects
- Progress Bar per sales
- Timeline progress (horizontal scroll)
- Grafik tren penjualan bulanan

**Gantt Chart (Fabrikasi)**
- Tabel horizontal dengan baris task dan kolom tanggal
- Warna bar berdasarkan status: Belum Mulai (abu-abu), On Progress (biru), Selesai (hijau), Terlambat (merah)
- Tooltip saat hover menampilkan detail & catatan
- Tombol catatan di setiap sel tanggal

**Inbox**
- Badge counter notifikasi di ikon bell navbar
- Tab filter: Belum Dibaca / Semua / Tugas Masuk
- Klik untuk buka detail
- Inline edit di dalam modal

**Reminder Popup**
- Muncul sebagai modal non-blocking (bisa di-dismiss)
- List tugas dengan deadline dan role pembuat
- Klik task -> navigasi ke halaman task terkait
- Edit langsung dari popup

**Form Upload File**
- Drag & drop area
- Preview thumbnail (untuk JPG/PNG)
- Indikator nama file (untuk PDF)
- Validasi tipe file dan ukuran (max 10MB)

### 7.4 Responsivitas

- **Desktop (>=1280px):** Sidebar expanded, tabel full column
- **Tablet (768-1279px):** Sidebar collapsible, tabel horizontal scroll
- **Mobile (<768px):** Bottom navigation, kartu vertikal (untuk monitoring ringan)

---

## 8. Database Overview (Firebase)

### 8.1 Firebase Services yang Digunakan

| Service | Fungsi |
|---------|--------|
| **Firebase Authentication** | Login email + PIN (custom claims untuk role) |
| **Cloud Firestore** | Database utama NoSQL (real-time) |
| **Firebase Storage** | Upload file (gambar, PDF invoice, BOM, konten) |
| **Firebase Cloud Messaging (FCM)** | Push notifikasi & reminder |
| **Firebase Hosting** | Deploy aplikasi ReactJS |
| **Cloud Functions** | Scheduled triggers (09:00, 13:00, 17:00 reminder) |

---

### 8.2 Struktur Koleksi Firestore

#### Koleksi: `users`
```
users/{userId}
  - name: string
  - email: string
  - role: "super_admin" | "admin" | "sales" | "fabrikasi" | "warehouse" | "media"
  - pin: string (hashed)
  - isActive: boolean
  - createdAt: timestamp
  - updatedAt: timestamp
```

#### Koleksi: `customers`
```
customers/{customerId}
  - name: string
  - phone: string
  - email: string
  - source: "whatsapp" | "iklan" | "offline"
  - status: "lead" | "prospect" | "active" | "closed" | "cancelled"
  - npwp: string (diisi saat closing)
  - ktpUrl: string (Firebase Storage URL)
  - lastFollowUp: timestamp
  - createdBy: userId (ref)
  - isActive: boolean
  - updatedAt: timestamp
```

#### Koleksi: `leads`
```
leads/{leadId}
  - customerId: ref -> customers
  - productCategory: "Zenchang"|"VNT"|"Nordic"|"Zenyer"|"Lijun"|"Pinecone"
  - productName: string
  - source: "whatsapp" | "iklan" | "offline"
  - status: "new" | "follow_up" | "qualified" | "closed_won" | "closed_lost"
  - assignedSales: userId (ref)
  - lastFollowUp: timestamp
  - notes: string
```

#### Koleksi: `projects`
```
projects/{projectId}
  - name: string
  - customerId: ref -> customers
  - salesPic: userId (ref)
  - category: string (brand mesin)
  - status: "active" | "completed" | "cancelled"
  - dpPercentage: number
  - dpDate: timestamp
  - fullPaymentDate: timestamp
  - warrantyStartDate: timestamp
  - warrantyEndDate: timestamp
  - estimatedDelivery: timestamp
  - payments: array[{ amount, percentage, date, status }]
  - timeline: subcollection
```

#### Koleksi: `quotations`
```
quotations/{quotationId}
  - projectId: ref -> projects
  - customerId: ref -> customers
  - requestedBy: userId (Sales)
  - createdBy: userId (Admin)
  - status: "diproses" | "pending" | "selesai"
  - deadline: timestamp
  - pdfUrl: string (Storage URL)
  - items: array[{ description, qty, unit, price }]
  - totalAmount: number
  - createdAt: timestamp
```

#### Koleksi: `invoices`
```
invoices/{invoiceId}
  - quotationId: ref -> quotations
  - projectId: ref -> projects
  - customerId: ref -> customers
  - invoiceNumber: string
  - createdBy: userId (Admin)
  - pdfUrl: string (Storage URL)
  - uploadedFileUrl: string (invoice upload)
  - amount: number
  - createdAt: timestamp
```

#### Koleksi: `tasks`
```
tasks/{taskId}
  - title: string
  - description: string
  - assignedTo: userId (ref)
  - assignedBy: userId (ref)
  - role: string
  - status: "pending" | "in_progress" | "done"
  - dueDate: timestamp
  - reminderSent: boolean
  - createdAt: timestamp
```

#### Koleksi: `requests_drawing`
```
requests_drawing/{requestId}
  - projectId: ref -> projects
  - requestedBy: userId (Sales)
  - assignedTo: array[userId] (multi-PIC Fabrikasi)
  - projectName: string
  - deadline: timestamp
  - priority: "low" | "medium" | "high"
  - status: "pending" | "in_progress" | "done"
  - attachments: array[{ url, type: "jpg"|"png", name }]
  - resultAttachments: array[{ url, name }]
  - notes: string
```

#### Koleksi: `requests_bom`
```
requests_bom/{bomId}
  - projectId: ref -> projects
  - requestedBy: userId (Sales)
  - status: "pending_admin" | "pending_fabrikasi" | "done"
  - attachments: array[{ url, type: "pdf", name }]
  - resultUrl: string
  - visibleTo: array["admin"] (Sales excluded)
  - notes: string
```

#### Koleksi: `production_gantt`
```
production_gantt/{ganttId}
  - projectId: ref -> projects
  - projectName: string
  - salesPic: userId (ref)
  - overallDeadline: timestamp
  - status: "active" | "completed"
  - tasks: subcollection

production_gantt/{ganttId}/tasks/{taskId}
  - taskName: "drawing"|"purchase_material"|"cutting_laser"|"vendor"|
              "fabrikasi"|"electrical"|"qc_fat"|"instalasi"
  - deadline: timestamp
  - startDate: timestamp
  - completedDate: timestamp
  - status: "pending" | "in_progress" | "done" | "delayed"
  - pic: array[userId]
  - notes: array[{ date: timestamp, content: string, createdBy: userId }]
```

#### Koleksi: `warehouse_stock`
```
warehouse_stock/{itemId}
  - name: string
  - category: "mesin"|"sparepart_pmx"|"sparepart_basic_destoner"|"sparepart_umum"
  - quantity: number
  - unit: string
  - dimensions: { length, width, height, unit: "cm" }
  - weight: number
  - gdriveLink: string
  - status: "ready" | "low_stock" | "out_of_stock"
  - updatedAt: timestamp
```

#### Koleksi: `content_requests`
```
content_requests/{contentId}
  - requestedBy: userId (Sales)
  - assignedTo: userId (Media)
  - productName: string
  - description: string
  - status: "pending" | "in_progress" | "done"
  - storageLink: string
  - deadline: timestamp
  - createdAt: timestamp
```

#### Koleksi: `meetings`
```
meetings/{meetingId}
  - title: string
  - createdBy: userId (Admin only)
  - participants: array[userId]
  - scheduledAt: timestamp
  - location: string
  - agenda: string
  - notes: string
  - status: "scheduled" | "done" | "cancelled"
```

#### Koleksi: `notifications`
```
notifications/{notifId}
  - recipientId: userId (ref)
  - type: "task"|"reminder"|"invoice"|"quotation"|"dp_received"|"warranty"|...
  - title: string
  - message: string
  - relatedId: string (ID entitas terkait)
  - relatedCollection: string
  - isRead: boolean
  - createdAt: timestamp
```

#### Koleksi: `after_sales`
```
after_sales/{afterSalesId}
  - projectId: ref -> projects
  - customerId: ref -> customers
  - warrantyStartDate: timestamp
  - warrantyEndDate: timestamp
  - warrantyDurationMonths: number
  - notes: string
  - createdBy: userId (Admin)
  - updatedAt: timestamp
```

---

### 8.3 Firebase Storage Struktur Folder

```
/uploads
  /invoices/{invoiceId}/
  /quotations/{quotationId}/
  /drawings/{requestId}/
  /bom/{bomId}/
  /content/{contentId}/
  /customers/{customerId}/ktp/
  /gantt/{ganttId}/attachments/
```

---

### 8.4 Security Rules (Prinsip Dasar Firestore)

```javascript
// Hanya user yang sudah login dapat akses
match /{document=**} {
  allow read, write: if request.auth != null;
}

// BOM hanya bisa dibaca Admin & Super Admin
match /requests_bom/{bomId} {
  allow read: if request.auth.token.role in ["admin", "super_admin"];
}

// Quotation bisa dibaca Sales, Admin, Super Admin
match /quotations/{qId} {
  allow read: if request.auth.token.role in ["admin", "super_admin", "sales"];
}
```

---

## 9. Technical Requirements

### 9.1 Tech Stack

| Layer | Teknologi | Versi |
|-------|-----------|-------|
| Frontend | ReactJS | 18.x |
| State Management | Zustand / Redux Toolkit | Latest |
| UI Component | Tailwind CSS + ShadCN/UI | Latest |
| Routing | React Router v6 | 6.x |
| Form Handling | React Hook Form + Zod | Latest |
| Chart / Gantt | recharts + custom Gantt | Latest |
| File Upload | Firebase Storage SDK | 10.x |
| PDF Generate | jsPDF / react-pdf | Latest |
| Backend | Firebase (BaaS) | - |
| Database | Cloud Firestore | - |
| Auth | Firebase Authentication | - |
| Push Notif | Firebase Cloud Messaging | - |
| Scheduled Jobs | Firebase Cloud Functions | - |
| Hosting | Firebase Hosting | - |

---

### 9.2 Arsitektur Sistem

```
+------------------------------------------------------+
|                    CLIENT (Browser)                   |
|                                                        |
|   ReactJS App                                          |
|   +-- Auth Layer (Firebase Auth + Custom PIN)          |
|   +-- Role-Based Route Guard                           |
|   +-- Modul Sales / Admin / Fabrikasi / dst.           |
|   +-- Firestore Real-time Listener                     |
|   +-- FCM Service Worker (Push Notif)                  |
+------------------+-----------------------------------+
                   | HTTPS / WebSocket
+------------------v-----------------------------------+
|                  FIREBASE PLATFORM                     |
|                                                        |
|  +-------------+  +--------------+  +--------------+  |
|  |  Firebase   |  |    Cloud     |  |   Firebase   |  |
|  |    Auth     |  |  Firestore   |  |   Storage    |  |
|  +-------------+  +--------------+  +--------------+  |
|                                                        |
|  +-------------+  +--------------+                    |
|  |    Cloud    |  |     FCM      |                    |
|  |  Functions  |  | (Notifikasi) |                    |
|  +-------------+  +--------------+                    |
+------------------------------------------------------+
```

---

### 9.3 Cloud Functions (Scheduled Jobs)

| Function | Trigger | Deskripsi |
|----------|---------|-----------|
| `sendDailyReminder` | Cron: `0 9,13,17 * * *` | Kirim reminder ke semua user aktif sesuai role |
| `sendWarrantyAlert` | Cron: `0 8 * * *` | Cek garansi mendekati habis (H-30, H-7, H-1) |
| `sendProductionAlert` | Event: Firestore onUpdate | Kirim H-7 notif ke Admin & Sales ketika deadline produksi - 7 hari |
| `notifyDPReceived` | Event: Firestore onCreate | Notifikasi Fabrikasi saat Admin catat DP |
| `archiveClosedLeads` | Cron: `0 0 * * 0` | Arsipkan leads closed/cancelled mingguan |

---

### 9.4 Non-Functional Requirements

| Aspek | Target |
|-------|--------|
| **Performance** | First Contentful Paint < 2 detik |
| **Availability** | Uptime >= 99.5% (Firebase SLA) |
| **Concurrent Users** | Support >= 50 user aktif bersamaan |
| **File Upload Size** | Maks 10 MB per file |
| **Browser Support** | Chrome 90+, Firefox 88+, Edge 90+, Safari 14+ |
| **Security** | Firebase Auth, HTTPS only, Firestore Security Rules |
| **Data Backup** | Firestore automated daily backup |
| **Audit Trail** | Semua perubahan data penting dicatat (createdAt, updatedAt, createdBy) |

---

### 9.5 Struktur Folder Proyek ReactJS

```
src/
+-- components/           # Komponen reusable (Button, Modal, Table, dll.)
|   +-- ui/               # Base UI (ShadCN)
|   +-- gantt/            # Gantt Chart component
|   +-- inbox/            # Inbox & notifikasi component
|   +-- reminder/         # Reminder popup component
+-- pages/
|   +-- auth/             # Login, PIN setup
|   +-- dashboard/        # Dashboard Admin/SuperAdmin
|   +-- sales/            # Leads, Pipeline, Request
|   +-- admin/            # Quotation, Invoice, Payment
|   +-- fabrikasi/        # Gantt, BOM, Request
|   +-- warehouse/        # Stok management
|   +-- media/            # Konten management
+-- hooks/                # Custom React hooks
+-- services/             # Firebase service layer
|   +-- auth.service.ts
|   +-- firestore.service.ts
|   +-- storage.service.ts
|   +-- notification.service.ts
+-- store/                # State management (Zustand)
+-- utils/                # Helper functions
+-- types/                # TypeScript interfaces
+-- config/               # Firebase config
```

---

## 10. Out of Scope

Fitur-fitur berikut tidak termasuk dalam versi 1.0 ini dan dapat dipertimbangkan untuk iterasi berikutnya:

- Integrasi WhatsApp API otomatis untuk leads dan notifikasi customer
- Laporan keuangan otomatis dalam format standar akuntansi
- Aplikasi mobile native (Android/iOS)
- Portal customer untuk tracking order secara mandiri
- Integrasi payment gateway untuk pembayaran online
- OCR dokumen (scan KTP/NPWP otomatis)
- AI-based sales forecasting
- Modul HR / absensi karyawan

---

## 11. Risiko & Mitigasi

| Risiko | Dampak | Probabilitas | Mitigasi |
|--------|--------|:------------:|---------|
| Resistensi adopsi user terhadap sistem baru | Tinggi | Sedang | Training & dokumentasi user; onboarding terpandu |
| Data Firestore tidak real-time saat koneksi lambat | Sedang | Sedang | Offline persistence Firestore + indikator sinkronisasi |
| Kebocoran data customer (NPWP, KTP) | Tinggi | Rendah | Firestore Security Rules ketat + enkripsi file di Storage |
| Kompleksitas Gantt Chart memperlambat UI | Sedang | Sedang | Virtualisasi tabel + lazy loading data |
| Cloud Functions timeout pada proses berat | Sedang | Rendah | Optimasi query, batas data per batch |
| Scope creep selama development | Tinggi | Tinggi | Change request log, approval dari stakeholder sebelum tambah fitur |

---

## 12. Timeline & Milestone

| Fase | Durasi | Deliverable |
|------|--------|-------------|
| **Fase 1 — Fondasi** | 2 minggu | Setup Firebase, Auth (login + PIN + role), routing, tema light/dark, layout dasar |
| **Fase 2 — Admin & Sales Core** | 3 minggu | Modul Leads CRM, Quotation, Invoice, Payment Tracking, Daily Task |
| **Fase 3 — Fabrikasi & Gantt** | 3 minggu | Gantt Chart produksi, Request Gambar, Request BOM, notifikasi Fabrikasi |
| **Fase 4 — Warehouse & Media** | 2 minggu | Manajemen stok, dimensi, link GDrive; modul konten Media |
| **Fase 5 — Notifikasi & Reminder** | 1 minggu | Cloud Functions reminder (09:00/13:00/17:00), H-7 alert, FCM push notif |
| **Fase 6 — Dashboard & Inbox** | 1 minggu | Dashboard statistik, inbox (read/edit), after-sales garansi |
| **Fase 7 — QA & UAT** | 2 minggu | Testing fungsional, bug fix, User Acceptance Testing bersama tim Sudijaya |
| **Fase 8 — Go Live** | 1 minggu | Deploy ke Firebase Hosting, training user, monitoring awal |

**Total Estimasi Durasi: ± 15 minggu (4 bulan)**

---

## Appendix: Glosarium

| Istilah | Definisi |
|---------|----------|
| **BOM** | Bill of Materials — daftar material & komponen yang dibutuhkan untuk membuat mesin |
| **DP** | Down Payment — uang muka pembayaran dari customer |
| **FAT** | Factory Acceptance Test — pengujian mesin sebelum pengiriman ke customer |
| **QC** | Quality Control — pemeriksaan kualitas produk |
| **PIC** | Person in Charge — penanggung jawab suatu tugas/project |
| **Leads** | Calon customer yang belum melakukan pembelian |
| **Closing** | Proses finalisasi deal / customer setuju membeli |
| **FCM** | Firebase Cloud Messaging — layanan push notification |
| **Gantt Chart** | Diagram batang horizontal untuk visualisasi jadwal dan progress proyek |
| **After-Sales** | Layanan purna jual termasuk garansi dan dukungan teknis |

---

*Dokumen ini adalah versi draft dan dapat direvisi berdasarkan feedback dari stakeholder Sudijaya Group.*

*Dibuat: Juni 2026 | Versi: 1.0.0*
