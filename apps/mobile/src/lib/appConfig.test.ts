// Checks on app.json that only show up in a native build.
const app = require('../../app.json');
// not in the package exports, so loaded by file path
const { getAndroidSplashConfig } = require('../../node_modules/expo-splash-screen/plugin/build/getAndroidSplashConfig');

const pluginOptions = (name: string) => app.expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === name)?.[1];
const LANGUAGES = ['de', 'tr', 'en'];

// Android 12+ shows the splash image as the window icon and masks it to a circle of radius 96 dp; the wordmark
// (assets/images/splash-icon.png, 935 × 231 px) is drawn contain-fit at the configured width.
test('the Android splash wordmark fits inside the icon circle', () => {
  const { imageWidth } = getAndroidSplashConfig(pluginOptions('expo-splash-screen'));
  const height = (imageWidth * 231) / 935;
  expect(Math.hypot(imageWidth / 2, height / 2)).toBeLessThanOrEqual(96);
});

test('the app declares German, Turkish and English to both stores', () => {
  expect(pluginOptions('expo-localization')?.supportedLocales).toEqual(LANGUAGES);
  expect(Object.keys(app.expo.locales ?? {}).sort()).toEqual([...LANGUAGES].sort());
});

test('every iOS permission text exists in each language, German matching the base text', () => {
  const keys = ['NSCameraUsageDescription', 'NSPhotoLibraryUsageDescription', 'NSPhotoLibraryAddUsageDescription'];
  for (const lang of LANGUAGES) {
    const ios = require(`../../${app.expo.locales[lang]}`).ios;
    expect(Object.keys(ios).sort()).toEqual([...keys].sort());
    for (const key of keys) expect(ios[key]).toMatch(/\S/);
  }
  const de = require(`../../${app.expo.locales.de}`).ios;
  expect(de.NSCameraUsageDescription).toBe(app.expo.ios.infoPlist.NSCameraUsageDescription);
  expect(de.NSPhotoLibraryUsageDescription).toBe(pluginOptions('expo-image-picker').photosPermission);
  expect(de.NSPhotoLibraryAddUsageDescription).toBe(pluginOptions('expo-media-library').savePhotosPermission);
});
