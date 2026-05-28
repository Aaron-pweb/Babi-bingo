import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

export default function Navbar() {
  const { role, nickname, houseName, clearAll, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const nav = useNavigate();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  function handleLogout() {
    clearAll();
    nav('/');
  }

  // Role-based navigation links
  const links = (() => {
    if (role === 'ADMIN')                     return [{ to: '/admin', label: 'Dashboard' }];
    if (role === 'OWNER' || role === 'OPERATOR') return [{ to: '/owner', label: 'My House' }];
    if (role === 'PLAYER')                    return [{ to: '/dashboard', label: 'Play' }];
    return [];
  })();

  const displayName = nickname ?? houseName ?? 'Account';

  return (
    <nav style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      className="sticky top-0 z-50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="text-2xl">🎱</span>
          <span className="font-black text-xl" style={{ color: 'var(--gold)' }}>Babi<span style={{ color: 'var(--text)' }}>Bingo</span></span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link key={l.to} to={l.to}
              className={`nav-link ${isActive(l.to) ? 'active' : ''}`}>
              {l.label}
            </Link>
          ))}
          {!isAuthenticated && (
            <>
              <Link to="/auth" className={`nav-link ${isActive('/auth') ? 'active' : ''}`}>Sign In</Link>
            </>
          )}
        </div>

        {/* Right: theme + account */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button onClick={toggleTheme} className="btn-ghost p-2 rounded-lg" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{displayName}</span>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>{role}</span>
              </div>
              <button onClick={handleLogout} className="btn-outline text-sm px-4 py-2">Sign Out</button>
            </div>
          ) : (
            <Link to="/auth" className="btn-primary text-sm px-4 py-2">Get Started</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
