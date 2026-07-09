import 'dotenv/config'

// ── Cegah crash dari unhandled rejection / uncaught exception ─────────────────
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason)
})
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err.message, err.stack)
})

import express, { NextFunction, Request, Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'path'
import http from 'http'
import { Server } from 'socket.io'
import { setIO } from './lib/socketBus'
import { prisma } from './lib/prisma'
import { createCrudRouter } from './lib/crudFactory'
import { startJobs } from './jobs'
import { apiLimiter, loginLimiter, uploadLimiter } from './middleware/rateLimiter'

import authRoutes from './routes/auth.routes'
import usersRoutes from './routes/users.routes'
import projectsRoutes from './routes/projects.routes'
import productionGanttRoutes from './routes/productionGantt.routes'
import drawingRequestsRoutes from './routes/drawingRequests.routes'
import afterSalesRoutes from './routes/afterSales.routes'
import shipmentsRoutes from './routes/shipments.routes'
import installationsRoutes from './routes/installations.routes'
import leadsRoutes from './routes/leads.routes'
import contentRequestsRoutes from './routes/contentRequests.routes'
import mediaAssetsRoutes from './routes/mediaAssets.routes'
import contentDataRoutes from './routes/contentData.routes'
import tasksRoutes from './routes/tasks.routes'
import uploadRoutes from './routes/upload.routes'
import bomRequestsRoutes from './routes/bomRequests.routes'

const app = express()
const isProd = process.env.NODE_ENV === 'production'

// ── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // izinkan /uploads diakses browser
  contentSecurityPolicy: false, // CSP diatur di Nginx untuk SPA
}))

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map(o => o.trim())
app.use(cors({
  origin: (origin, cb) => {
    // Izinkan request tanpa origin (Postman, server-to-server) hanya di dev
    if (!origin && !isProd) return cb(null, true)
    if (origin && allowedOrigins.includes(origin)) return cb(null, true)
    cb(new Error('Not allowed by CORS'))
  },
  credentials: true,
}))

// ── Body parser dengan limit ──────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true, limit: '2mb' }))

// ── Static files (uploads) ────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), {
  dotfiles: 'deny',          // blok file tersembunyi (.htaccess, .env)
  index: false,              // matikan directory listing
}))

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use('/api/', apiLimiter)
app.use('/api/auth/login', loginLimiter)
app.use('/api/upload', uploadLimiter)

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/projects', projectsRoutes)
app.use('/api/production_gantt', productionGanttRoutes)
app.use('/api/requests_drawing', drawingRequestsRoutes)
app.use('/api/after_sales', afterSalesRoutes)
app.use('/api/shipments', shipmentsRoutes)
app.use('/api/installations', installationsRoutes)
app.use('/api/leads', leadsRoutes)
app.use('/api/content_requests', contentRequestsRoutes)
app.use('/api/media_assets', mediaAssetsRoutes)
app.use('/api/content_data', contentDataRoutes)
app.use('/api/tasks', tasksRoutes)
app.use('/api/upload', uploadRoutes)

app.use('/api/customers',      createCrudRouter(prisma.customer,      'customers'))
app.use('/api/quotations',     createCrudRouter(prisma.quotation,     'quotations'))
app.use('/api/invoices',       createCrudRouter(prisma.invoice,       'invoices'))
app.use('/api/requests_bom',   bomRequestsRoutes)
app.use('/api/warehouse_stock',createCrudRouter(prisma.warehouseStock,'warehouse_stock'))
app.use('/api/meetings',       createCrudRouter(prisma.meeting,       'meetings'))
app.use('/api/notifications',  createCrudRouter(prisma.notification,  'notifications'))

app.get('/api/health', (_req, res) => res.json({ ok: true }))

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const status = (err as { status?: number }).status ?? 500

  // Di production: jangan bocorkan stack trace / pesan internal
  if (isProd && status === 500) {
    console.error('[ERROR]', err.message, err.stack)
    return res.status(500).json({ error: 'Terjadi kesalahan internal.' })
  }

  // Di development atau error yang sudah di-handle (4xx): tampilkan pesan
  if (!isProd) console.error('[ERROR]', err.message)
  res.status(status).json({ error: err.message ?? 'Internal server error' })
})

// ── HTTP + Socket.io ──────────────────────────────────────────────────────────
const httpServer = http.createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
})
setIO(io)

const PORT = process.env.PORT ?? 4000
const HOST = process.env.HOST ?? '127.0.0.1'
httpServer.listen(Number(PORT), HOST, () => {
  console.log(`Server jalan di ${HOST}:${PORT} [${isProd ? 'production' : 'development'}]`)
  startJobs()
})
