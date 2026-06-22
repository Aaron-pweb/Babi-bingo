import { type ReactNode } from 'react';
import Navbar from './Navbar';

/** Shell with navbar — used on: /, /auth, /dashboard, /owner, /admin */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
      {/* Ambient background glow */}
      <div style={{
        position: 'absolute', top: '-20%', left: '-10%', width: '60vw', height: '60vw',
        background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, rgba(0,0,0,0) 70%)',
        borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', right: '-10%', width: '50vw', height: '50vw',
        background: 'radial-gradient(circle, rgba(245,166,35,0.06) 0%, rgba(0,0,0,0) 70%)',
        borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0
      }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <Navbar />
        <main style={{ flex: 1 }}>{children}</main>
        <footer style={{ borderTop: '1px solid var(--border)', padding: '1.5rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
            © {new Date().getFullYear()} BabiBingo — Premium Live Bingo
          </p>
        </footer>
      </div>
    </div>
  );
}

/** Bare shell — no navbar, no footer. Used for: game rooms, TV display */
export function GameShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
      {/* Ambient background glow for game */}
      <div style={{
        position: 'absolute', top: '10%', right: '10%', width: '70vw', height: '70vw',
        background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, rgba(0,0,0,0) 70%)',
        borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}


