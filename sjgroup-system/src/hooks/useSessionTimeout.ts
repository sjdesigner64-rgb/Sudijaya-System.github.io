import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/store/authStore'

const IDLE_MS = 30 * 60 * 1000   // 30 menit inaktif → logout
const WARN_MS = 60 * 1000         // tampilkan peringatan 60 detik sebelum logout
const TICK_MS = 1000              // update countdown setiap detik

export function useSessionTimeout() {
  const { isAuthenticated, logout } = useAuthStore()
  const [showWarning, setShowWarning] = useState(false)
  const [countdown, setCountdown] = useState(WARN_MS / 1000)

  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef(WARN_MS / 1000)

  const clearAllTimers = useCallback(() => {
    if (logoutTimer.current) clearTimeout(logoutTimer.current)
    if (warnTimer.current) clearTimeout(warnTimer.current)
    if (tickTimer.current) clearInterval(tickTimer.current)
    logoutTimer.current = null
    warnTimer.current = null
    tickTimer.current = null
  }, [])

  const startCountdownTick = useCallback(() => {
    countdownRef.current = WARN_MS / 1000
    setCountdown(countdownRef.current)

    if (tickTimer.current) clearInterval(tickTimer.current)
    tickTimer.current = setInterval(() => {
      countdownRef.current -= 1
      setCountdown(countdownRef.current)
    }, TICK_MS)
  }, [])

  const resetTimers = useCallback(() => {
    if (!isAuthenticated) return
    clearAllTimers()
    setShowWarning(false)

    // Setelah IDLE_MS - WARN_MS: tampilkan peringatan
    warnTimer.current = setTimeout(() => {
      setShowWarning(true)
      startCountdownTick()

      // Setelah WARN_MS tambahan: auto-logout
      logoutTimer.current = setTimeout(() => {
        setShowWarning(false)
        logout()
      }, WARN_MS)
    }, IDLE_MS - WARN_MS)
  }, [isAuthenticated, clearAllTimers, startCountdownTick, logout])

  const extendSession = useCallback(() => {
    setShowWarning(false)
    resetTimers()
  }, [resetTimers])

  const logoutNow = useCallback(() => {
    clearAllTimers()
    setShowWarning(false)
    logout()
  }, [clearAllTimers, logout])

  useEffect(() => {
    if (!isAuthenticated) {
      clearAllTimers()
      setShowWarning(false)
      return
    }

    const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const

    // Throttle: reset timer maksimal sekali per 10 detik untuk hemat performa
    let lastReset = 0
    const handleActivity = () => {
      const now = Date.now()
      if (now - lastReset < 10_000) return
      lastReset = now
      // Hanya reset jika tidak sedang di dalam window peringatan
      if (!showWarning) resetTimers()
    }

    EVENTS.forEach((ev) => window.addEventListener(ev, handleActivity, { passive: true }))
    resetTimers()

    return () => {
      EVENTS.forEach((ev) => window.removeEventListener(ev, handleActivity))
      clearAllTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  return { showWarning, countdown, extendSession, logoutNow }
}
