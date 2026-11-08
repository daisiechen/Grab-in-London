import { TitleBar } from '../../ui/components.tsx';
import { useDocumentMeta } from '../../seo/useDocumentMeta.ts';

/** Cancellation terms, pay-at-venue wording (iOS CancellationTermsScreen; PRD r07 §0.2–0.3). */
export function CancellationTermsPage() {
  useDocumentMeta({ title: 'Cancellation terms · Fancy', canonical: '/cancellation-terms' });
  return (
    <div className="scroll">
      <TitleBar title="Cancellation terms" subtitle="Pay at the restaurant · no in-app payment" />
      <h2>Your place</h2>
      <p className="prose">You can withdraw an application or cancel your place before the meal starts. Let your host know as early as possible.</p>
      <p className="prose" style={{ marginTop: 8 }}>If the group falls below its minimum after applications close, the meal is cancelled. Before the deadline, the host can keep recruiting.</p>
      <h2>Hosting a meal</h2>
      <p className="prose">Hosts can cancel the whole meal before it starts. Cancel your restaurant booking yourself and tell your guests.</p>
      <h2>Paying</h2>
      <p className="prose">Everyone pays their own share at the restaurant. There is no in-app payment, so nothing to refund. Any restaurant cancellation fee follows the arrangement the host made with the restaurant.</p>
      <h2>Your group chat</h2>
      <p className="prose">Cancelling a place or a meal doesn’t close the group chat. Leaving the group or closing it is a separate, confirmed action.</p>
    </div>
  );
}
