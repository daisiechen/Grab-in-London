import { Fragment, type ReactNode } from 'react';
import { useServices, useSessionState } from '../../services.tsx';

/** Dispose local private drafts/receipts on account changes, not only the shared query cache. */
export function SessionScope({ children }: { children: ReactNode }) {
  const state = useSessionState();
  const { session } = useServices();
  const user = state.status === 'signedIn' ? state.session.user.id : 'guest';
  return <Fragment key={`${session.generation}:${user}`}>{children}</Fragment>;
}
