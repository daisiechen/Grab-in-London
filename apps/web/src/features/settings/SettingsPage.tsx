import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useSession } from '../../api/session.tsx';
import { signInPath } from '../../lib/returnTo.ts';
import { Loading, PageHeader, Primary } from '../../ui/components.tsx';
import { Sheet } from '../../ui/Sheet.tsx';

/** Settings hub; survey, reports and deletion entries are added by their slices (T16/T18/T19). */
export function SettingsPage() {
  const { state, signOut } = useSession();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'guest') return <Navigate to={signInPath('/settings')} replace />;
  return (
    <>
      <PageHeader title="Settings" backTo="/profile" />
      <div className="body-pad settings-page">
        <h1>Make yourself at home.</h1>
        <p className="prose">Your preferences, privacy and account in one place.</p>
        <section>
          <h2>Account</h2>
          <div className="settings-info-row"><span>Email</span><span>{state.session.user.email ?? 'Not shared'}</span></div>
          <Primary secondary onClick={() => setConfirm(true)}>Sign out</Primary>
        </section>
      </div>
      <Sheet open={confirm} onOpenChange={setConfirm} title="Sign out of Fancy?">
        <p>You’ll be signed out on this device. Unsent drafts on this device are removed.</p>
        <Primary disabled={busy} onClick={async () => {
          setBusy(true);
          await signOut();
          setConfirm(false);
          navigate('/discover', { replace: true });
        }}>Sign out</Primary>
        <Primary secondary onClick={() => setConfirm(false)}>Stay signed in</Primary>
      </Sheet>
    </>
  );
}
