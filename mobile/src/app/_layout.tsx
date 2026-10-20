import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { SessionProvider, useSession } from '@/auth/session';
import { Loading } from '@/components/ui';
import { colors } from '@/theme';
import { ConversationProvider } from '@/voice/conversation';

function RootNavigator() {
  const { status } = useSession();
  if (status === 'loading') return <Loading />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={status === 'needsLanguage'}>
        <Stack.Screen name="welcome" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedIn'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="assistant" />
        <Stack.Screen name="diagnose" />
        <Stack.Screen name="weather" />
        <Stack.Screen name="market" />
        <Stack.Screen name="crop-advice" />
        <Stack.Screen name="schemes" />
        <Stack.Screen name="calendar" />
        <Stack.Screen name="profit" />
        <Stack.Screen name="yield" />
        <Stack.Screen name="soil" />
        <Stack.Screen name="add-farm" />
        <Stack.Screen name="add-crop" />
        <Stack.Screen name="alerts" />
        <Stack.Screen name="support" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            // Do not hammer the server for errors a retry cannot fix.
            retry: (count, error) => count < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
          },
        },
      }),
  );
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <ConversationProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </ConversationProvider>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
