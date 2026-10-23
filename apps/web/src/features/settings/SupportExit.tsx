import { useState } from 'react';
import { SUPPORT_EMAIL, supportMailto } from '@fancy/client';
import { Primary } from '../../ui/components.tsx';

/**
 * Public support exit after a deletion request (Figma 489:*): no sign-in, no token in the link.
 * `Copied` appears only after the clipboard really accepted the text; otherwise the address stays
 * selectable for manual copy. Opening the mail editor is never reported as sent.
 */
export function SupportExit({ reason }: { reason: 'needsSupport' | 'receiptUnavailable' }) {
  const [copy, setCopy] = useState<'' | 'copied' | 'failed'>('');
  const copyAddress = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('unsupported');
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopy('copied');
    } catch {
      setCopy('failed');
    }
  };
  return (
    <section aria-labelledby="support-exit-title" className="summary-box">
      <h2 id="support-exit-title">Contact support</h2>
      <p>{reason === 'needsSupport'
        ? 'Our support team needs to finish removing your account. You don’t need to sign in to contact us.'
        : 'Your removal reference isn’t available on this device. You can still contact support without signing in.'}</p>
      <p>Email <strong className="selectable" data-testid="support-email">{SUPPORT_EMAIL}</strong>. Describe the issue in your own words. Don’t include passwords or your removal reference.</p>
      <a className="primary secondary" href={supportMailto()}>Email support</a>
      <Primary secondary onClick={() => void copyAddress()}>Copy email address</Primary>
      <p className="muted" role="status">{copy === 'copied' ? 'Copied.' : copy === 'failed' ? 'Couldn’t copy. Select the address above to copy it.' : 'Opening your email app doesn’t send anything by itself.'}</p>
    </section>
  );
}
