import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { requireAuth } from '../middleware/auth'

const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads')

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const subPath = (req.body.path || '').split('/').slice(0, -1).join('/')
    const dest = path.join(UPLOAD_ROOT, subPath)
    fs.mkdirSync(dest, { recursive: true })
    cb(null, dest)
  },
  filename: (req, file, cb) => {
    const parts = (req.body.path || file.originalname).split('/')
    cb(null, parts[parts.length - 1])
  },
})

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

const router = Router()
router.use(requireAuth)

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' })
  const relativePath = (req.body.path as string) || req.file.filename
  const url = `${process.env.PUBLIC_URL}/uploads/${relativePath}`
  res.json({ url, path: relativePath })
})

router.delete('/', (req, res) => {
  const relativePath = req.body.path as string
  if (!relativePath) return res.status(400).json({ error: 'path wajib diisi' })
  const fullPath = path.join(UPLOAD_ROOT, relativePath)
  fs.unlink(fullPath, () => res.json({ success: true }))
})

export default router
