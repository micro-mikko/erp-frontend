import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, RefreshCcw, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const IDLE_TIMEOUT_MS = 50 * 60 * 1000;  // 50 min inaktivitet → visa varning
const COUNTDOWN_START = 10 * 60;          // 600 sekunder nedräkning
const HEALTH_POLL_MS  = 2 * 60 * 1000;   // hälsokontroll var 2:e minut
const IDLE_CHECK_MS   = 30 * 1000;        // kontrollera inaktivitet var 30s

function formatCountdown(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function SystemMonitor() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_START);
  const [backendDown, setBackendDown] = useState(false);

  const lastActivityRef = useRef(Date.now());
  const showWarningRef = useRef(false);

  // ── Logga ut ─────────────────────────────────────────────────────────────

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  // ── Håll igång ────────────────────────────────────────────────────────────

  const handleKeepAlive = useCallback(async () => {
    lastActivityRef.current = Date.now();
    showWarningRef.current = false;
    setShowWarning(false);
    setCountdown(COUNTDOWN_START);
    try {
      await fetch('/api/health', { signal: AbortSignal.timeout(5000) });
      setBackendDown(false);
    } catch {
      // ignorera — backend-bannern hanterar detta
    }
  }, []);

  // ── Aktivitetslyssning ────────────────────────────────────────────────────

  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (showWarningRef.current) {
      // Aktivitet medan varningen visas → håll igång automatiskt
      handleKeepAlive();
    }
  }, [handleKeepAlive]);

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;
    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));
    return () => events.forEach(e => window.removeEventListener(e, handleActivity));
  }, [handleActivity]);

  // ── Inaktivitetskontroll (var 30s) ────────────────────────────────────────

  useEffect(() => {
    const interval = setInterval(() => {
      if (showWarningRef.current) return;
      const idle = Date.now() - lastActivityRef.current;
      if (idle >= IDLE_TIMEOUT_MS) {
        showWarningRef.current = true;
        setShowWarning(true);
        setCountdown(COUNTDOWN_START);
      }
    }, IDLE_CHECK_MS);
    return () => clearInterval(interval);
  }, []);

  // ── Nedräkning (1s tick, aktiv bara när varning visas) ────────────────────

  useEffect(() => {
    if (!showWarning) return;
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          handleLogout();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showWarning, handleLogout]);

  // ── Health polling (var 2 min) ────────────────────────────────────────────

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/health', { signal: AbortSignal.timeout(5000) });
        setBackendDown(!res.ok);
      } catch {
        setBackendDown(true);
      }
    };
    // Kör direkt vid mount
    check();
    const interval = setInterval(check, HEALTH_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backend offline-banner */}
      {backendDown && !showWarning && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white text-sm py-2 px-4 flex items-center justify-center gap-3">
          <AlertTriangle size={14} className="shrink-0" />
          <span>Systemet svarar inte — kontrollera att servern körs</span>
          <button
            onClick={handleKeepAlive}
            className="underline font-medium hover:no-underline transition-all"
          >
            Försök igen
          </button>
        </div>
      )}

      {/* Inaktivitetsvarning — modal */}
      {showWarning && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-surface-100 border border-white/10 rounded-2xl p-8 w-full max-w-sm text-center space-y-6 shadow-2xl animate-slide-up">

            {/* Ikon */}
            <div className="w-16 h-16 rounded-full bg-amber-500/15 border border-amber-500/20 flex items-center justify-center mx-auto">
              <AlertTriangle size={28} className="text-amber-400" />
            </div>

            {/* Text + nedräkning */}
            <div className="space-y-2">
              <h2 className="text-white font-semibold text-base">Systemet går i vila</h2>
              <p className="text-white/40 text-sm">Du loggas ut automatiskt om</p>
              <p className="text-5xl font-mono font-bold text-amber-400 tabular-nums">
                {formatCountdown(countdown)}
              </p>
            </div>

            {/* Knappar */}
            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleKeepAlive}
                className="btn-primary justify-center"
              >
                <RefreshCcw size={14} />
                Håll systemet igång
              </button>
              <button
                onClick={handleLogout}
                className="btn-ghost justify-center text-white/40 hover:text-white/70"
              >
                <LogOut size={14} />
                Logga ut och stäng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
