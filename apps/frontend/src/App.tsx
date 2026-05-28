import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { PlayerGuard, OwnerGuard, AdminGuard } from './components/guards/RouteGuards';

// Pages — shell layout (with Navbar)
import LandingPage      from './views/LandingPage';
import AuthPage         from './views/AuthPage';
import PlayerDashboard  from './views/PlayerDashboard';
import OwnerDashboard   from './views/OwnerDashboard';
import AdminDashboard   from './views/AdminDashboard';

// Pages — game layout (no Navbar)
import PlayerRoom       from './views/PlayerRoom';
import DisplayView      from './views/DisplayView';
import OwnerRoomDash    from './views/OwnerRoomDash';

/** Smart home redirect: logged-in users go straight to their dashboard */
function HomeRedirect() {
  const { role } = useAuth();
  if (role === 'ADMIN')                       return <Navigate to="/admin" replace />;
  if (role === 'OWNER' || role === 'OPERATOR') return <Navigate to="/owner" replace />;
  if (role === 'PLAYER')                      return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* Public — shell layout */}
              <Route path="/"             element={<HomeRedirect />} />
              <Route path="/auth"         element={<AuthPage />} />
              <Route path="/auth/operator" element={<AuthPage />} />

              {/* Player — shell layout */}
              <Route path="/dashboard" element={<PlayerGuard><PlayerDashboard /></PlayerGuard>} />

              {/* Player — game layout (no navbar) */}
              <Route path="/room/:code" element={<PlayerGuard><PlayerRoom /></PlayerGuard>} />

              {/* Owner — shell layout */}
              <Route path="/owner" element={<OwnerGuard><OwnerDashboard /></OwnerGuard>} />

              {/* Owner room management — game layout (no navbar) */}
              <Route path="/owner/room/:code" element={<OwnerGuard><OwnerRoomDash /></OwnerGuard>} />

              {/* TV display — no navbar, fully public */}
              <Route path="/display/:code" element={<DisplayView />} />

              {/* Admin — shell layout */}
              <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />

              {/* Legacy redirect from /operator/:code */}
              <Route path="/operator/:code" element={<Navigate to="/owner" replace />} />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
