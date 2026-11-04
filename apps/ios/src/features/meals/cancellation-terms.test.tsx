import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CancellationTermsScreen } from './CancellationTermsScreen.tsx';

describe('CancellationTermsScreen', () => {
  it('states the r07 rules: pay at the restaurant, nothing to refund, host cancels the booking, chat stays', async () => {
    await render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 402, height: 874 }, insets: { top: 62, left: 0, right: 0, bottom: 34 } }}><CancellationTermsScreen /></SafeAreaProvider>);
    expect(screen.queryByRole('header', { name: 'Cancellation terms' })).toBeNull();
    for (const h of ['Your place', 'Hosting a meal', 'Paying', 'Your group chat']) expect(screen.getByRole('header', { name: h })).toBeOnTheScreen();
    expect(screen.getByText(/no in-app payment, so nothing to refund/)).toBeOnTheScreen();
    expect(screen.getByText(/falls below its minimum after applications close/)).toBeOnTheScreen();
    expect(screen.queryByText(/deposit|refund is available|24 hours/i)).toBeNull();
  });
});
