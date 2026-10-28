import '../src/platform/install.ts';
import { useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppRoot } from '../src/AppRoot.tsx';
import { apiBaseUrl } from '../src/config.ts';
import { sandboxInstallMarker } from '../src/platform/install-marker.ts';
import { secureCredentialStore } from '../src/features/auth/credential-store.ts';
import { createServices } from '../src/services.tsx';
import { isPreviewMode, memoryCredentialStore, memoryStore } from '../src/platform/preview-mode.ts';
import { createPreviewBackend } from '../src/preview/fake-api.ts';
import { colors } from '../src/ui/tokens.ts';
import { FONT_FAMILY } from '../src/ui/styles.ts';

export default function RootLayout() {
  const [services] = useState(() => {
    const preview = isPreviewMode();
    const backend = preview ? createPreviewBackend() : null;
    return createServices({
      // Preview never touches the Keychain: expo-secure-store has no web implementation.
      ...(backend ? { fetch: backend.fetch, now: backend.now, deletionReceiptStore: memoryStore(), guestStore: memoryStore(), aiConversationStore: memoryStore() } : {}),
      baseUrl: apiBaseUrl(),
      store: preview ? memoryCredentialStore() : secureCredentialStore(),
      installMarker: preview ? null : sandboxInstallMarker(),
      openAuthSession: (url, redirectUrl) => WebBrowser.openAuthSessionAsync(url, redirectUrl, { preferEphemeralSession: true }),
      onClearError: () => console.warn('LOCAL_SIGN_OUT_CLEANUP_FAILED'),
    });
  });
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppRoot services={services}>
        <Stack screenOptions={{ headerTintColor: colors.ink, headerTitleAlign: 'center', headerTitleStyle: { fontFamily: FONT_FAMILY, fontSize: 13, fontWeight: '700', color: colors.ink }, headerBackButtonDisplayMode: 'minimal', headerShadowVisible: true, contentStyle: { backgroundColor: colors.white } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ title: 'Fancy', presentation: 'modal' }} />
          <Stack.Screen name="email" options={{ title: 'Sign in' }} />
          <Stack.Screen name="link-required" options={{ title: 'Sign in' }} />
          <Stack.Screen name="auth/callback" options={{ title: 'Sign in' }} />
          <Stack.Screen name="profile-setup" options={{ title: 'Your profile', headerBackVisible: false, gestureEnabled: false }} />
          <Stack.Screen name="profile-edit" options={{ title: 'Edit profile' }} />
          <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="profiles/[userId]" options={{ title: 'Meet your table', headerShown: false }} />
          <Stack.Screen name="meals/[mealId]/index" options={{ title: 'The table', headerShown: false }} />
          <Stack.Screen name="meals/[mealId]/apply" options={{ title: 'Request a seat' }} />
          <Stack.Screen name="meals/[mealId]/host" options={{ title: 'Your guest list' }} />
          <Stack.Screen name="create/index" options={{ title: 'Create a meal' }} />
          <Stack.Screen name="create/introduce" options={{ title: 'Create a meal' }} />
          <Stack.Screen name="create/costs" options={{ title: 'Create a meal' }} />
          <Stack.Screen name="create/review" options={{ title: 'Create a meal' }} />
          <Stack.Screen name="chat/[conversationId]" options={{ title: 'Chat', headerShown: false }} />
          <Stack.Screen name="post-meal/[mealId]" options={{ title: 'After the meal' }} />
          <Stack.Screen name="survey" options={{ title: 'Product survey' }} />
          <Stack.Screen name="report" options={{ title: 'Report', presentation: 'modal' }} />
          <Stack.Screen name="delete-account" options={{ title: 'Delete account' }} />
          <Stack.Screen name="deletion-status" options={{ title: 'Deletion status' }} />
        </Stack>
      </AppRoot>
    </SafeAreaProvider>
  );
}
