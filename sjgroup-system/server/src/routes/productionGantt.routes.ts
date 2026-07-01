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

    const docs = await prisma.productionGantt.findMany({ where, orderBy })
    res.json(docs)
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next: NextFunction) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = await prisma.productionGantt.create({ data: coerceBody(req.body) as any })
    emitChange('production_gantt')
    if (doc.projectId) await advanceProjectStage(doc.projectId, 'fabrikasi_build')
    res.json(doc)
  } catch (err) { next(err) }
})

router.put('/:id', async (req, res, next: NextFunction) => {
  try {
    const doc = await prisma.productionGantt.update({
      where: { id: req.params.id },
      data: coerceBody(req.body),
    })
    emitChange('production_gantt')
    res.json(doc)
  } catch (err) { next(err) }
})

router.delete('/:id', async (req, res, next: NextFunction) => {
  try {
    await prisma.productionGantt.delete({ where: { id: req.params.id } })
    emitChange('production_gantt')
    res.json({ success: true })
  } catch (err) { next(err) }
})

// ── Nested tasks subcollection ──────────────────────────────
router.get('/:ganttId/tasks', async (req, res, next: NextFunction) => {
  try {
    const tasks = await prisma.ganttTask.findMany({
      where: { ganttId: req.params.ganttId },
      orderBy: { createdAt: 'asc' },
    })
    res.json(tasks)
  } catch (err) { next(err) }
})

router.post('/:ganttId/tasks', async (req, res, next: NextFunction) => {
  try {
    const task = await prisma.ganttTask.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { ...coerceBody(req.body), ganttId: req.params.ganttId } as any,
    })
    emitChange(`production_gantt/${req.params.ganttId}/tasks`)
    res.json(task)
  } catch (err) { next(err) }
})

router.put('/:ganttId/tasks/:taskId', async (req, res, next: NextFunction) => {
  try {
    const task = await prisma.ganttTask.update({
      where: { id: req.params.taskId },
      data: coerceBody(req.body),
    })
    emitChange(`production_gantt/${req.params.ganttId}/tasks`)
    res.json(task)
  } catch (err) { next(err) }
})

router.delete('/:ganttId/tasks/:taskId', async (req, res, next: NextFunction) => {
  try {
    await prisma.ganttTask.delete({ where: { id: req.params.taskId } })
    emitChange(`production_gantt/${req.params.ganttId}/tasks`)
    res.json({ success: true })
  } catch (err) { next(err) }
})

export default router
