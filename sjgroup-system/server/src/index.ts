import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import http from 'http'
import { Server } from 'socket.io'
import { setIO } from './lib/socketBus'
import { prisma } from './lib/prisma'
import { createCrudRouter } from './lib/crudFactory'
import { startJobs } from './jobs'

import authRoutes from './routes/auth.routes'
import usersRoutes from './routes/users.routes'
import projectsRoutes from './routes/projects.routes'
import productionGanttRoutes from './routes/productionGantt.routes'
import drawingRequestsRoutes from './routes/drawingRequests.routes'
import afterSalesRoutes from './routes/afterSales.routes'
import shipmentsRoutes from './routes/shipments.routes'
import installationsRoutes from './routes/installations.routes'
import uploadRoutes from './routes/upload.routes'

const app = express()
app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }))
app.use(express.json())
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

app.use('/api/auth', authRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/projects', projectsRoutes)
app.use('/api/production_gantt', productionGanttRoutes)
app.use('/api/requests_drawing', drawingRequestsRoutes)
app.use('/api/after_sales', afterSalesRoutes)
app.use('/api/shipments', shipmentsRoutes)
app.use('/api/installations', installationsRoutes)
app.use('/api/upload', uploadRoutes)

app.use('/api/customers', createCrudRouter(prisma.customer, 'customers'))
app.use('/api/leads', createCrudRouter(prisma.lead, 'leads'))
app.use('/api/quotations', createCrudRouter(prisma.quotation, 'quotations'))
app.use('/api/invoices', createCrudRouter(prisma.invoice, 'invoices'))
app.use('/api/tasks', createCrudRouter(prisma.task, 'tasks'))
app.use('/api/requests_bom', createCrudRouter(prisma.bomRequest, 'requests_bom'))
app.use('/api/warehouse_stock', createCrudRouter(prisma.warehouseStock, 'warehouse_stock'))
app.use('/api/content_requests', createCrudRouter(prisma.contentRequest, 'content_requests'))
app.use('/api/meetings', createCrudRouter(prisma.meeting, 'meetings'))
app.use('/api/notifications', createCrudRouter(prisma.notification, 'notifications'))

app.get('/api/health', (_req, res) => res.json({ ok: true }))

const httpServer = http.createServer(app)
const io = new Server(httpServer, { cors: { origin: process.env.CORS_ORIGIN ?? '*' } })
setIO(io)

const PORT = process.env.PORT ?? 4000
httpServer.listen(PORT, () => {
  console.log(`Server jalan di port ${PORT}`)
  startJobs()
})
