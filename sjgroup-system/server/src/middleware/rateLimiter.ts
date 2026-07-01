import rateLimit from 'express-rate-limit'

// Rate limiter umum: semua endpoint API
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak request. Coba lagi dalam beberapa menit.' },
  skip: (req) => req.method === 'OPTIONS',
})

// Rate limiter ketat: login (cegah brute force)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 10, // max 10 percobaan login per IP per 15 menit
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
  skipSuccessfulRequests: true, // hanya hitung yang gagal
})

// Rate limiter upload: cegah spam upload file
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak upload. Coba lagi sebentar lagi.' },
})
