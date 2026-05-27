import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/** H1 + L5: Blocks /operator/:code if no operator token */
export function OperatorGuard({ children }: { children: ReactNode }) {
  const { opToken } = useAuth();
  if (!opToken) return <Navigate to="/?error=auth_required" replace />;
  return <>{children}</>;
}

/** H1 + L5: Blocks /room/:code if no player token */
export function PlayerGuard({ children }: { children: ReactNode }) {
  const { playerToken } = useAuth();
  if (!playerToken) return <Navigate to="/?error=auth_required" replace />;
  return <>{children}</>;
}
