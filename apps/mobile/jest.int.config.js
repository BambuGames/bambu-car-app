// Integration tests run in plain Node against the local Supabase stack. They skip jest-expo's setup,
// which replaces the global fetch with Expo's native fetch stub.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.int.test.ts'],
  transform: { '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
};
