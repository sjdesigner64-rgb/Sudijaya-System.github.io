import { Router, RequestHandler } from 'express'
import { requireAuth, requireRole } from '../middleware/auth'
import { emitChange } from './socketBus'

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

interface CrudOptions {
  writeRoles?: string[]
  deleteRoles?: string[]
}

const passThrough: RequestHandler = (_req, _res, next) => next()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCrudRouter(model: any, collectionName: string, options: CrudOptions = {}) {
  const router = Router()
  router.use(requireAuth)

  const canWrite = options.writeRoles ? requireRole(options.writeRoles) : passThrough
  const canDelete = options.deleteRoles ? requireRole(options.deleteRoles) : passThrough

  router.get('/', async (req, res, next) => {
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

      const docs = await model.findMany({ where, orderBy })
      res.json(docs)
    } catch (err) { next(err) }
  })

  router.get('/:id', async (req, res, next) => {
    try {
      const doc = await model.findUnique({ where: { id: req.params.id } })
      if (!doc) return res.status(404).json({ error: 'Not found' })
      res.json(doc)
    } catch (err) { next(err) }
  })

  router.post('/', canWrite, async (req, res, next) => {
    try {
      const doc = await model.create({ data: coerceBody(req.body) })
      emitChange(collectionName)
      res.json(doc)
    } catch (err) { next(err) }
  })

  router.put('/:id', canWrite, async (req, res, next) => {
    try {
      const doc = await model.update({ where: { id: req.params.id }, data: coerceBody(req.body) })
      emitChange(collectionName)
      res.json(doc)
    } catch (err) { next(err) }
  })

  router.delete('/:id', canDelete, async (req, res, next) => {
    try {
      await model.delete({ where: { id: req.params.id } })
      emitChange(collectionName)
      res.json({ success: true })
    } catch (err) { next(err) }
  })

  return router
}
