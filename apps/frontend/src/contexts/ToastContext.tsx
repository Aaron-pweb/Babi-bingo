import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast { id: string; type: ToastType; message: string; }
interface ToastCtx { toast: (message: string, type?: ToastType) => void; }

const ToastContext = createContext<ToastCtx | null>(null);

const ICONS: Record<ToastType, string> = {
  success: '✓', error: '✗', info: 'ℹ', warning: '⚠',
};
const COLORS: Record<ToastType, string> = {
  success: '#34d399', error: '#f87171', info: '#60a5fa', warning: '#fbbf24',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '360px' }}>
        {toasts.map((t) => (
          <div key={t.id} className="animate-slide-in" style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            background: 'var(--surface)', border: `1px solid ${COLORS[t.type]}33`,
            borderLeft: `3px solid ${COLORS[t.type]}`,
            borderRadius: 'var(--radius-md)', padding: '0.875rem 1rem',
            boxShadow: 'var(--shadow-md)',
          }}>
            <span style={{ color: COLORS[t.type], fontWeight: 700, fontSize: '1rem' }}>{ICONS[t.type]}</span>
            <span style={{ color: 'var(--text)', fontSize: '0.875rem', fontWeight: 500 }}>{t.message}</span>
            <button onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))}
              style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: '1rem', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}
