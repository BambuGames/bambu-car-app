// The on-device detector ships as .tflite assets (assets/models). Sentry's config adds the debug IDs that tie
// release source maps to their bundle.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);
config.resolver.assetExts.push('tflite');

module.exports = config;
