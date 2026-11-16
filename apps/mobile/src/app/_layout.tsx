import '../lib/i18n';

import * as Sentry from '@sentry/react-native';
import { Stack } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';

import { SessionProvider, useSession } from '../lib/session';
import { telemetryOptions } from '../lib/telemetry';
import { colors } from '../ui/theme';

// Off in development and without a DSN (local builds); store builds get the DSN from EAS.
Sentry.init(telemetryOptions(process.env.EXPO_PUBLIC_SENTRY_DSN, __DEV__));

function RootStack() {
  const { status } = useSession();
  if (status === 'loading') return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={status === 'signedIn'} redirectTo="/sign-in">
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedOut'} redirectTo="/">
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

function RootLayout() {
  // The app is portrait; the capture screen switches to landscape while it is open.
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <RootStack />
    </SessionProvider>
  );
}

export default Sentry.wrap(RootLayout);
