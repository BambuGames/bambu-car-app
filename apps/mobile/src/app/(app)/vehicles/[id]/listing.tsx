import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LANGUAGES, type Language } from '../../../../domain/vehicleData';
import { createListingApi, type ListingCommand, type ListingError } from '../../../../listing/api';
import { isStale } from '../../../../listing/stale';
import { supabase } from '../../../../lib/supabase';
import { useSession } from '../../../../lib/session';
import { cacheListingText, getListing, getListingTexts, type ListingText } from '../../../../local/listings';
import { getVehicle } from '../../../../local/vehicles';
import { useSync } from '../../../../sync/SyncProvider';
import { EditingElsewhere } from '../../../../vehicle/EditingElsewhere';
import { Button } from '../../../../ui/Button';
import { confirmAlert } from '../../../../ui/confirm';
import { Notice } from '../../../../ui/Notice';
import { Screen } from '../../../../ui/Screen';
import { Segmented } from '../../../../ui/Segmented';
import { TextField } from '../../../../ui/TextField';
import { colors, fontSize, radius, space } from '../../../../ui/theme';

const api = createListingApi(supabase);
const LANGUAGE_NAMES: Record<Language, string> = { de: 'Deutsch', tr: 'Türkçe', en: 'English' };
const REWRITES: Exclude<ListingCommand, 'translate'>[] = ['shorten', 'more_professional', 'highlight_equipment', 'simplify'];
type Texts = Partial<Record<Language, ListingText>>;
type Loaded = { texts: Texts; vehicleFactsAt: string; listingFactsAt: string | null };

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db } = useSession();
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!db || !id) return;
    let active = true;
    Promise.all([getVehicle(db, id), getListing(db, id), getListingTexts(db, id)]).then(([vehicle, listing, list]) => {
      if (active && vehicle) setLoaded({ texts: Object.fromEntries(list.map((x) => [x.language, x])), vehicleFactsAt: vehicle.factsUpdatedAt, listingFactsAt: listing?.factsUpdatedAt ?? null });
    });
    return () => {
      active = false;
    };
  }, [db, id]);

  return loaded && id ? <Editor vehicleId={id} initial={loaded} /> : null;
}

function Editor({ vehicleId, initial }: { vehicleId: string; initial: Loaded }) {
  const { t } = useTranslation();
  const { db } = useSession();
  const { flush, online } = useSync();
  const [texts, setTexts] = useState(initial.texts);
  const [language, setLanguage] = useState<Language>('de');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ListingError | 'saveFailed' | null>(null);
  const [copied, setCopied] = useState(false);

  // Latest texts, written only in handlers; manual edits are saved when a field loses focus, one write after
  // another on a chain (a generation waits for it), so overlapping saves cannot overwrite each other.
  const latest = useRef(initial.texts);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const dirty = useRef(new Set<Language>());
  const put = (text: ListingText) => {
    latest.current = { ...latest.current, [text.language]: text };
    setTexts(latest.current);
    setCopied(false);
  };
  const persist = (lang: Language, edited: boolean) => {
    chain.current = chain.current
      .then(async () => {
        const text = latest.current[lang];
        if (!db || !text) return;
        await api.saveText(vehicleId, lang, { title: text.title, description: text.description }, edited);
        await cacheListingText(db, { ...text, edited });
      })
      .catch(() => setError('saveFailed'));
  };
  const edit = (patch: { title?: string; description?: string }) => {
    const text = latest.current[language];
    if (!text) return;
    dirty.current.add(language);
    put({ ...text, ...patch, edited: true });
  };
  // Queues the write of every language with unsaved typing. Called on blur, before any server call (a tap on a
  // button does not blur the field) and when the screen is left.
  const flushDirty = () => {
    for (const lang of dirty.current) persist(lang, true);
    dirty.current.clear();
  };
  const blur = () => {
    if (dirty.current.size === 0) return;
    setError(null);
    flushDirty();
  };
  // Leaving the screen saves the last edit: the cleanup calls the latest flushDirty (a ref written in an effect).
  const leave = useRef(flushDirty);
  useEffect(() => {
    leave.current = flushDirty;
  });
  useEffect(() => () => leave.current(), []);
  const pickTitle = (title: string) => {
    const text = latest.current[language];
    if (!online || !text || text.title === title) return;
    setError(null);
    put({ ...text, title });
    persist(language, text.edited);
  };

  const run = async (target: Language, command?: ListingCommand, fromLanguage?: Language) => {
    if (!db || busy) return;
    flushDirty(); // commands rework the stored text, so it must hold what the user typed
    const existing = latest.current[target];
    if (existing?.edited && (!command || command === 'translate')) {
      const ok = await confirmAlert(t('listing.overwrite.title'), t('listing.overwrite.body'), t('listing.overwrite.confirm'), t('listing.overwrite.cancel'), true);
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      await chain.current;
      // The function reads the server's data: send what waits on the phone first (spec 8).
      if (!(await flush([{ kind: 'vehicle', id: vehicleId }, { kind: 'listing', id: vehicleId }]))) return setError('offline');
      const result = await api.generate({ vehicleId, language: target, command, fromLanguage });
      if ('error' in result) return setError(result.error);
      await cacheListingText(db, result);
      dirty.current.delete(target);
      put(result);
      setLanguage(target);
    } catch {
      setError('internal');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    const text = latest.current[language];
    if (!text) return;
    await Clipboard.setStringAsync(`${text.title}\n\n${text.description}`);
    setCopied(true);
  };

  const text = texts[language];
  const stale = text ? isStale(text, initial.vehicleFactsAt, initial.listingFactsAt) : false;
  const others = LANGUAGES.filter((l) => l !== language);

  return (
    <Screen>
      <Stack.Screen options={{ title: t('listing.title') }} />
      <EditingElsewhere vehicleId={vehicleId} />
      <Segmented
        label={t('listing.language')}
        options={LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_NAMES[l] }))}
        value={language}
        onChange={setLanguage}
      />
      {!online ? <Notice text={t('listing.offline')} /> : null}
      {error ? <Notice kind="error" text={t(`listing.errors.${error}`)} /> : null}
      {busy ? <Notice text={t('listing.working')} /> : null}

      {!text ? (
        <>
          <Text style={styles.hint}>{t('listing.empty')}</Text>
          <Button label={t('listing.create')} onPress={() => run(language)} disabled={!online || busy} loading={busy} />
        </>
      ) : (
        <>
          {stale ? <Notice text={t('listing.stale')} /> : null}
          <Button label={t('listing.recreate')} onPress={() => run(language)} variant={stale ? 'primary' : 'secondary'} disabled={!online || busy} />

          <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={t('listing.titles')}>
            <Text style={styles.label}>{t('listing.titles')}</Text>
            {text.titles.map((title) => {
              const on = title === text.title;
              return (
                <Pressable
                  key={title}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on, disabled: !online }}
                  disabled={!online}
                  onPress={() => pickTitle(title)}
                  style={[styles.option, on && styles.optionOn]}
                >
                  <Text style={[styles.optionText, on && styles.optionTextOn]}>{title}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* ponytail: read-only offline, because the next sync would replace an unsent edit with the server's text. */}
          <TextField label={t('listing.titleField')} value={text.title} onChangeText={(title) => edit({ title })} onBlur={blur} editable={online} multiline />
          <TextField label={t('listing.descriptionField')} value={text.description} onChangeText={(description) => edit({ description })} onBlur={blur} editable={online} multiline />
          <Button label={copied ? t('listing.copied') : t('listing.copy')} onPress={copy} />

          <View>
            {REWRITES.map((command) => (
              <Action key={command} label={t(`listing.commands.${command}`)} disabled={!online || busy} onPress={() => run(language, command)} />
            ))}
            {others.map((target) => (
              <Action
                key={target}
                label={t('listing.commands.translate', { language: LANGUAGE_NAMES[target] })}
                disabled={!online || busy}
                onPress={() => run(target, 'translate', language)}
              />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

function Action({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.action, (pressed || disabled) && styles.dimmed]}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: fontSize.small, color: colors.textMuted },
  label: { fontSize: fontSize.small, fontWeight: '500', color: colors.text },
  group: { gap: space[1] },
  option: { justifyContent: 'center', minHeight: 48, paddingVertical: space[1], paddingHorizontal: space[2], borderWidth: 1, borderColor: colors.border, borderRadius: radius },
  optionOn: { borderColor: colors.accent, borderWidth: 2 },
  optionText: { fontSize: fontSize.body, color: colors.text },
  optionTextOn: { color: colors.accent, fontWeight: '600' },
  action: { justifyContent: 'center', minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  actionText: { fontSize: fontSize.body, color: colors.text },
  dimmed: { opacity: 0.5 },
});
