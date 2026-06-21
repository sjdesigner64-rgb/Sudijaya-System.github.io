import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { emitChange } from '../lib/socketBus'

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

  // PIC-based access: sales hanya lihat tiket yang picAftersales-nya dirinya,
  // fabrikasi hanya lihat tiket yang technicianAssigned-nya dirinya.
  // admin & super_admin tetap lihat semua.
  if (req.user!.role === 'sales') {
    where.picAftersales = req.user!.id
  } else if (req.user!.role === 'fabrikasi') {
    where.technicianAssigned = req.user!.id
  }

  const docs = await prisma.afterSales.findMany({ where, orderBy })
  res.json(docs)
})

router.get('/:id', async (req, res) => {
  const doc = await prisma.afterSales.findUnique({ where: { id: req.params.id } })
  if (!doc) return res.status(404).json({ error: 'Not found' })
  const role = req.user!.role
  if (role === 'sales' && doc.picAftersales !== req.user!.id) return res.status(403).json({ error: 'Forbidden' })
  if (role === 'fabrikasi' && doc.technicianAssigned !== req.user!.id) return res.status(403).json({ error: 'Forbidden' })
  res.json(doc)
})

router.post('/', async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = await prisma.afterSales.create({ data: coerceBody(req.body) as any })
  emitChange('after_sales')
  res.json(doc)
})

router.put('/:id', async (req, res) => {
  const doc = await prisma.afterSales.update({
    where: { id: req.params.id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: coerceBody(req.body) as any,
  })
  emitChange('after_sales')
  res.json(doc)
})

router.delete('/:id', async (req, res) => {
  await prisma.afterSales.delete({ where: { id: req.params.id } })
  emitChange('after_sales')
  res.json({ success: true })
})

export default router
