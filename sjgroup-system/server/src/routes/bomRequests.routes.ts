import { Router, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth, requireRole } from '../middleware/auth'
import { emitChange } from '../lib/socketBus'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
const coerceDates = (v: unknown): unknown => {
  if (typeof v === 'string' && ISO_DATE_RE.test(v)) return new Date(v)
  if (Array.isArray(v)) return v.map(coerceDates)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v)) out[k] = coerceDates(val)
    return out
  }
  return v
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
    const where: Record<string, unknown> = {}
    let orderBy: Record<string, 'asc' | 'desc'> = { createdAt: 'desc' }
    for (const [key, value] of Object.entries(req.query)) {
      if (key === 'sort' && typeof value === 'string') {
        const [field, dir] = value.split(':')
        orderBy = { [field]: dir === 'asc' ? 'asc' : 'desc' }
      } else if (typeof value === 'string') {
        where[key] = value
      }
    }
    const docs = await prisma.bomRequest.findMany({ where, orderBy })
    res.json(docs)
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next: NextFunction) => {
  try {
    const doc = await prisma.bomRequest.findUnique({ where: { id: req.params.id } })
    if (!doc) return res.status(404).json({ error: 'Not found' })
    res.json(doc)
  } catch (err) { next(err) }
})

// Hanya sales & super_admin yang boleh membuat request BOM baru
router.post('/', requireRole(['sales', 'super_admin']), async (req, res, next: NextFunction) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = await prisma.bomRequest.create({ data: coerceBody(req.body) as any })
    emitChange('requests_bom')
    res.json(doc)
  } catch (err) { next(err) }
})

router.put('/:id', async (req, res, next: NextFunction) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = await prisma.bomRequest.update({ where: { id: req.params.id }, data: coerceBody(req.body) as any })
    emitChange('requests_bom')
    res.json(doc)
  } catch (err) { next(err) }
})

router.delete('/:id', async (req, res, next: NextFunction) => {
  try {
    await prisma.bomRequest.delete({ where: { id: req.params.id } })
    emitChange('requests_bom')
    res.json({ success: true })
  } catch (err) { next(err) }
})

export default router
