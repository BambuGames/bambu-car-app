import type { SkPath } from '@shopify/react-native-skia';

import type { DamageMap, DamagePart, DamageState } from '../domain/vehicleData';

type Marked = Exclude<DamageState, 'original'>;

export function setPartState(map: DamageMap, part: DamagePart, state: DamageState): DamageMap {
  const { [part]: _removed, ...rest } = map;
  return state === 'original' ? rest : { ...rest, [part]: state };
}

export function damageSummary(map: DamageMap): Record<Marked, DamagePart[]> {
  const out: Record<Marked, DamagePart[]> = { painted: [], partly_painted: [], replaced: [], damaged: [] };
  for (const [part, state] of Object.entries(map) as [DamagePart, Marked][]) out[state].push(part);
  return out;
}

// Needs Skia paths, so it is checked on the simulator, not in jest. Last part wins where drawings overlap.
export function partAt(parts: { id: DamagePart; path: SkPath }[], x: number, y: number): DamagePart | null {
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].path.contains(x, y)) return parts[i].id;
  return null;
}
