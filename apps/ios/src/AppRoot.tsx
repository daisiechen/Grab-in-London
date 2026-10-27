import { useEffect, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Primary } from './ui/Button.tsx';
import { Body } from './ui/Text.tsx';
import {LogoutNotice} from './features/auth/LogoutNotice.tsx';
import {AssistantWidget} from './features/assistant/AssistantWidget.tsx';
import { colors } from './ui/tokens.ts';
import { AnalyticsConsentSheet } from './analytics/Consent.tsx';
import { ServicesProvider, useSessionState, type Services } from './services.tsx';

/** Restores the session once and re-checks an `unavailable` session when the app returns to the foreground. */
export function AppRoot({ services, children }: { services: Services; children: ReactNode }) {
  const [started] = useState(() => services.session.restore());
  useEffect(() => {
    void started;
    services.analytics.setForeground(AppState.currentState==='active');
    const sub = AppState.addEventListener('change', (next) => {
      services.analytics.setForeground(next==='active');
      if (next === 'active' && services.session.getState().status === 'unavailable') void services.session.revalidate();
    });
    return () => {sub.remove();services.analytics.setForeground(false);};
  }, [services, started]);
  return (
    <ServicesProvider services={services}>
      <SafeAreaView edges={['top', 'left', 'right']} testID="app-notices">
        <LogoutNotice session={services.session}/>
        <SessionBanner services={services} />
      </SafeAreaView>
      {children}
      <AssistantWidget />
      <AnalyticsConsentSheet manager={services.analytics}/>
    </ServicesProvider>
  );
}

function SessionBanner({ services }: { services: Services }) {
  const state = useSessionState();
  if (state.status !== 'unavailable') return null;
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Body>You’re offline or Fancy can’t be reached. You’re browsing as a guest until we can check your sign-in.</Body>
      <Primary secondary label="Try again" onPress={() => void services.session.revalidate()} />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { padding: 12, gap: 8, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
