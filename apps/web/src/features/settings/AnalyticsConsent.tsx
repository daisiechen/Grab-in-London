import { useState } from 'react';
import { useLocation } from 'react-router';
import { BarChartIcon } from '@radix-ui/react-icons';
import { useTelemetry } from '../../api/telemetry.tsx';
import { useSession } from '../../api/session.tsx';
import { FormMessage, LinkRow, Primary } from '../../ui/components.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { clearFreshSignIn, useFreshSignIn } from '../../lib/freshSignIn.ts';

const COPY = 'Allow optional usage analytics, including meal views and discovery results? We don’t collect message text or search keywords. You can decline and keep using Fancy. Your choice lasts for this account session.';

function Choices({ onChosen }: { onChosen?: () => void }) {
  const telemetry = useTelemetry();
  return (
    <div aria-label="Optional analytics" role="group">
      <p className="body" style={{ marginBottom: 12 }}>{COPY}</p>
      <Primary secondary disabled={telemetry.busy} onClick={() => { onChosen?.(); void telemetry.choose(true); }}>Allow analytics</Primary>
      <Primary secondary disabled={telemetry.busy} onClick={() => { onChosen?.(); void telemetry.choose(false); }}>Decline analytics</Primary>
      <FormMessage message={telemetry.error} />
    </div>
  );
}

/** Settings / profile row (iOS AnalyticsConsent): collapsed once a choice exists, expandable to change it. */
export function AnalyticsConsent({ preferences: _preferences = false }: { preferences?: boolean }) {
  const telemetry = useTelemetry();
  const [expanded, setExpanded] = useState(false);
  if (telemetry.choice !== 'unknown' && !expanded && !telemetry.error) {
    return <LinkRow icon={<BarChartIcon width={14} height={14} />} label="Analytics preferences" sub={telemetry.enabled ? 'Allowed' : 'Not allowed'} onClick={() => setExpanded(true)} />;
  }
  return (
    <section className="summary" style={{ background: 'var(--surface)' }} aria-labelledby="analytics-title">
      <h2 id="analytics-title" style={{ margin: 0 }}>Help improve Fancy</h2>
      <Choices onChosen={() => setExpanded(false)} />
    </section>
  );
}

/**
 * One prompt right after signing in while no choice exists (iOS AnalyticsConsentSheet, spec F1.5/D7).
 * Guests never see it and get no analytics. Closing it leaves analytics off; Profile can change it.
 */
export function AnalyticsConsentSheet() {
  const telemetry = useTelemetry();
  const { state } = useSession();
  const fresh = useFreshSignIn();
  const { pathname } = useLocation();
  // Not over the sign-in, linking or profile-setup steps: it waits for the page the member returns to.
  const between = /^\/(sign-in|auth\/|profile-setup|profile-edit)/.test(pathname);
  const open = state.status === 'signed-in' && fresh && !between && (telemetry.choice === 'unknown' || Boolean(telemetry.error));
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) clearFreshSignIn(); }} title="Help improve Fancy">
      <Choices onChosen={clearFreshSignIn} />
    </Sheet>
  );
}
