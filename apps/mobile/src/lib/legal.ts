// Privacy policy and imprint, hosted by Bambu Games. The addresses come from the build (EAS env); a local build
// without them shows no links.
import * as WebBrowser from 'expo-web-browser';

export type LegalLink = { key: 'privacy' | 'imprint'; url: string };

// Expo inlines EXPO_PUBLIC_ variables when it compiles, so they are read here, as the default, and tests pass
// their own.
export function legalLinks(
  env: { privacy?: string; imprint?: string } = {
    privacy: process.env.EXPO_PUBLIC_PRIVACY_URL,
    imprint: process.env.EXPO_PUBLIC_IMPRINT_URL,
  },
): LegalLink[] {
  const links: LegalLink[] = [
    { key: 'privacy', url: env.privacy ?? '' },
    { key: 'imprint', url: env.imprint ?? '' },
  ];
  return links.filter((l) => l.url);
}

export function openLegal(url: string): void {
  WebBrowser.openBrowserAsync(url).catch(() => {});
}
