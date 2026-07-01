import { Router, type Request } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { requireAuth } from '../middleware/auth'

const UPLOAD_ROOT = path.resolve(path.join(__dirname, '..', '..', 'uploads'))

// Ekstensi yang diizinkan — blok file eksekusi (php, exe, dll, sh, dll)
const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.mp4', '.mp3', '.mov', '.avi', '.mkv',
  '.zip', '.rar', '.7z',
  '.txt', '.csv',
])

// Pastikan path yang diminta tetap di dalam UPLOAD_ROOT (cegah path traversal)
function safeResolvePath(requestedPath: string): string {
  // Normalize: hilangkan ../, ./, dan karakter berbahaya
  const normalized = path.normalize(requestedPath).replace(/^(\.\.(\/|\\|$))+/, '')
  const resolved = path.resolve(UPLOAD_ROOT, normalized)
  if (!resolved.startsWith(UPLOAD_ROOT + path.sep) && resolved !== UPLOAD_ROOT) {
    throw new Error('Invalid path')
  }
  return resolved
}

function getRequestedPath(req: Request): string | undefined {
  return typeof req.query.path === 'string' ? req.query.path : undefined
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    try {
      const requestedPath = getRequestedPath(req)
      const subPath = (requestedPath ?? '').split('/').slice(0, -1).join('/')
      const dest = subPath ? safeResolvePath(subPath) : UPLOAD_ROOT
      fs.mkdirSync(dest, { recursive: true })
      cb(null, dest)
    } catch {
      cb(new Error('Path tidak valid'), '')
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error(`Tipe file tidak diizinkan: ${ext}`), '')
    }
    const requestedPath = getRequestedPath(req) ?? file.originalname
    const parts = requestedPath.split('/')
    const filename = parts[parts.length - 1]
    // Sanitasi nama file: hanya izinkan karakter aman
    const safe = filename.replace(/[^a-zA-Z0-9._\-]/g, '_')
    cb(null, safe)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // max 20MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error(`Tipe file tidak diizinkan: ${ext}`))
    }
    cb(null, true)
  },
})

const router = Router()
router.use(requireAuth)

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' })
  const requestedPath = getRequestedPath(req) ?? req.file.filename
  // Sanitasi path untuk URL
  const safePath = requestedPath.replace(/[^a-zA-Z0-9._\-/]/g, '_')
  const url = `${process.env.PUBLIC_URL}/uploads/${safePath}`
  res.json({ url, path: safePath })
})

router.delete('/', (req, res) => {
  const relativePath = req.body.path as string
  if (!relativePath || typeof relativePath !== 'string') {
    return res.status(400).json({ error: 'path wajib diisi' })
  }
  try {
    const fullPath = safeResolvePath(relativePath)
    fs.unlink(fullPath, (err) => {
      if (err && err.code !== 'ENOENT') {
        return res.status(500).json({ error: 'Gagal menghapus file' })
      }
      res.json({ success: true })
    })
  } catch {
    res.status(400).json({ error: 'Path tidak valid' })
  }
})

export default router
