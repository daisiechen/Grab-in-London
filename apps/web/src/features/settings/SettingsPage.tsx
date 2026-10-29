import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useSession } from '../../api/session.tsx';
import { Loading, Primary, TextAction, TitleBar } from '../../ui/components.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { useDocumentMeta } from '../../seo/useDocumentMeta.ts';
import { AnalyticsConsent } from './AnalyticsConsent.tsx';
import { ChevronRightIcon } from '@radix-ui/react-icons';
import { Link } from 'react-router';

/** Public pages of the Fancy site, as iOS lib/legal.ts (served as static pages by this build). */
export const LEGAL_PAGES = [
  ['/support/', 'Contact support'],
  ['/guidelines/', 'Community guidelines'],
  ['/terms/', 'Terms of use'],
  ['/privacy/', 'Privacy notice'],
] as const;

function Row({ label, to, href, onClick, danger }: { label: string; to?: string; href?: string; onClick?: () => void; danger?: boolean }) {
  const inner = <><span>{label}</span><ChevronRightIcon width={16} height={16} aria-hidden="true" /></>;
  const cls = `srow${danger ? ' danger' : ''}`;
  if (to) return <Link className={cls} to={to}>{inner}</Link>;
  if (href) return <a className={cls} href={href}>{inner}</a>;
  return <button type="button" className={cls} onClick={onClick}>{inner}</button>;
}

/**
 * Settings (iOS SettingsScreen): notifications, privacy & safety, help shape Fancy, account, help &
 * legal, data credits. Guests see the parts that don't need an account. Sign-out is confirmed.
 */
export function SettingsPage() {
  const { state, signOut } = useSession();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  useDocumentMeta({ title: 'Settings · Fancy', robots: 'noindex, nofollow' });
  if (state.status === 'loading') return <Loading />;
  const signedIn = state.status === 'signed-in';
  return (
    <div className="scroll">
      <TitleBar title="Settings" subtitle="Your preferences, privacy and account in one place." back="/profile" />
      {signedIn && (
        <section aria-labelledby="s-notify">
          <h2 id="s-notify">Notifications &amp; previews</h2>
          <Row label="Notifications" to="/notifications" />
          <p className="muted" style={{ marginTop: 6 }}>Meal updates and messages always stay in Inbox. Important updates are also emailed to {state.session.user.email ?? 'your sign-in address'}.</p>
        </section>
      )}
      <section aria-labelledby="s-privacy">
        <h2 id="s-privacy">Privacy &amp; safety</h2>
        <p className="body">Your name, photo and introduction help your table get to know you. Your email is private.</p>
        <p className="body">Meal groups require a confirmed seat. Private conversations require mutual choice after a shared meal.</p>
        {signedIn && <Row label="Blocked members" to="/blocked-members" />}
        <div className="srow" role="group" aria-label="App language: English" style={{ borderBottom: 0 }}><span className="body" style={{ margin: 0 }}>App language</span><span className="muted">English</span></div>
        <p className="muted">Conversation languages can be changed in your profile.</p>
      </section>
      {signedIn && (
        <section aria-labelledby="s-shape">
          <h2 id="s-shape">Help shape Fancy</h2>
          <Row label="Product survey" to="/survey" />
          <AnalyticsConsent preferences />
        </section>
      )}
      <section aria-labelledby="s-account">
        <h2 id="s-account">Account</h2>
        {signedIn && <Row label="Edit public profile" to="/profile-edit" />}
        <Row label="Check deletion status" to="/deletion-status" />
        {signedIn && <Row danger label="Delete account" to="/delete-account" />}
        {signedIn && <Row danger label="Sign out" onClick={() => setConfirm(true)} />}
      </section>
      <section aria-labelledby="s-legal">
        <h2 id="s-legal">Help &amp; legal</h2>
        {LEGAL_PAGES.map(([href, label]) => <Row key={href} label={label} href={href} />)}
      </section>
      <section aria-labelledby="s-data">
        <h2 id="s-data">Data sources</h2>
        <p className="muted">London areas: Office for National Statistics, licensed under the Open Government Licence v3.0. Contains OS data © Crown copyright and database right 2021. Area names: House of Commons Library MSOA Names 2.3, licensed under the Open Parliament Licence v3.0.</p>
      </section>
      <Sheet open={confirm} onOpenChange={setConfirm} title="Sign out?">
        <p className="body">You’ll be signed out on this device. Unsent drafts on this device are removed.</p>
        <Primary secondary onClick={() => setConfirm(false)}>Stay signed in</Primary>
        <TextAction danger disabled={busy} onClick={async () => {
          setBusy(true);
          await signOut();
          setBusy(false);
          setConfirm(false);
          navigate('/', { replace: true });
        }}>Sign out</TextAction>
      </Sheet>
    </div>
  );
}
