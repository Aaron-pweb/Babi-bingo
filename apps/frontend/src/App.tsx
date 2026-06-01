import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { PlayerGuard, OwnerGuard, AdminGuard } from './components/guards/RouteGuards';

// Shell pages (Navbar visible)
import LandingPage     from './views/LandingPage';
import LoginPage       from './views/LoginPage';
import RegisterPage    from './views/RegisterPage';
import PlayerDashboard from './views/PlayerDashboard';
import OwnerDashboard  from './views/OwnerDashboard';
import AdminDashboard  from './views/AdminDashboard';

// Game pages (no Navbar — GameShell)
import PlayerRoom      from './views/PlayerRoom';
import DisplayView     from './views/DisplayView';
import OwnerRoomDash   from './views/OwnerRoomDash';

// Operator invite accept page
import OperatorAcceptInvite from './views/OperatorAcceptInvite';

/** Smart home redirect — wait for auth to load, then route by role */
function HomeRedirect() {
  const { role, authLoading } = useAuth();

  // While validating token don't redirect — show landing
  if (authLoading) return <LandingPage />;

  if (role === 'ADMIN')                        return <Navigate to="/admin"     replace />;
  if (role === 'OWNER' || role === 'OPERATOR') return <Navigate to="/owner"     replace />;
  if (role === 'PLAYER')                       return <Navigate to="/dashboard" replace />;

  return <LandingPage />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* Public */}
              <Route path="/"          element={<HomeRedirect />} />
              <Route path="/login"     element={<LoginPage />} />
              <Route path="/register"  element={<RegisterPage />} />

              {/* Operator invite — public but token-gated */}
              <Route path="/invite/:token" element={<OperatorAcceptInvite />} />

              {/* Player */}
              <Route path="/dashboard"  element={<PlayerGuard><PlayerDashboard /></PlayerGuard>} />
              <Route path="/room/:code" element={<PlayerGuard><PlayerRoom /></PlayerGuard>} />

              {/* Owner / Operator */}
              <Route path="/owner"           element={<OwnerGuard><OwnerDashboard /></OwnerGuard>} />
              <Route path="/owner/room/:code" element={<OwnerGuard><OwnerRoomDash /></OwnerGuard>} />

              {/* TV Display — fully public */}
              <Route path="/display/:code" element={<DisplayView />} />

              {/* Admin */}
              <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />

              {/* Legacy redirects */}
              <Route path="/auth"            element={<Navigate to="/login"    replace />} />
              <Route path="/auth/operator"   element={<Navigate to="/login"    replace />} />
              <Route path="/operator/:code"  element={<Navigate to="/owner"    replace />} />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
