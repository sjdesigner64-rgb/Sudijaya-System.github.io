import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { sendPasswordResetEmail } from '../lib/mailer'

const router = Router()

router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email: string; password: string }
  const emailTrim = (typeof email === 'string' ? email.trim() : '').toLowerCase()
  const passTrim  = typeof password === 'string' ? password : ''

  if (!emailTrim || !passTrim) return res.status(400).json({ error: 'Email dan password wajib diisi' })
  if (emailTrim.length > 254 || passTrim.length > 128) return res.status(400).json({ error: 'Input tidak valid' })

  const user = await prisma.user.findUnique({ where: { email: emailTrim } })
  if (!user || !user.isActive) return res.status(401).json({ error: 'Email atau password salah' })

  const valid = await bcrypt.compare(passTrim, user.password)
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

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body as { email?: string }
  if (!email) return res.status(400).json({ error: 'Email wajib diisi' })

  // Selalu respon sukses agar tidak bocorkan info email terdaftar
  const user = await prisma.user.findUnique({ where: { email: email.trim() } })
  if (!user || !user.isActive) {
    return res.json({ message: 'Jika email terdaftar, link reset akan dikirim.' })
  }

  // Hapus token lama milik user ini
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } })

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 jam

  await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } })

  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'
  const resetLink = `${frontendUrl}/reset-password?token=${token}`

  try {
    await sendPasswordResetEmail(user.email, user.name, resetLink)
  } catch (err) {
    console.error('[forgot-password] Gagal kirim email:', err)
    return res.status(500).json({ error: 'Gagal mengirim email. Cek konfigurasi SMTP.' })
  }

  res.json({ message: 'Jika email terdaftar, link reset akan dikirim.' })
})

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body as { token?: string; password?: string }
  if (!token || !password) return res.status(400).json({ error: 'Token dan password wajib diisi' })
  if (password.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter' })

  const record = await prisma.passwordResetToken.findUnique({ where: { token } })
  if (!record || record.expiresAt < new Date()) {
    await prisma.passwordResetToken.deleteMany({ where: { token } })
    return res.status(400).json({ error: 'Token tidak valid atau sudah kadaluarsa' })
  }

  const hashed = await bcrypt.hash(password, 10)
  await prisma.user.update({ where: { id: record.userId }, data: { password: hashed } })
  await prisma.passwordResetToken.delete({ where: { token } })

  res.json({ message: 'Password berhasil diubah. Silakan login.' })
})

export default router
