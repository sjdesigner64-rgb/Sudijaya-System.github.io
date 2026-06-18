import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthUser {
  id: string
  role: string
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const token = header.slice('Bearer '.length)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { sub: string; role: string }
    req.user = { id: payload.sub, role: payload.role }
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export const requireRole = (roles: string[]) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  next()
}
