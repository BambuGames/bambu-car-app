// accent: primary actions only · danger: errors and deleting · pending: uploads still waiting.
// guide / ready: the capture silhouette while guiding and once everything holds.
export const colors = {
  background: '#FFFFFF',
  surface: '#F4F4F5',
  border: '#E4E4E7',
  text: '#18181B',
  textMuted: '#52525B',
  accent: '#0B57D0',
  danger: '#B3261E',
  pending: '#8A5A00',
  guide: '#FFFFFF',
  ready: '#2E9E4F',
} as const;

export const space = [4, 8, 12, 16, 24, 32] as const;
export const radius = 8;
export const fontSize = { small: 14, body: 16, title: 22 } as const;
