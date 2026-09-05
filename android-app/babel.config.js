module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Strips console.* calls from release/production bundles only — debug
      // logs must never ship in the release APK (brief §17 "sensitive logs
      // release buildda disabled").
      process.env.NODE_ENV === 'production' ? ['transform-remove-console', { exclude: ['error', 'warn'] }] : null,
      // react-native-reanimated v4 moved its babel plugin to the separate
      // react-native-worklets package. MUST be listed last.
      'react-native-worklets/plugin',
    ].filter(Boolean),
  };
};
