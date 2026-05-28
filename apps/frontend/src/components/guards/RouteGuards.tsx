import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function PlayerGuard({ children }: { children: ReactNode }) {
  const { role } = useAuth();
  if (!role) return <Navigate to="/auth?error=auth_required" replace />;
  if (role !== 'PLAYER') return <Navigate to="/owner" replace />;
  return <>{children}</>;
}

export function OwnerGuard({ children }: { children: ReactNode }) {
  const { role } = useAuth();
  if (!role) return <Navigate to="/auth?error=auth_required" replace />;
  if (role !== 'OWNER' && role !== 'OPERATOR') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export function AdminGuard({ children }: { children: ReactNode }) {
  const { role } = useAuth();
  if (!role) return <Navigate to="/auth?error=auth_required" replace />;
  if (role !== 'ADMIN') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function AnyAuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/auth?error=auth_required" replace />;
  return <>{children}</>;
}
