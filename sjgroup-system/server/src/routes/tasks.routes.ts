import { Router, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { emitChange } from '../lib/socketBus'
import { notifyUser } from '../lib/notify'

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

    const docs = await prisma.task.findMany({ where, orderBy })
    res.json(docs)
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next: NextFunction) => {
  try {
    const doc = await prisma.task.findUnique({ where: { id: req.params.id } })
    if (!doc) return res.status(404).json({ error: 'Not found' })
    res.json(doc)
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next: NextFunction) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = await prisma.task.create({ data: coerceBody(req.body) as any })
    emitChange('tasks')

    // Kirim notifikasi ke Inbox PIC yang ditugaskan, sebutkan judul & deskripsi
    // tugasnya supaya langsung jelas tanpa perlu buka halaman Daily Task dulu.
    if (doc.assignedTo) {
      const deadline = doc.dueDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      await notifyUser({
        recipientId: doc.assignedTo,
        type: 'reminder',
        title: `Tugas Baru: ${doc.title}`,
        message: doc.description
          ? `${doc.description} (Deadline: ${deadline})`
          : `Anda mendapat tugas baru, deadline ${deadline}.`,
        relatedId: doc.id,
        relatedCollection: 'tasks',
      })
    }

    res.json(doc)
  } catch (err) { next(err) }
})

router.put('/:id', async (req, res, next: NextFunction) => {
  try {
    const doc = await prisma.task.update({
      where: { id: req.params.id },
      data: coerceBody(req.body),
    })
    emitChange('tasks')
    res.json(doc)
  } catch (err) { next(err) }
})

router.delete('/:id', async (req, res, next: NextFunction) => {
  try {
    await prisma.task.delete({ where: { id: req.params.id } })
    emitChange('tasks')
    res.json({ success: true })
  } catch (err) { next(err) }
})

export default router
