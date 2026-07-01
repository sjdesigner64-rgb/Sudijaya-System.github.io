import { Router, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
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

    let docs = await prisma.drawingRequest.findMany({ where, orderBy })

    // PIC-based access: sales hanya lihat request yang dia buat sendiri,
    // fabrikasi hanya lihat request yang dirinya ada di assignedTo (PIC).
    // super_admin tetap lihat semua.
    if (req.user!.role === 'sales') {
      docs = docs.filter((d) => d.requestedBy === req.user!.id)
    } else if (req.user!.role === 'fabrikasi') {
      docs = docs.filter((d) => Array.isArray(d.assignedTo) && (d.assignedTo as unknown[]).includes(req.user!.id))
    }

    res.json(docs)
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next: NextFunction) => {
  try {
    const doc = await prisma.drawingRequest.findUnique({ where: { id: req.params.id } })
    if (!doc) return res.status(404).json({ error: 'Not found' })
    const role = req.user!.role
    const isOwner = doc.requestedBy === req.user!.id
    const isAssigned = Array.isArray(doc.assignedTo) && (doc.assignedTo as unknown[]).includes(req.user!.id)
    if (role === 'sales' && !isOwner) return res.status(403).json({ error: 'Forbidden' })
    if (role === 'fabrikasi' && !isAssigned) return res.status(403).json({ error: 'Forbidden' })
    res.json(doc)
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next: NextFunction) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = await prisma.drawingRequest.create({ data: coerceBody(req.body) as any })
    emitChange('requests_drawing')
    if (doc.projectId) await advanceProjectStage(doc.projectId, 'dp_layout')
    res.json(doc)
  } catch (err) { next(err) }
})

router.put('/:id', async (req, res, next: NextFunction) => {
  try {
    const doc = await prisma.drawingRequest.update({
      where: { id: req.params.id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: coerceBody(req.body) as any,
    })
    emitChange('requests_drawing')
    res.json(doc)
  } catch (err) { next(err) }
})

router.delete('/:id', async (req, res, next: NextFunction) => {
  try {
    await prisma.drawingRequest.delete({ where: { id: req.params.id } })
    emitChange('requests_drawing')
    res.json({ success: true })
  } catch (err) { next(err) }
})

export default router
