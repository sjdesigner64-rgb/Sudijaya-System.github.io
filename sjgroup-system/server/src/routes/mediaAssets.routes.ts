import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { emitChange } from '../lib/socketBus'

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

  const docs = await prisma.mediaAsset.findMany({ where, orderBy })
  res.json(docs)
})

router.get('/:id', async (req, res) => {
  const doc = await prisma.mediaAsset.findUnique({ where: { id: req.params.id } })
  if (!doc) return res.status(404).json({ error: 'Not found' })
  res.json(doc)
})

router.post('/', async (req, res) => {
  const doc = await prisma.mediaAsset.create({ data: req.body })
  emitChange('media_assets')
  res.json(doc)
})

router.put('/:id', async (req, res) => {
  const doc = await prisma.mediaAsset.update({ where: { id: req.params.id }, data: req.body })
  emitChange('media_assets')
  res.json(doc)
})

router.delete('/:id', async (req, res) => {
  await prisma.mediaAsset.delete({ where: { id: req.params.id } })
  emitChange('media_assets')
  res.json({ success: true })
})

export default router
