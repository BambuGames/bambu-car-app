// Integration tests run in plain Node against the local Supabase stack. They skip jest-expo's setup,
// which replaces the global fetch with Expo's native fetch stub.
module.exports = {
  testEnvironment: 'node',
  maxWorkers: 1, // the listing and report suites both run a fake Claude on port 8091
  testMatch: ['**/*.int.test.ts'],
  transform: { '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
};
