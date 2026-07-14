const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Expo's native embed command uses the pnpm workspace as its server root.
// Include that root so the Android workspace entry can be resolved by Metro.
config.watchFolders = [
  ...new Set([...config.watchFolders, path.resolve(__dirname, '../..')]),
];

module.exports = config;
