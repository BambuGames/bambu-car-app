// photocar.ai, Zulassung world (docs/superpowers/specs/2026-11-23-photocar-ui-design.md §7).
// paper/sheet: the registration certificate's sage security paper · ink/ink2: its print · rule: decorative
// hairlines only · field: input and select edges (3:1) · action: the one colour for every live state ·
// mark: "your work is here" only (next missing shot, plate check, error, delete), always with text or icon ·
// ok / wait: done and waiting · guide / ready: the capture silhouette while guiding and once everything holds.
export const colors = {
  paper: '#E8EDE9',
  sheet: '#F4F7F5',
  ink: '#12291F',
  ink2: '#4A5D55',
  rule: '#C5D0CA',
  field: '#788A83',
  action: '#173F33',
  onAction: '#EEF3EF',
  mark: '#A8232B',
  ok: '#1E6A45',
  wait: '#855400',
  guide: '#FFFFFF',
  ready: '#2E9E4F',
} as const;

// Brand faces for titles, field codes and values; body, buttons and form values stay on the system face.
// Names are the families expo-font registers in app/_layout.tsx.
// Upper limits for system text scaling where unbounded growth breaks the layout: brand-face titles (display and
// row titles) break words mid-name past this, and nav bar content has a fixed bar height (UIKit bar titles do
// not scale either).
export const maxScale = { display: 1.6, bar: 1.5 };

export const fonts = {
  display: 'BarlowSemiCondensed_700Bold',
  title: 'BarlowSemiCondensed_600SemiBold',
  code: 'OverpassMono_600SemiBold',
  value: 'OverpassMono_500Medium',
} as const;

export const space = [4, 8, 12, 16, 24, 32] as const;
export const radius = 12;
export const radiusPhoto = 8;
export const radiusChip = 3;
export const fontSize = { small: 14, body: 16, title: 20, display: 34 } as const;

// Damage map fills: only the state, nothing decorative.
export const damageColors = {
  original: '#D3DCD7',
  painted: '#2F6FA8',
  partly_painted: '#E0A100',
  replaced: '#7A55B8',
  damaged: '#B3261E',
} as const;
