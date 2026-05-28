import { type ReactNode } from 'react';
import Navbar from './Navbar';

/** Shell with navbar — used on: /, /auth, /dashboard, /owner, /admin */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <Navbar />
      <main style={{ flex: 1 }}>{children}</main>
      <footer style={{ borderTop: '1px solid var(--border)', padding: '1.5rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
          © {new Date().getFullYear()} BabiBingo — The live bingo platform
        </p>
      </footer>
    </div>
  );
}

/** Bare shell — no navbar, no footer. Used for: game rooms, TV display */
export function GameShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {children}
    </div>
  );
}
