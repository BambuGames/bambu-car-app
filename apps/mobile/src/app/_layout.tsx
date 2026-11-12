import '../lib/i18n';

import { Stack } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';

import { SessionProvider, useSession } from '../lib/session';
import { colors } from '../ui/theme';

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

export default function RootLayout() {
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
