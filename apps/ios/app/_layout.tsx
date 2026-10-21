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
import { colors } from '../src/ui/tokens.ts';

export default function RootLayout() {
  const [services] = useState(() =>
    createServices({
      baseUrl: apiBaseUrl(),
      store: secureCredentialStore(),
      installMarker: sandboxInstallMarker(),
      openAuthSession: (url, redirectUrl) => WebBrowser.openAuthSessionAsync(url, redirectUrl, { preferEphemeralSession: true }),
      onClearError: () => console.warn('LOCAL_SIGN_OUT_CLEANUP_FAILED'),
    }),
  );
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppRoot services={services}>
        <Stack screenOptions={{ headerTintColor: colors.forest, headerBackButtonDisplayMode: 'minimal', contentStyle: { backgroundColor: colors.white } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ title: 'Fancy', presentation: 'modal' }} />
          <Stack.Screen name="email" options={{ title: 'Sign in' }} />
          <Stack.Screen name="link-required" options={{ title: 'Sign in' }} />
          <Stack.Screen name="auth/callback" options={{ title: 'Sign in' }} />
          <Stack.Screen name="profile-setup" options={{ title: 'Your profile', headerBackVisible: false, gestureEnabled: false }} />
          <Stack.Screen name="profile-edit" options={{ title: 'Edit profile' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="profiles/[userId]" options={{ title: 'Profile' }} />
          <Stack.Screen name="meals/[mealId]/index" options={{ title: 'Meal' }} />
          <Stack.Screen name="meals/[mealId]/apply" options={{ title: 'Request to join' }} />
          <Stack.Screen name="meals/[mealId]/host" options={{ title: 'Your table' }} />
          <Stack.Screen name="create/index" options={{ title: 'Create meal' }} />
          <Stack.Screen name="create/introduce" options={{ title: 'Create meal' }} />
          <Stack.Screen name="create/costs" options={{ title: 'Create meal' }} />
          <Stack.Screen name="create/review" options={{ title: 'Create meal' }} />
          <Stack.Screen name="chat/[conversationId]" options={{ title: 'Chat' }} />
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
