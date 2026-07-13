import { Router, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth, requireRole } from '../middleware/auth'
import { emitChange } from '../lib/socketBus'

const router = Router()
router.use(requireAuth)

router.get('/', async (req, res, next: NextFunction) => {
  try {
    const where: Record<string, unknown> = {}
    let orderBy: Record<string, 'asc' | 'desc'> = { createdAt: 'desc' }

    if (!['super_admin', 'admin'].includes(req.user!.role)) {
      where.recipientId = req.user!.id
    } else {
      for (const [key, value] of Object.entries(req.query)) {
        if (key === 'sort' && typeof value === 'string') {
          const [field, dir] = value.split(':')
          orderBy = { [field]: dir === 'desc' ? 'desc' : 'asc' }
        } else if (typeof value === 'string') {
          where[key] = value
        }
      }
    }

    const docs = await prisma.notification.findMany({ where, orderBy })
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
    const isAdmin = ['super_admin', 'admin'].includes(req.user!.role)
    if (!isAdmin && doc.recipientId !== req.user!.id)
      return res.status(403).json({ error: 'Forbidden' })
    // Non-admin recipients may only toggle isRead — no other field mutation allowed
    const data = isAdmin ? req.body : { isRead: req.body.isRead }
    const updated = await prisma.notification.update({ where: { id: req.params.id }, data })
    emitChange('notifications')
    res.json(updated)
  } catch (err) { next(err) }
})

router.delete('/:id', requireRole(['super_admin', 'admin']), async (req, res, next: NextFunction) => {
  try {
    await prisma.notification.delete({ where: { id: req.params.id } })
    emitChange('notifications')
    res.json({ success: true })
  } catch (err) { next(err) }
})

export default router
