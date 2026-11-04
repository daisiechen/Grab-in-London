import { Text } from 'react-native';
import { AccountPage, accountText } from '../../ui/AccountPage.tsx';

/**
 * Cancellation terms (demo “terms” page, pay-at-venue wording). PRD r07 §0.2–0.3: minimum check at the
 * deadline, host cancels before start, no platform payment or refund, chat stays open.
 */
export function CancellationTermsScreen() {
  return (
    <AccountPage testID="cancellation-terms">
      {/* The navigation bar already says “Cancellation terms”; the page starts with its first section. */}
      <Text accessibilityRole="header" style={[accountText.h2, { marginTop: 4 }]}>Your place</Text>
      <Text style={accountText.prose}>You can withdraw an application or cancel your place before the meal starts. Let your host know as early as possible.</Text>
      <Text style={[accountText.prose, { marginTop: 8 }]}>If the group falls below its minimum after applications close, the meal is cancelled. Before the deadline, the host can keep recruiting.</Text>
      <Text accessibilityRole="header" style={accountText.h2}>Hosting a meal</Text>
      <Text style={accountText.prose}>Hosts can cancel the whole meal before it starts. Cancel your restaurant booking yourself and tell your guests.</Text>
      <Text accessibilityRole="header" style={accountText.h2}>Paying</Text>
      <Text style={accountText.prose}>Everyone pays their own share at the restaurant. There is no in-app payment, so nothing to refund. Any restaurant cancellation fee follows the arrangement the host made with the restaurant.</Text>
      <Text accessibilityRole="header" style={accountText.h2}>Your group chat</Text>
      <Text style={accountText.prose}>Cancelling a place or a meal doesn’t close the group chat. Leaving the group or closing it is a separate, confirmed action.</Text>
    </AccountPage>
  );
}
