module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
    // Resolve from the app package explicitly. A hoisted pnpm layout can keep
    // babel-preset-expo from auto-detecting this optional native transform.
    plugins: [require('react-native-worklets/plugin')],
  };
};
