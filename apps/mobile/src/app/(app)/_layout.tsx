import { Link, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { useSession } from '../../lib/session';
import { SyncProvider } from '../../sync/SyncProvider';
import { Button } from '../../ui/Button';
import { colors, fontSize, space } from '../../ui/theme';

// Signed in without a gallery to show: nobody has attached the account to one yet, or (unknown) the
// server could not be asked and this device has never had its answer.
function NoGallery({ unknown }: { unknown: boolean }) {
  const { t } = useTranslation();
  const { signOut, retryMembership } = useSession();
  return (
    <View style={styles.noGallery}>
      {unknown ? (
        <>
          <Text style={styles.body}>{t('common.offline')}</Text>
          <Button label={t('common.retry')} onPress={retryMembership} />
        </>
      ) : (
        <>
          <Text style={styles.title}>{t('noGallery.title')}</Text>
          <Text style={styles.body}>{t('noGallery.body')}</Text>
        </>
      )}
      <Button variant="secondary" label={t('account.signOut')} onPress={signOut} />
    </View>
  );
}

export default function AppLayout() {
  const { t } = useTranslation();
  const { db, membership } = useSession();
  if (membership === undefined) return <NoGallery unknown />;
  if (!membership) return <NoGallery unknown={false} />;
  if (!db) return null;
  return (
    <SyncProvider db={db} galleryId={membership.galleryId}>
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerBackTitle: t('auth.back'),
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: t('vehicles.title'),
            headerRight: () => (
              <Link href="/account" style={styles.headerLink}>
                {t('account.title')}
              </Link>
            ),
          }}
        />
        <Stack.Screen name="vehicles/new" options={{ title: t('vehicles.new') }} />
        <Stack.Screen name="vehicles/[id]/index" options={{ title: '' }} />
        <Stack.Screen name="vehicles/[id]/capture" options={{ headerShown: false }} />
        <Stack.Screen name="account" options={{ title: t('account.title') }} />
        <Stack.Screen name="licenses" options={{ title: t('licenses.title') }} />
      </Stack>
    </SyncProvider>
  );
}

const styles = StyleSheet.create({
  noGallery: { flex: 1, justifyContent: 'center', padding: space[4], gap: space[3], backgroundColor: colors.background },
  title: { fontSize: fontSize.title, fontWeight: '600', color: colors.text },
  body: { fontSize: fontSize.body, lineHeight: 22, color: colors.text },
  headerLink: { fontSize: fontSize.body, color: colors.text },
});
