import '../lib/i18n';

import { BarlowSemiCondensed_600SemiBold, BarlowSemiCondensed_700Bold } from '@expo-google-fonts/barlow-semi-condensed';
import { OverpassMono_500Medium, OverpassMono_600SemiBold } from '@expo-google-fonts/overpass-mono';
import * as Sentry from '@sentry/react-native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SessionProvider, useSession } from '../lib/session';
import { telemetryOptions } from '../lib/telemetry';
import { colors } from '../ui/theme';

// Off in development and without a DSN (local builds); store builds get the DSN from EAS.
Sentry.init(telemetryOptions(process.env.EXPO_PUBLIC_SENTRY_DSN, __DEV__));

// The splash stays until the brand faces are in (they ship in the bundle, no network). If loading fails the
// app opens with the system face rather than waiting.
SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { status } = useSession();
  if (status === 'loading') return <View style={{ flex: 1, backgroundColor: colors.paper }} />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
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
  const [fontsLoaded, fontError] = useFonts({
    BarlowSemiCondensed_600SemiBold,
    BarlowSemiCondensed_700Bold,
    OverpassMono_500Medium,
    OverpassMono_600SemiBold,
  });
  const fontsSettled = fontsLoaded || !!fontError;
  // The app is portrait; the capture screen switches to landscape while it is open.
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);
  useEffect(() => {
    if (fontsSettled) SplashScreen.hideAsync();
  }, [fontsSettled]);
  if (!fontsSettled) return null;
  return (
    // The editors' pinch and pan (studio/useViewportGestures) need the gesture root.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SessionProvider>
        <StatusBar style="dark" />
        <RootStack />
      </SessionProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
