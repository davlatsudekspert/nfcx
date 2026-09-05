const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['node_modules/**', 'android/**', 'ios/**', 'dist/**'],
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
    },
  },
];
