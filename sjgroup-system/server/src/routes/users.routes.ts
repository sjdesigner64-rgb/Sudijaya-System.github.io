import { Router, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import { requireAuth, requireRole } from '../middleware/auth'
import { emitChange } from '../lib/socketBus'

const router = Router()
router.use(requireAuth)

const omitPassword = <T extends { password: string }>(user: T) => {
  const { password: _password, ...rest } = user
  return rest
}

router.get('/', async (req, res, next: NextFunction) => {
  try {
    const where: Record<string, string> = {}
    let orderBy: Record<string, 'asc' | 'desc'> = { name: 'asc' }

    for (const [key, value] of Object.entries(req.query)) {
      if (key === 'sort' && typeof value === 'string') {
        const [field, dir] = value.split(':')
        orderBy = { [field]: dir === 'desc' ? 'desc' : 'asc' }
      } else if (typeof value === 'string') {
        where[key] = value
      }
    }

    const users = await prisma.user.findMany({ where, orderBy })
    res.json(users.map(omitPassword))
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } })
    if (!user) return res.status(404).json({ error: 'Not found' })
    res.json(omitPassword(user))
  } catch (err) { next(err) }
})

const VALID_ROLES = ['super_admin', 'admin', 'sales', 'fabrikasi', 'warehouse', 'media']

router.post('/', requireRole(['super_admin']), async (req, res, next: NextFunction) => {
  try {
    const { name, email, password, role } = req.body as {
      name: string; email: string; password: string; role: string
    }
    const nameTrim  = typeof name     === 'string' ? name.trim()            : ''
    const emailTrim = typeof email    === 'string' ? email.trim().toLowerCase() : ''
    const passTrim  = typeof password === 'string' ? password               : ''

    if (!nameTrim || !emailTrim || !passTrim || !role) {
      return res.status(400).json({ error: 'Data user tidak lengkap' })
    }
    if (nameTrim.length > 100)  return res.status(400).json({ error: 'Nama terlalu panjang' })
    if (emailTrim.length > 254) return res.status(400).json({ error: 'Email tidak valid' })
    if (passTrim.length < 6)    return res.status(400).json({ error: 'Password minimal 6 karakter' })
    if (passTrim.length > 128)  return res.status(400).json({ error: 'Password terlalu panjang' })
    if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Role tidak valid' })

    const existing = await prisma.user.findUnique({ where: { email: emailTrim } })
    if (existing) return res.status(409).json({ error: 'Email sudah terdaftar' })

    const hashed = await bcrypt.hash(passTrim, 10)
    const user = await prisma.user.create({
      data: { name: nameTrim, email: emailTrim, password: hashed, role, isActive: true },
    })
    emitChange('users')
    res.json(omitPassword(user))
  } catch (err) { next(err) }
})

router.put('/:id', async (req, res, next: NextFunction) => {
  try {
    const isSelf = req.user!.id === req.params.id
    const isSuperAdmin = req.user!.role === 'super_admin'
    if (!isSelf && !isSuperAdmin) return res.status(403).json({ error: 'Forbidden' })

    const { name, email, role, isActive, avatarUrl, password } = req.body as Record<string, unknown>
    const data: Record<string, unknown> = {}
    if (typeof name === 'string') data.name = name
    if (typeof avatarUrl === 'string') data.avatarUrl = avatarUrl
    if (isSuperAdmin) {
      if (typeof role === 'string') data.role = role
      if (typeof isActive === 'boolean') data.isActive = isActive
      if (typeof email === 'string' && email.trim()) {
        const conflict = await prisma.user.findFirst({ where: { email: email.trim(), NOT: { id: req.params.id } } })
        if (conflict) return res.status(409).json({ error: 'Email sudah digunakan oleh user lain' })
        data.email = email.trim()
      }
    }
    if (typeof password === 'string' && password.length >= 6) {
      data.password = await bcrypt.hash(password, 10)
    }

    const user = await prisma.user.update({ where: { id: req.params.id }, data })
    emitChange('users')
    res.json(omitPassword(user))
  } catch (err) { next(err) }
})

router.delete('/:id', requireRole(['super_admin']), async (req, res, next: NextFunction) => {
  try {
    if (req.user!.id === req.params.id) {
      return res.status(400).json({ error: 'Tidak dapat menghapus akun sendiri' })
    }
    await prisma.user.delete({ where: { id: req.params.id } })
    emitChange('users')
    res.json({ success: true })
  } catch (err) { next(err) }
})

export default router
