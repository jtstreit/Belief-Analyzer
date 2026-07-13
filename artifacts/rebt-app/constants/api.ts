/**
 * The installed app always has a usable production backend. Local development
 * may override the host without changing source code.
 */
const domain = process.env.EXPO_PUBLIC_DOMAIN ?? 'belief-analyzer-api.onrender.com';

const isLocal =
  (domain.startsWith('localhost') || domain.startsWith('127.0.0.1'));

export const API_ORIGIN = `${isLocal ? 'http' : 'https'}://${domain}`;
