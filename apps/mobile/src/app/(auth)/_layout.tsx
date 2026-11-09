import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { colors } from '../../ui/theme';

export const unstable_settings = { anchor: 'sign-in' };

export default function AuthLayout() {
  const { t } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerBackTitle: t('auth.back'),
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="sign-in" options={{ title: t('auth.signIn.title') }} />
      <Stack.Screen name="accept-invite" options={{ title: t('auth.acceptInvite.title') }} />
      <Stack.Screen name="reset-password" options={{ title: t('auth.resetPassword.title') }} />
    </Stack>
  );
}
