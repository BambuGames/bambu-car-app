// Android 12+ shows the splash image as the window icon and masks it to a circle of radius 96 dp; the wordmark
// (assets/images/splash-icon.png, 935 × 231 px) is drawn contain-fit at the configured width.
const app = require('../../app.json');
const { getAndroidSplashConfig } = require('../../node_modules/expo-splash-screen/plugin/build/getAndroidSplashConfig') // not in the package exports;

test('the Android splash wordmark fits inside the icon circle', () => {
  const plugin = app.expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen')[1];
  const { imageWidth } = getAndroidSplashConfig(plugin);
  const height = (imageWidth * 231) / 935;
  expect(Math.hypot(imageWidth / 2, height / 2)).toBeLessThanOrEqual(96);
});
