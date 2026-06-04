import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

function Loading() {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:'3rem', marginBottom:'1rem', animation:'spin 1s linear infinite', display:'inline-block' }}>🎱</div>
        <p style={{ color:'var(--dim)', fontWeight:600 }}>Loading…</p>
      </div>
    </div>
  );
}

export function PlayerGuard({ children }: { children: ReactNode }) {
  const { role, authLoading } = useAuth();
  if (authLoading) return <Loading />;
  if (!role) return <Navigate to="/login" replace />;
  if (role !== 'PLAYER') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export function OwnerGuard({ children }: { children: ReactNode }) {
  const { role, authLoading } = useAuth();
  if (authLoading) return <Loading />;
  if (!role) return <Navigate to="/login" replace />;
  if (role !== 'OWNER') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function AdminGuard({ children }: { children: ReactNode }) {
  const { role, authLoading } = useAuth();
  if (authLoading) return <Loading />;
  if (!role) return <Navigate to="/login" replace />;
  if (role !== 'ADMIN') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function AnyAuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, authLoading } = useAuth();
  if (authLoading) return <Loading />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
