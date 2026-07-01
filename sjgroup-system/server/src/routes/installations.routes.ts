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
// Semua role yang relevan dapat akses endpoint ini
router.use(requireRole(['super_admin', 'admin', 'sales', 'fabrikasi']))

// GET / — semua role lihat semua data
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

    const docs = await prisma.installation.findMany({ where, orderBy })
    res.json(docs)
  } catch (err) { next(err) }
})

// GET /:id — semua role boleh lihat detail
router.get('/:id', async (req, res, next: NextFunction) => {
  try {
    const doc = await prisma.installation.findUnique({ where: { id: req.params.id } })
    if (!doc) return res.status(404).json({ error: 'Not found' })
    res.json(doc)
  } catch (err) { next(err) }
})

// POST / — hanya admin yang boleh buat manual (fabrikasi/sales tidak)
router.post('/', requireRole(['super_admin', 'admin']), async (req, res, next: NextFunction) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = await prisma.installation.create({ data: coerceBody(req.body) as any })
    emitChange('installations')
    if (doc.projectId) await advanceProjectStage(doc.projectId, 'instalasi')
    res.json(doc)
  } catch (err) { next(err) }
})

// PUT /:id — admin bisa edit semua; fabrikasi hanya jika picInstalasi-nya sendiri; sales tidak bisa
router.put('/:id', async (req, res, next: NextFunction) => {
  try {
    const role = req.user!.role
    if (role === 'sales') {
      return res.status(403).json({ error: 'Sales tidak dapat mengubah data instalasi' })
    }
    if (role === 'fabrikasi') {
      const existing = await prisma.installation.findUnique({ where: { id: req.params.id } })
      if (!existing || existing.picInstalasi !== req.user!.id) {
        return res.status(403).json({ error: 'Hanya PIC instalasi yang dapat mengubah data ini' })
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = await prisma.installation.update({ where: { id: req.params.id }, data: coerceBody(req.body) as any })
    emitChange('installations')
    res.json(doc)
  } catch (err) { next(err) }
})

// DELETE /:id — hanya admin
router.delete('/:id', requireRole(['super_admin', 'admin']), async (req, res, next: NextFunction) => {
  try {
    await prisma.installation.delete({ where: { id: req.params.id } })
    emitChange('installations')
    res.json({ success: true })
  } catch (err) { next(err) }
})

export default router
