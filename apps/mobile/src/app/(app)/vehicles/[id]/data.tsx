import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BodyType, Vehicle } from '../../../../domain/vehicle';
import {
  DRIVES, EQUIPMENT, EXTERIOR_COLORS, FUELS, INTERIOR_COLORS, TRANSMISSIONS, UPHOLSTERIES,
  kwToPs, monthOf, validateVehicleData, type Equipment, type VehicleData,
} from '../../../../domain/vehicleData';
import { useSession } from '../../../../lib/session';
import { searchMakes, searchModels, type Make, type Model } from '../../../../local/catalog';
import { getListing, saveListing, type Listing } from '../../../../local/listings';
import { getVehicle, updateVehicle } from '../../../../local/vehicles';
import { studioApi } from '../../../../studio/useStudio';
import { useSync } from '../../../../sync/SyncProvider';
import { changeBodyType } from '../../../../vehicle/api';
import { EditingElsewhere } from '../../../../vehicle/EditingElsewhere';
import { codeFor } from '../../../../vehicle/fieldCodes';
import { SECTIONS, sectionDone, sectionProgress } from '../../../../vehicle/sections';
import { confirmAlert } from '../../../../ui/confirm';
import { ChoiceList } from '../../../../ui/ChoiceList';
import { Icon } from '../../../../ui/Icon';
import { Notice } from '../../../../ui/Notice';
import { Screen } from '../../../../ui/Screen';
import { Segmented } from '../../../../ui/Segmented';
import { SelectField } from '../../../../ui/SelectField';
import { TextField } from '../../../../ui/TextField';
import { colors, fonts, fontSize, radius, space } from '../../../../ui/theme';

const BODY_TYPES: BodyType[] = ['sedan', 'hatchback', 'kombi', 'suv', 'other'];
const same = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

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

// '' -> null, digits -> number, anything else -> undefined (not a number: show an error, save nothing).
const parseInteger = (text: string): number | null | undefined => {
  if (!text.trim()) return null;
  return /^\d{1,9}$/.test(text.trim()) ? Number(text.trim()) : undefined;
};
const monthText = (date: string | null) => (date ? `${date.slice(5, 7)}/${date.slice(0, 4)}` : '');
const parseMonth = (text: string): string | null | undefined => {
  if (!text.trim()) return null;
  const m = /^(\d{2})\/(\d{4})$/.exec(text.trim());
  return m ? monthOf(`${m[2]}-${m[1]}-01`) : undefined;
};

export default function VehicleDataScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db } = useSession();
  const [loaded, setLoaded] = useState<{ vehicle: Vehicle; listing: Listing | null } | null>(null);

  useEffect(() => {
    if (!db || !id) return;
    let active = true;
    Promise.all([getVehicle(db, id), getListing(db, id)]).then(([vehicle, listing]) => {
      if (active && vehicle) setLoaded({ vehicle, listing });
    });
    return () => {
      active = false;
    };
  }, [db, id]);

  if (!loaded) return null;
  return <Form initial={loaded} />;
}

function Form({ initial }: { initial: { vehicle: Vehicle; listing: Listing | null } }) {
  const { t } = useTranslation();
  const { db } = useSession();
  const { request, flush } = useSync();
  const [vehicle, setVehicle] = useState(initial.vehicle);
  const [listing, setListing] = useState(initial.listing);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [note, setNote] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [make, setMake] = useState(vehicle.make);
  const [model, setModel] = useState(vehicle.model);
  const [makes, setMakes] = useState<Make[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [text, setText] = useState<Record<string, string>>(() => {
    const d = initial.vehicle.data;
    const l = initial.listing;
    return {
      variant: d.variant ?? '', firstRegistration: monthText(d.firstRegistration), huUntil: monthText(d.huUntil),
      mileageKm: d.mileageKm?.toString() ?? '', powerKw: d.powerKw?.toString() ?? '', displacementCcm: d.displacementCcm?.toString() ?? '',
      previousOwners: d.previousOwners?.toString() ?? '', vin: d.vin ?? '', notes: initial.vehicle.details.notes ?? '',
      priceEur: l?.priceEur?.toString() ?? '', warrantyMonths: l?.warrantyMonths?.toString() ?? '', location: l?.location ?? '',
    };
  });
  const [equipmentQuery, setEquipmentQuery] = useState('');

  const catalogMakeId = makes.find((m) => same(m.name, make))?.id;
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

  const setError = (key: string, message: string | null) =>
    setErrors((e) => {
      const next = { ...e };
      if (message) next[key] = message;
      else delete next[key];
      return next;
    });

  // Every autosave goes through here: a failed write shows the save error until a later one succeeds.
  const saved = <T,>(write: Promise<T>, apply: (value: T) => void) =>
    write.then(
      (value) => {
        apply(value);
        setSaveFailed(false);
        request();
      },
      () => setSaveFailed(true),
    );
  const saveVehicle = (patch: Parameters<typeof updateVehicle>[2]) => {
    if (db) saved(updateVehicle(db, vehicle.id, patch, new Date().toISOString()), setVehicle);
  };
  const saveData = (patch: Partial<VehicleData>) => saveVehicle({ data: patch as VehicleData });

  // One text input bound to a vehicle-data field. `parse` returns undefined for input that is not valid yet.
  const dataField = (key: keyof VehicleData, parse: (s: string) => string | number | null | undefined, hint?: string) => {
    const onChange = (value: string) => {
      setText((s) => ({ ...s, [key]: value }));
      const parsed = parse(value);
      if (parsed === undefined || Object.keys(validateVehicleData({ [key]: parsed } as Partial<VehicleData>)).length > 0) {
        setError(key, t('vehicleData.invalid'));
        return;
      }
      setError(key, null);
      saveData({ [key]: parsed } as Partial<VehicleData>);
    };
    return (
      <TextField
        key={key}
        label={t(`vehicleData.fields.${key}`)}
        code={codeFor(key)}
        value={text[key]}
        onChangeText={onChange}
        error={errors[key]}
        placeholder={hint}
        keyboardType={hint ? 'numbers-and-punctuation' : key === 'vin' || key === 'variant' ? 'default' : 'number-pad'}
        autoCapitalize={key === 'vin' ? 'characters' : key === 'variant' ? 'words' : 'none'}
      />
    );
  };

  const select = <T extends string>(key: keyof VehicleData, list: readonly T[], listName: string) => (
    <SelectField<T>
      key={key}
      label={t(`vehicleData.fields.${key}`)}
      code={codeFor(key)}
      value={vehicle.data[key] as T | null}
      options={list.map((value) => ({ value, label: t(`vehicleData.values.${listName}.${value as string}` as never) }))}
      onChange={(value) => saveData({ [key]: value })}
      clearLabel={t('vehicleData.clear')}
      closeLabel={t('vehicleData.close')}
    />
  );

  const triState = (key: 'accidentFree' | 'serviceBook' | 'nonSmoker') => {
    const v = vehicle.data[key];
    return (
      <View key={key} style={styles.group}>
        <Text style={styles.label}>{t(`vehicleData.fields.${key}`)}</Text>
        <Segmented<'yes' | 'no' | 'unknown'>
          label={t(`vehicleData.fields.${key}`)}
          value={v === null ? 'unknown' : v ? 'yes' : 'no'}
          options={(['yes', 'no', 'unknown'] as const).map((o) => ({ value: o, label: t(`vehicleData.${o}`) }))}
          onChange={(o) => saveData({ [key]: o === 'unknown' ? null : o === 'yes' })}
        />
      </View>
    );
  };

  const saveListingPatch = (patch: Parameters<typeof saveListing>[3]) => {
    if (db) saved(saveListing(db, vehicle.id, vehicle.galleryId, patch, new Date().toISOString()), setListing);
  };
  const listingNumber = (key: 'priceEur' | 'warrantyMonths') => (
    <TextField
      key={key}
      label={t(`vehicleData.fields.${key}`)}
      value={text[key]}
      keyboardType="number-pad"
      error={errors[key]}
      onChangeText={(value) => {
        setText((s) => ({ ...s, [key]: value }));
        const n = parseInteger(value);
        if (n === undefined) return setError(key, t('vehicleData.invalid'));
        setError(key, null);
        saveListingPatch({ [key]: n });
      }}
    />
  );

  const pickMakeModel = (patch: { make?: string; model?: string }) => saveVehicle(patch);

  // The choice shows at once; whether the photos need a re-render is known only after a sync (changeBodyType).
  const onBodyType = async (bodyType: BodyType) => {
    if (bodyType === vehicle.bodyType || !db) return;
    setVehicle((v) => ({ ...v, bodyType }));
    setNote(null);
    try {
      const result = await changeBodyType(
        {
          db,
          flush,
          startProcessing: studioApi.startProcessing.bind(studioApi),
          confirm: () =>
            confirmAlert(t('vehicleData.bodyTypeRerender.title'), t('vehicleData.bodyTypeRerender.body'), t('vehicleData.bodyTypeRerender.confirm'), t('common.cancel')),
        },
        vehicle.id,
        bodyType,
        new Date().toISOString(),
      );
      request();
      setNote(
        result === 'saved' ? null
          : result === 'offline' ? t('vehicleData.offlineNote')
          : result === 'rerendered' ? t('vehicleData.rerendering')
          : t(`studio.errors.${result}`),
      );
    } catch {
      setNote(t('auth.errors.generic'));
    }
    // Then show what is stored: an autosave queued before this one may have answered with the old body type.
    getVehicle(db, vehicle.id).then((stored) => stored && setVehicle(stored), () => undefined);
  };

  const toggleEquipment = (code: Equipment) => {
    const current = vehicle.details.equipment ?? [];
    const equipment = current.includes(code) ? current.filter((c) => c !== code) : EQUIPMENT.filter((c) => c === code || current.includes(c));
    saveVehicle({ details: { equipment } });
  };

  const query = equipmentQuery.trim().toLocaleLowerCase();
  const equipmentLabel = (code: Equipment) => t(`vehicleData.values.EQUIPMENT.${code}`);
  const equipmentShown = EQUIPMENT.filter((c) => !query || equipmentLabel(c).toLocaleLowerCase().includes(query));
  const selected = vehicle.details.equipment ?? [];

  const body: Record<string, ReactNode> = {
    basics: (
      <>
        <View style={styles.group}>
          <TextField
            label={t('vehicleForm.make')}
            code={codeFor('make')}
            value={make}
            autoCapitalize="words"
            onChangeText={(v) => {
              setMake(v);
              if (v.trim()) pickMakeModel({ make: makes.find((m) => same(m.name, v))?.name ?? v.trim() });
            }}
          />
          <Suggestions items={makes} value={make} onPick={(name) => { setMake(name); pickMakeModel({ make: name }); }} />
        </View>
        <View style={styles.group}>
          <TextField
            label={t('vehicleForm.model')}
            code={codeFor('model')}
            value={model}
            autoCapitalize="words"
            onChangeText={(v) => {
              setModel(v);
              if (v.trim()) pickMakeModel({ model: models.find((m) => same(m.name, v))?.name ?? v.trim() });
            }}
          />
          <Suggestions items={models} value={model} onPick={(name) => { setModel(name); pickMakeModel({ model: name }); }} />
        </View>
        <View style={styles.group}>
          <Text style={styles.label}>{t('vehicleForm.bodyType')}</Text>
          <ChoiceList
            label={t('vehicleForm.bodyType')}
            options={BODY_TYPES.map((type) => ({ value: type, label: t(`bodyTypes.${type}`) }))}
            value={vehicle.bodyType}
            onChange={onBodyType}
          />
          {note ? <Notice text={note} /> : null}
        </View>
        {dataField('variant', (s) => s.trim() || null)}
        {dataField('firstRegistration', parseMonth, t('vehicleData.monthHint'))}
      </>
    ),
    technical: (
      <>
        {select('fuel', FUELS, 'FUELS')}
        <View style={styles.group}>
          <Text style={styles.label}>{t('vehicleData.fields.transmission')}</Text>
          <Segmented
            label={t('vehicleData.fields.transmission')}
            value={vehicle.data.transmission ?? ('' as never)}
            options={TRANSMISSIONS.map((value) => ({ value, label: t(`vehicleData.values.TRANSMISSIONS.${value}`) }))}
            onChange={(value) => saveData({ transmission: value === vehicle.data.transmission ? null : value })}
          />
        </View>
        {dataField('powerKw', parseInteger)}
        {vehicle.data.powerKw ? <Text style={styles.hint}>{t('vehicleData.ps', { ps: kwToPs(vehicle.data.powerKw) })}</Text> : null}
        {dataField('displacementCcm', parseInteger)}
        <View style={styles.group}>
          <Text style={styles.label}>{t('vehicleData.fields.drive')}</Text>
          <Segmented
            label={t('vehicleData.fields.drive')}
            value={vehicle.data.drive ?? ('' as never)}
            options={DRIVES.map((value) => ({ value, label: t(`vehicleData.values.DRIVES.${value}`) }))}
            onChange={(value) => saveData({ drive: value === vehicle.data.drive ? null : value })}
          />
        </View>
      </>
    ),
    history: (
      <>
        {dataField('mileageKm', parseInteger)}
        {dataField('previousOwners', parseInteger)}
        {dataField('huUntil', parseMonth, t('vehicleData.monthHint'))}
        {triState('accidentFree')}
        {triState('serviceBook')}
        {triState('nonSmoker')}
      </>
    ),
    colors: (
      <>
        {select('colorExterior', EXTERIOR_COLORS, 'EXTERIOR_COLORS')}
        {select('colorInterior', INTERIOR_COLORS, 'INTERIOR_COLORS')}
        {select('upholstery', UPHOLSTERIES, 'UPHOLSTERIES')}
      </>
    ),
    equipment: (
      <>
        <TextField label={t('vehicleData.searchEquipment')} value={equipmentQuery} onChangeText={setEquipmentQuery} />
        {equipmentShown.map((code) => {
          const on = selected.includes(code);
          return (
            <Pressable
              key={code}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => toggleEquipment(code)}
              style={styles.check}
            >
              <View style={[styles.box, on && styles.boxOn]}>{on ? <Icon ios="checkmark" android="check" size={14} color={colors.onAction} /> : null}</View>
              <Text style={styles.optionText}>{equipmentLabel(code)}</Text>
            </Pressable>
          );
        })}
      </>
    ),
    price: (
      <>
        {listingNumber('priceEur')}
        <View style={styles.group}>
          <Text style={styles.label}>{t('vehicleData.fields.vatDeductible')}</Text>
          <Segmented<'yes' | 'no' | 'unknown'>
            label={t('vehicleData.fields.vatDeductible')}
            value={listing?.vatDeductible == null ? 'unknown' : listing.vatDeductible ? 'yes' : 'no'}
            options={(['yes', 'no', 'unknown'] as const).map((o) => ({ value: o, label: t(`vehicleData.${o}`) }))}
            onChange={(o) => saveListingPatch({ vatDeductible: o === 'unknown' ? null : o === 'yes' })}
          />
        </View>
        {listingNumber('warrantyMonths')}
        <TextField
          label={t('vehicleData.fields.location')}
          value={text.location}
          onChangeText={(v) => {
            setText((s) => ({ ...s, location: v }));
            saveListingPatch({ location: v.trim() || null });
          }}
        />
      </>
    ),
    vinNotes: (
      <>
        {dataField('vin', (s) => (s.trim() ? s.trim().toUpperCase() : null))}
        <TextField
          label={t('vehicleData.fields.notes')}
          value={text.notes}
          multiline
          autoCorrect
          spellCheck
          style={styles.notes}
          onChangeText={(v) => {
            setText((s) => ({ ...s, notes: v }));
            saveVehicle({ details: { notes: v } });
          }}
        />
      </>
    ),
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('vehicleData.title') }} />
      <EditingElsewhere vehicleId={vehicle.id} />
      {saveFailed ? <Notice kind="error" text={t('listing.errors.saveFailed')} /> : null}
      <Text style={styles.hint}>{t('vehicleData.progress', sectionProgress(vehicle, listing))}</Text>
      {SECTIONS.map((section) => (
        <View key={section.key} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text
              style={styles.sectionTitle}
              accessibilityRole="header"
              accessibilityValue={section.key !== 'basics' && sectionDone(section, vehicle, listing) ? { text: t('vehicles.status.ready') } : undefined}
            >
              {t(`vehicleData.sections.${section.key}`)}
            </Text>
            {section.key !== 'basics' && sectionDone(section, vehicle, listing) ? (
              <Icon ios="checkmark.circle.fill" android="check_circle" size={20} color={colors.ok} />
            ) : null}
          </View>
          {body[section.key]}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Sections sit on the paper ground, separated by a rule; the fields themselves are the sheet surface.
  section: { gap: space[2], paddingTop: space[3], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rule },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontFamily: fonts.title, fontSize: fontSize.title, color: colors.ink },
  group: { gap: space[1] },
  label: { fontSize: fontSize.small, fontWeight: '600', color: colors.ink },
  hint: { fontSize: fontSize.small, color: colors.ink2 },
  suggestions: { borderWidth: 1, borderColor: colors.rule, borderRadius: radius },
  suggestion: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space[2] },
  suggestionText: { fontSize: fontSize.body, color: colors.ink },
  optionText: { flexShrink: 1, fontSize: fontSize.body, color: colors.ink },
  check: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 48 },
  box: { width: 24, height: 24, borderRadius: 4, borderWidth: 1.5, borderColor: colors.field, backgroundColor: colors.sheet, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.action, borderColor: colors.action },
  notes: { minHeight: 120, textAlignVertical: 'top', paddingTop: space[2] },
});
