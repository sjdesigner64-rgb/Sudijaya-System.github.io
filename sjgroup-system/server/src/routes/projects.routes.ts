import { Router, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { emitChange } from '../lib/socketBus'
import { getActiveUsersByRole, notifyUsers } from '../lib/notify'
import { advanceProjectStage } from '../lib/pipelineStage'

interface PaymentEntry {
  status: 'pending' | 'paid'
}

const countPaid = (payments: unknown) =>
  (Array.isArray(payments) ? (payments as PaymentEntry[]) : []).filter((p) => p.status === 'paid').length

const countTotal = (payments: unknown) =>
  Array.isArray(payments) ? (payments as PaymentEntry[]).length : 0

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
const coerceDates = (value: unknown): unknown => {
  if (typeof value === 'string' && ISO_DATE_RE.test(value)) return new Date(value)
  if (Array.isArray(value)) return value.map(coerceDates)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = coerceDates(v)
    return out
  }
  return value
}
const coerceBody = (body: Record<string, unknown>) => {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) out[k] = coerceDates(v)
  return out
}

const router = Router()
router.use(requireAuth)

router.get('/', async (req, res, next: NextFunction) => {
  try {
    const where: Record<string, string> = {}
    let orderBy: Record<string, 'asc' | 'desc'> = { createdAt: 'desc' }

    for (const [key, value] of Object.entries(req.query)) {
      if (key === 'sort' && typeof value === 'string') {
        const [field, dir] = value.split(':')
        orderBy = { [field]: dir === 'desc' ? 'desc' : 'asc' }
      } else if (typeof value === 'string') {
        where[key] = value
      }
    }

    // PIC-based access: sales hanya melihat project yang salesPic-nya dirinya.
    // Role lain (admin/super_admin/fabrikasi/dst) tetap lihat semua — mereka
    // bukan "pemilik" field salesPic, cuma butuh daftar project utk dropdown.
    if (req.user!.role === 'sales') {
      where.salesPic = req.user!.id
    }

    const docs = await prisma.project.findMany({ where, orderBy })
    res.json(docs)
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next: NextFunction) => {
  try {
    const doc = await prisma.project.findUnique({ where: { id: req.params.id } })
    if (!doc) return res.status(404).json({ error: 'Not found' })
    if (req.user!.role === 'sales' && doc.salesPic !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    res.json(doc)
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next: NextFunction) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = await prisma.project.create({ data: coerceBody(req.body) as any })
    emitChange('projects')
    res.json(doc)
  } catch (err) { next(err) }
})

router.put('/:id', async (req, res, next: NextFunction) => {
  try {
    const before = await prisma.project.findUnique({ where: { id: req.params.id } })
    const doc = await prisma.project.update({ where: { id: req.params.id }, data: coerceBody(req.body) })
    emitChange('projects')

    const paidBefore = countPaid(before?.payments)
    const paidAfter  = countPaid(doc.payments)
    const totalAfter = countTotal(doc.payments)

    // DP pertama masuk → advance ke dp_layout, notif fabrikasi
    if (paidBefore === 0 && paidAfter > 0) {
      await advanceProjectStage(doc.id, 'dp_layout')

      const fabrikasiUsers = await getActiveUsersByRole(['fabrikasi'])
      if (fabrikasiUsers.length > 0) {
        await notifyUsers(fabrikasiUsers.map((u) => u.id), {
          type: 'dp_received',
          title: 'DP Masuk',
          message: `Down Payment telah masuk untuk project "${doc.name}". Segera mulai proses produksi.`,
          relatedId: doc.id,
          relatedCollection: 'projects',
        })
      }
    }

    // Semua termin lunas → cek juga QC & FAT sudah done, baru auto-create shipment
    const allPaidBefore = countTotal(before?.payments) > 0 && countPaid(before?.payments) === countTotal(before?.payments)
    const allPaidAfter  = totalAfter > 0 && paidAfter === totalAfter
    if (allPaidAfter && !allPaidBefore) {
      const gantt = await prisma.productionGantt.findFirst({
        where: { projectId: doc.id },
        include: { tasks: true },
      })
      const qcFatDone = gantt?.tasks.some((t) => t.taskName === 'qc_fat' && t.status === 'done') ?? false

      if (qcFatDone) {
        await advanceProjectStage(doc.id, 'pengiriman')

        const existingShipment = await prisma.shipment.findFirst({
          where: { projectId: doc.id, leadId: null },
        })
        if (!existingShipment) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await prisma.shipment.create({
            data: {
              projectId: doc.id,
              projectName: doc.name,
              picSalesId: doc.salesPic,
              quantity: 0,
              weight: 0,
              dimensions: { length: 0, width: 0, height: 0 },
              condition: 'baru',
              picPengiriman: '',
              status: 'pending',
              createdBy: req.user!.id,
            } as any,
          })
          emitChange('shipments')
        }
      }
    }

    res.json(doc)
  } catch (err) { next(err) }
})

router.delete('/:id', async (req, res, next: NextFunction) => {
  try {
    await prisma.project.delete({ where: { id: req.params.id } })
    emitChange('projects')
    res.json({ success: true })
  } catch (err) { next(err) }
})

export default router
