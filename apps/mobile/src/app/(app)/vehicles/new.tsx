import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BodyType } from '../../../domain/vehicle';
import { useSession } from '../../../lib/session';
import { searchMakes, searchModels, type Make, type Model } from '../../../local/catalog';
import { createVehicle } from '../../../local/vehicles';
import { useSync } from '../../../sync/SyncProvider';
import { Button } from '../../../ui/Button';
import { ChoiceList } from '../../../ui/ChoiceList';
import { Notice } from '../../../ui/Notice';
import { Screen } from '../../../ui/Screen';
import { TextField } from '../../../ui/TextField';
import { colors, fontSize, radius, space } from '../../../ui/theme';
import { codeFor } from '../../../vehicle/fieldCodes';

const BODY_TYPES: BodyType[] = ['sedan', 'hatchback', 'kombi', 'suv', 'other'];
const same = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

// Catalog matches under a field. Hidden once the text matches an entry; anything else typed is used as is.
function Suggestions({ items, value, onPick }: { items: { id: number; name: string }[]; value: string; onPick: (name: string) => void }) {
  if (!value.trim() || items.length === 0 || items.some((item) => same(item.name, value))) return null;
  return (
    <View style={styles.suggestions}>
      {items.slice(0, 5).map((item) => (
        <Pressable key={item.id} accessibilityRole="button" onPress={() => onPick(item.name)} style={styles.suggestion}>
          <Text style={styles.suggestionText}>{item.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function NewVehicle() {
  const { t } = useTranslation();
  const { db, membership } = useSession();
  const { request } = useSync();
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [bodyType, setBodyType] = useState<BodyType | null>(null);
  const [makes, setMakes] = useState<Make[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [errors, setErrors] = useState<{ make?: string; model?: string; bodyType?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const catalogMake = makes.find((m) => same(m.name, make));
  const catalogMakeId = catalogMake?.id;

  useEffect(() => {
    let active = true;
    if (db) searchMakes(db, make.trim()).then((list) => active && setMakes(list));
    return () => {
      active = false;
    };
  }, [db, make]);

  useEffect(() => {
    let active = true;
    if (db && catalogMakeId !== undefined) searchModels(db, catalogMakeId, model.trim()).then((list) => active && setModels(list));
    else setModels([]);
    return () => {
      active = false;
    };
  }, [db, catalogMakeId, model]);

  const save = async () => {
    const required = t('vehicleForm.required');
    const next = {
      make: make.trim() ? undefined : required,
      model: model.trim() ? undefined : required,
      bodyType: bodyType ? undefined : required,
    };
    setErrors(next);
    if (!db || !membership || !bodyType || next.make || next.model) return;
    setError(null);
    setBusy(true);
    try {
      const vehicle = await createVehicle(db, {
        id: randomUUID(),
        galleryId: membership.galleryId,
        make: catalogMake?.name ?? make.trim(),
        model: models.find((m) => same(m.name, model))?.name ?? model.trim(),
        bodyType,
        now: new Date().toISOString(),
      });
      request();
      router.replace(`/vehicles/${vehicle.id}`);
    } catch {
      setError(t('auth.errors.generic'));
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.field}>
        <TextField label={t('vehicleForm.make')} code={codeFor('make')} value={make} onChangeText={setMake} error={errors.make} autoCapitalize="words" />
        <Suggestions items={makes} value={make} onPick={setMake} />
      </View>
      <View style={styles.field}>
        <TextField label={t('vehicleForm.model')} code={codeFor('model')} value={model} onChangeText={setModel} error={errors.model} autoCapitalize="words" />
        <Suggestions items={models} value={model} onPick={setModel} />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>{t('vehicleForm.bodyType')}</Text>
        <ChoiceList
          label={t('vehicleForm.bodyType')}
          options={BODY_TYPES.map((type) => ({ value: type, label: t(`bodyTypes.${type}`) }))}
          value={bodyType}
          onChange={setBodyType}
        />
        {errors.bodyType ? <Text style={styles.error}>{errors.bodyType}</Text> : null}
      </View>
      {error ? <Notice kind="error" text={error} /> : null}
      <Button label={t('vehicleForm.save')} onPress={save} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { gap: space[1] },
  label: { fontSize: fontSize.small, fontWeight: '600', color: colors.ink },
  suggestions: { borderWidth: 1, borderColor: colors.rule, borderRadius: radius },
  suggestion: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space[2] },
  suggestionText: { fontSize: fontSize.body, color: colors.ink },
  error: { fontSize: fontSize.small, color: colors.mark },
});
