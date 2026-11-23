// Zulassungsbescheinigung Teil I field codes for the vehicle facts the app holds (spec §7.3; FZV Anlage 6).
// Only fields printed on the certificate get a code; `variant` is a sales name, not D.2 (type approval).
export const FIELD_CODES: Readonly<Record<string, string>> = {
  firstRegistration: 'B',
  make: 'D.1',
  model: 'D.3',
  vin: 'E',
  displacementCcm: 'P.1',
  powerKw: 'P.2',
  fuel: 'P.3',
  colorExterior: 'R',
};

export const codeFor = (field: string): string | null => FIELD_CODES[field] ?? null;
