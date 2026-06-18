import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'

const router = Router()

router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email: string; password: string }
  if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib diisi' })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.isActive) return res.status(401).json({ error: 'Email atau password salah' })

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) return res.status(401).json({ error: 'Email atau password salah' })

  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET as string, {
    expiresIn: '7d',
  })

  const { password: _password, ...profile } = user
  res.json({ token, user: profile })
})

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } })
  if (!user) return res.status(404).json({ error: 'Not found' })
  const { password: _password, ...profile } = user
  res.json(profile)
})

export default router
