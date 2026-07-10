import { Router, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth, requireRole } from '../middleware/auth'
import { emitChange } from '../lib/socketBus'
import { advanceProjectStage } from '../lib/pipelineStage'

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
router.use(requireRole(['fabrikasi', 'super_admin', 'admin', 'sales']))

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

    // fabrikasi hanya lihat shipment yang picPengiriman-nya dirinya
    if (req.user!.role === 'fabrikasi') {
      where.picPengiriman = req.user!.id
    }

    const docs = await prisma.shipment.findMany({ where, orderBy })
    res.json(docs)
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next: NextFunction) => {
  try {
    const doc = await prisma.shipment.findUnique({ where: { id: req.params.id } })
    if (!doc) return res.status(404).json({ error: 'Not found' })
    res.json(doc)
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next: NextFunction) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = await prisma.shipment.create({ data: coerceBody(req.body) as any })
    emitChange('shipments')
    if (doc.projectId) await advanceProjectStage(doc.projectId, 'pengiriman')
    res.json(doc)
  } catch (err) { next(err) }
})

router.put('/:id', async (req, res, next: NextFunction) => {
  try {
    const existing = await prisma.shipment.findUnique({ where: { id: req.params.id } })

    const doc = await prisma.shipment.update({
      where: { id: req.params.id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: coerceBody(req.body) as any,
    })
    emitChange('shipments')

    // Auto-create installation ketika project sales shipment status → 'selesai'
    if (doc.status === 'selesai' && existing?.status !== 'selesai' && !doc.leadId && doc.projectId) {
      await advanceProjectStage(doc.projectId, 'instalasi')
      const existingInstall = await prisma.installation.findFirst({ where: { projectId: doc.projectId } })
      if (!existingInstall) {
        const [project, gantt] = await Promise.all([
          prisma.project.findUnique({ where: { id: doc.projectId } }),
          prisma.productionGantt.findFirst({
            where: { projectId: doc.projectId },
            include: { tasks: true },
          }),
        ])
        const installasiTask = gantt?.tasks.find((t) => t.taskName === 'instalasi')
        const now = new Date()
        const installationDate = installasiTask?.startDate ?? now
        const deadline = installasiTask?.deadline ?? new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
        await prisma.installation.create({
          data: {
            projectId: doc.projectId,
            projectName: project?.name ?? (doc.projectName ?? ''),
            customerName: project?.customerName ?? '',
            picInstalasi: '',
            installationDate,
            estimatedDuration: '',
            deadline,
            lokasi: project?.alamat ?? '',
            notes: '',
            status: 'pending',
            createdBy: req.user!.id,
          },
        })
        emitChange('installations')
      }
    }

    res.json(doc)
  } catch (err) { next(err) }
})

router.delete('/:id', requireRole(['super_admin', 'admin']), async (req, res, next: NextFunction) => {
  try {
    await prisma.shipment.delete({ where: { id: req.params.id } })
    emitChange('shipments')
    res.json({ success: true })
  } catch (err) { next(err) }
})

export default router
