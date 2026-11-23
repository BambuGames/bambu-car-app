import { Link, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { initials } from '../../lib/initials';
import { canManageGallery } from '../../lib/roles';
import { useSession } from '../../lib/session';
import { SyncProvider } from '../../sync/SyncProvider';
import { Button } from '../../ui/Button';
import { colors, fonts, fontSize, maxScale, space } from '../../ui/theme';
import { Wordmark } from '../../ui/Wordmark';

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
          headerTintColor: colors.action,
          headerStyle: { backgroundColor: colors.paper },
          headerTitleStyle: { fontFamily: fonts.title, color: colors.ink },
          contentStyle: { backgroundColor: colors.paper },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            // The screen draws its own display title: the native iOS large title disappeared after returning
            // from a pushed screen (iOS 26, react-native-screens 4.30). The bar carries the wordmark (a title
            // view, so iOS 26 gives it no glass capsule) and the account button.
            title: t('vehicles.title'),
            headerTitle: () => <Wordmark size={19} maxFontSizeMultiplier={maxScale.bar} />,
            headerRight: () => (
              <Link href="/account" asChild>
                <Pressable accessibilityRole="button" accessibilityLabel={t('account.title')} hitSlop={6} style={styles.account}>
                  <Text style={styles.accountText} maxFontSizeMultiplier={maxScale.bar}>{initials(membership.galleryName)}</Text>
                </Pressable>
              </Link>
            ),
          }}
        />
        <Stack.Screen name="vehicles/new" options={{ title: t('vehicles.new') }} />
        <Stack.Screen name="vehicles/[id]/index" options={{ title: '' }} />
        <Stack.Screen name="vehicles/[id]/capture" options={{ headerShown: false }} />
        <Stack.Screen name="vehicles/[id]/studio" options={{ title: t('studio.title') }} />
        <Stack.Screen name="vehicles/[id]/photo/[photoId]" options={{ title: '' }} />
        <Stack.Screen name="vehicles/[id]/plates" options={{ title: '' }} />
        <Stack.Screen name="vehicles/[id]/touch-up" options={{ title: '' }} />
        <Stack.Screen name="vehicles/[id]/data" options={{ title: t('vehicleData.title') }} />
        <Stack.Screen name="vehicles/[id]/damage" options={{ title: t('damage.title') }} />
        <Stack.Screen name="vehicles/[id]/listing" options={{ title: t('listing.title') }} />
        <Stack.Screen name="vehicles/[id]/report" options={{ title: t('report.title') }} />
        <Stack.Screen name="vehicles/[id]/share" options={{ title: t('share.title') }} />
        <Stack.Screen name="vehicles/[id]/export" options={{ title: t('export.title') }} />
        <Stack.Screen name="account" options={{ title: t('account.title') }} />
        {/* The owner's screens (design 9); staff who open one by address land on the account screen. */}
        <Stack.Protected guard={canManageGallery(membership)} redirectTo="/account">
          <Stack.Screen name="credits" options={{ title: t('credits.title') }} />
          <Stack.Screen name="gallery/settings" options={{ title: t('gallerySettings.title') }} />
          <Stack.Screen name="gallery/members" options={{ title: t('members.title') }} />
        </Stack.Protected>
        <Stack.Screen name="licenses" options={{ title: t('licenses.title') }} />
      </Stack>
    </SyncProvider>
  );
}

const styles = StyleSheet.create({
  noGallery: { flex: 1, justifyContent: 'center', padding: space[4], gap: space[3], backgroundColor: colors.paper },
  title: { fontFamily: fonts.title, fontSize: fontSize.title, color: colors.ink },
  body: { fontSize: fontSize.body, lineHeight: 22, color: colors.ink },
  // 36 pt circle; hitSlop takes the target to 48. iOS 26 draws its own glass circle around bar items.
  account: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'ios' ? null : { backgroundColor: colors.sheet, borderWidth: 1, borderColor: colors.rule }),
  },
  accountText: { fontFamily: fonts.title, fontSize: 13, color: colors.ink2 },
});
