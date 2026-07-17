const fs = require('fs');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Keep React as a singleton when Android is built from a partially hoisted
// pnpm install. Otherwise Metro can bundle both the hoisted and isolated
// copies, disconnecting hooks from the native renderer.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    return {
      filePath: require.resolve(moduleName, { paths: [__dirname] }),
      type: 'sourceFile',
    };
  }

  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

// Expo's native embed command uses the pnpm workspace as its server root.
// Include that root so the Android workspace entry can be resolved by Metro.
// Also include pnpm's real virtual store: junctioned packages can otherwise
// resolve in Node while Metro rejects them for living outside its watch roots.
const expoRouterRoot = path.dirname(
  fs.realpathSync(require.resolve('expo-router/package.json')),
);
const pnpmVirtualStore = path.resolve(expoRouterRoot, '../../..');
config.watchFolders = [
  ...new Set([
    ...config.watchFolders,
    path.resolve(__dirname, '../..'),
    pnpmVirtualStore,
  ]),
];

module.exports = config;
