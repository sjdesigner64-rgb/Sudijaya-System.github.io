import { Router, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth, requireRole } from '../middleware/auth'

const router = Router()
router.use(requireAuth)

router.get('/', async (req, res, next: NextFunction) => {
  try {
    const where: Record<string, unknown> = {}
    if (!['super_admin', 'admin'].includes(req.user!.role)) {
      where.recipientId = req.user!.id
    } else {
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') where[key] = value
      }
    }
    const docs = await prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' } })
    res.json(docs)
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next: NextFunction) => {
  try {
    const doc = await prisma.notification.findUnique({ where: { id: req.params.id } })
    if (!doc) return res.status(404).json({ error: 'Not found' })
    if (!['super_admin', 'admin'].includes(req.user!.role) && doc.recipientId !== req.user!.id)
      return res.status(403).json({ error: 'Forbidden' })
    res.json(doc)
  } catch (err) { next(err) }
})

router.put('/:id', async (req, res, next: NextFunction) => {
  try {
    const doc = await prisma.notification.findUnique({ where: { id: req.params.id } })
    if (!doc) return res.status(404).json({ error: 'Not found' })
    if (!['super_admin', 'admin'].includes(req.user!.role) && doc.recipientId !== req.user!.id)
      return res.status(403).json({ error: 'Forbidden' })
    const updated = await prisma.notification.update({ where: { id: req.params.id }, data: req.body })
    res.json(updated)
  } catch (err) { next(err) }
})

router.delete('/:id', requireRole(['super_admin', 'admin']), async (req, res, next: NextFunction) => {
  try {
    await prisma.notification.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) { next(err) }
})

export default router
