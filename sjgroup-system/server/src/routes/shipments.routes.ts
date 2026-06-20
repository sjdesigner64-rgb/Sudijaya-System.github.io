import { Router } from 'express'
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
router.use(requireRole(['fabrikasi', 'super_admin']))

router.get('/', async (req, res) => {
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

  const docs = await prisma.shipment.findMany({ where, orderBy })
  res.json(docs)
})

router.get('/:id', async (req, res) => {
  const doc = await prisma.shipment.findUnique({ where: { id: req.params.id } })
  if (!doc) return res.status(404).json({ error: 'Not found' })
  res.json(doc)
})

router.post('/', async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = await prisma.shipment.create({ data: coerceBody(req.body) as any })
  emitChange('shipments')
  if (doc.projectId) await advanceProjectStage(doc.projectId, 'pengiriman')
  res.json(doc)
})

router.put('/:id', async (req, res) => {
  const doc = await prisma.shipment.update({
    where: { id: req.params.id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: coerceBody(req.body) as any,
  })
  emitChange('shipments')
  res.json(doc)
})

router.delete('/:id', async (req, res) => {
  await prisma.shipment.delete({ where: { id: req.params.id } })
  emitChange('shipments')
  res.json({ success: true })
})

export default router
