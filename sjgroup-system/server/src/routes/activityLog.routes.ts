import { Router, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth, requireRole } from '../middleware/auth'

const router = Router()
router.use(requireAuth)
router.use(requireRole(['super_admin', 'admin']))

router.get('/', async (req, res, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50)
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (typeof req.query.userId === 'string' && req.query.userId) where.userId = req.query.userId
    if (typeof req.query.action === 'string' && req.query.action) where.action = req.query.action
    if (typeof req.query.collection === 'string' && req.query.collection) where.collection = req.query.collection

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.activityLog.count({ where }),
    ])

    const userIds = [...new Set(logs.map((l) => l.userId))]
    const users = userIds.length
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
      : []
    const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]))

    const data = logs.map((l) => ({ ...l, userName: userMap[l.userId] ?? l.userId }))

    res.json({ data, total, page, limit })
  } catch (err) { next(err) }
})

export default router
