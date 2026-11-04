import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Primary } from './ui/Button.tsx';
import { Body } from './ui/Text.tsx';
import {LogoutNotice} from './features/auth/LogoutNotice.tsx';
import {AssistantWidget} from './features/assistant/AssistantWidget.tsx';
import { colors } from './ui/tokens.ts';
import { AnalyticsConsentSheet } from './analytics/Consent.tsx';
import { ASSISTANT_ENABLED } from './config.ts';
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
      {children}
      <AppNotices services={services} />
      {ASSISTANT_ENABLED ? <AssistantWidget /> : null}
      <AnalyticsConsentSheet manager={services.analytics}/>
    </ServicesProvider>
  );
}

/**
 * App-wide notices (sign-out not confirmed, session unavailable). Rendered only while one is
 * showing, as an overlay on top of the page: an always-mounted SafeAreaView here used to add a
 * full status-bar-height band above every screen, on top of each screen's own safe-area inset.
 */
function AppNotices({ services }: { services: Services }) {
  const state = useSessionState();
  const logoutNotice = useSyncExternalStore(services.session.subscribeLogoutNotice, services.session.getLogoutNotice, services.session.getLogoutNotice);
  if (!logoutNotice && state.status !== 'unavailable') return null;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} testID="app-notices" style={styles.notices}>
      <LogoutNotice session={services.session}/>
      <SessionBanner services={services} />
    </SafeAreaView>
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
  notices: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, backgroundColor: colors.white, shadowColor: colors.ink, shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  banner: { padding: 12, gap: 8, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
