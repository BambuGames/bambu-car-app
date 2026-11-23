import type { Fuel, VehicleData } from '../domain/vehicleData';
import { codeFor } from './fieldCodes';

// A vehicle's headline facts as code + display value (spec §8.1, §12.2). "km" is a unit label, not a document code.
export type FactItem = { code: string; value: string | null };

const month = (date: string | null) => {
  const m = date?.match(/^(\d{4})-(\d{2})/);
  return m ? `${m[2]}/${m[1]}` : null;
};

function core(d: VehicleData, locale: string) {
  return {
    reg: { code: codeFor('firstRegistration')!, value: month(d.firstRegistration) },
    power: { code: codeFor('powerKw')!, value: d.powerKw != null ? `${d.powerKw} kW` : null },
    km: { code: 'km', value: d.mileageKm != null ? new Intl.NumberFormat(locale).format(d.mileageKm) : null },
  };
}

/** The list row: always B, P.2, km in the same places; unknown values stay null and show as "—". */
export function listFacts(d: VehicleData, locale: string): FactItem[] {
  const { reg, power, km } = core(d, locale);
  return [reg, power, km];
}

/** The vehicle page: always B, P.2, P.3, km; unknown values stay null and show as "—". */
export function pageFacts(d: VehicleData, locale: string, fuelLabel: (f: Fuel) => string): FactItem[] {
  const { reg, power, km } = core(d, locale);
  return [reg, power, { code: codeFor('fuel')!, value: d.fuel ? fuelLabel(d.fuel) : null }, km];
}

const LOCALES: Record<string, string> = { de: 'de-DE', tr: 'tr-TR', en: 'en-GB' };
/** The number/date locale for the app's language (same map as the poster). */
export const localeFor = (language: string): string => LOCALES[language] ?? 'de-DE';
