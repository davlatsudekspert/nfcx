const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['node_modules/**', 'android/**', 'ios/**', 'dist/**'],
  },
  {
    // One-off Node-context tooling (asset generation, Expo config
    // plugins) — not part of the React Native app bundle, so RN/browser
    // globals don't apply and dev-only tool deps (e.g. `sharp`) are
    // intentionally not listed in package.json.
    files: ['scripts/**', 'plugins/**'],
    languageOptions: { globals: { Buffer: 'readonly', require: 'readonly', module: 'readonly', process: 'readonly', console: 'readonly' } },
    rules: { 'import/no-unresolved': 'off' },
  },
  {
    files: ['**/__tests__/**', '**/__mocks__/**', '**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: { jest: 'readonly', describe: 'readonly', it: 'readonly', expect: 'readonly', beforeEach: 'readonly', afterEach: 'readonly' },
    },
  },
  {
    rules: {
      // react-native-reanimated's SharedValue.value assignment (the standard,
      // correct way to drive a worklet-backed animation from a JS-thread
      // event handler) is a known false positive for the React Compiler
      // eslint plugin's immutability check — it doesn't recognize
      // Reanimated's intentionally-mutable `.value` accessor. This is not a
      // real bug in this codebase; every PremiumButton/Badge/Tab/Skeleton
      // animation depends on this exact pattern.
      'react-hooks/immutability': 'off',
      // Stylistic preference, not a correctness issue — Array<T> reads more
      // consistently with this codebase's other generic-heavy API types.
      '@typescript-eslint/array-type': 'off',
      // A web-JSX/HTML rule (raw `'`/`"` inside <Text> aren't HTML entities
      // on native) that would otherwise fire on nearly every Uzbek string
      // in this app (o'zbek tilida apostrof juda tez-tez ishlatiladi).
      'react/no-unescaped-entities': 'off',
    },
  },
];
