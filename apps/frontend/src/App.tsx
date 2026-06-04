import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { PlayerGuard, OwnerGuard, AdminGuard } from './components/guards/RouteGuards';

import LandingPage     from './views/LandingPage';
import LoginPage       from './views/LoginPage';
import RegisterPage    from './views/RegisterPage';
import PlayerDashboard from './views/PlayerDashboard';
import OwnerDashboard  from './views/OwnerDashboard';
import AdminDashboard  from './views/AdminDashboard';
import PlayerRoom      from './views/PlayerRoom';
import DisplayView     from './views/DisplayView';
import OwnerRoomDash   from './views/OwnerRoomDash';

function HomeRedirect() {
  const { role, authLoading } = useAuth();
  if (authLoading) return <LandingPage />;
  if (role === 'ADMIN')  return <Navigate to="/admin"     replace />;
  if (role === 'OWNER')  return <Navigate to="/owner"     replace />;
  if (role === 'PLAYER') return <Navigate to="/dashboard" replace />;
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
              <Route path="/"         element={<HomeRedirect />} />
              <Route path="/login"    element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Player */}
              <Route path="/dashboard"  element={<PlayerGuard><PlayerDashboard /></PlayerGuard>} />
              <Route path="/room/:code" element={<PlayerGuard><PlayerRoom /></PlayerGuard>} />

              {/* Owner */}
              <Route path="/owner"            element={<OwnerGuard><OwnerDashboard /></OwnerGuard>} />
              <Route path="/owner/room/:code" element={<OwnerGuard><OwnerRoomDash /></OwnerGuard>} />

              {/* TV Display — fully public */}
              <Route path="/display/:code" element={<DisplayView />} />

              {/* Admin */}
              <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />

              {/* Legacy redirects */}
              <Route path="/auth"           element={<Navigate to="/login" replace />} />
              <Route path="/auth/operator"  element={<Navigate to="/login" replace />} />
              <Route path="/operator/:code" element={<Navigate to="/owner" replace />} />
              <Route path="/invite/:token"  element={<Navigate to="/login" replace />} />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
