import { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'

const SKIP = new Set(['auth', 'upload', 'health'])

export function activityLogger(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase()
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next()

  const urlPath = req.originalUrl.replace(/^\/api\//, '').split('?')[0]
  const parts = urlPath.split('/')
  const collection = parts[0] ?? 'unknown'

  if (SKIP.has(collection)) return next()

  // For PUT/DELETE the record id is in the URL; for POST we get it from the response body
  let recordId = method !== 'POST' ? (parts[1] ?? '') : ''

  const originalJson = res.json.bind(res)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res.json = function (body: any): Response {
    if (method === 'POST' && body && typeof body === 'object' && !Array.isArray(body)) {
      recordId = (body as Record<string, string>).id ?? ''
    }
    return originalJson(body)
  }

  res.on('finish', () => {
    if (res.statusCode >= 400) return
    if (!req.user) return

    const action = method === 'POST' ? 'create' : method === 'DELETE' ? 'delete' : 'update'
    const ip =
      ((req.headers['x-forwarded-for'] as string | undefined) ?? '').split(',')[0].trim() ||
      req.ip ||
      ''

    prisma.activityLog
      .create({
        data: {
          userId: req.user.id,
          userRole: req.user.role,
          action,
          collection,
          recordId,
          ipAddress: ip,
        },
      })
      .catch((err: Error) => console.error('[ActivityLog]', err.message))
  })

  next()
}
