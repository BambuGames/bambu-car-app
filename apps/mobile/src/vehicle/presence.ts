// Who else has this vehicle open: names of the other devices in a presence state, once each.
export type PresenceState = Record<string, { device: string; name: string }[]>;

export function othersEditing(state: PresenceState, myDevice: string): string[] {
  const names = Object.values(state).flat().filter((p) => p.device !== myDevice).map((p) => p.name);
  return [...new Set(names)];
}
