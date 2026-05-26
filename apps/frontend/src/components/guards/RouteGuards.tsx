import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

/** H1: Blocks access to /operator/:code if no operator token is stored */
export function OperatorGuard({ children }: { children: ReactNode }) {
  const token = localStorage.getItem('op_token');
  if (!token) return <Navigate to="/?error=auth_required" replace />;
  return <>{children}</>;
}

/** H1: Blocks access to /room/:code if no player token is stored */
export function PlayerGuard({ children }: { children: ReactNode }) {
  const token = localStorage.getItem('player_token');
  if (!token) return <Navigate to="/?error=auth_required" replace />;
  return <>{children}</>;
}
