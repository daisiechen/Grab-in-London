import { PageHeader, PrimaryLink } from '../../ui/components.tsx';

/** Prototype cancellation terms, pay-at-restaurant variant only (P-01). */
export function TermsPage() {
  return (
    <>
      <PageHeader title="Cancellation terms" backTo="/create" />
      <div className="body-pad cancellation-terms">
        <h1>Cancellation terms</h1>
        <h2>Your place</h2>
        <p>You can withdraw an application or cancel your place before the meal starts. Let your host know as early as possible.</p>
        <p>If the group falls below its minimum after applications close, the meal is cancelled. Before the deadline, the host can keep recruiting.</p>
        <h2>Hosting a meal</h2>
        <p>Hosts can cancel the whole meal before it starts. Cancel any external restaurant booking separately and tell your guests.</p>
        <h2>Payments and refunds</h2>
        <p>Guests pay at the restaurant. There is no in-app payment to refund. Any restaurant cancellation fee follows the arrangement you made directly with the restaurant.</p>
        <h2>Your group chat</h2>
        <p>Cancelling a place or meal does not close the group chat. Leaving the group or dissolving it is a separate confirmed action.</p>
        <PrimaryLink secondary to="/create">Back to review</PrimaryLink>
      </div>
    </>
  );
}
