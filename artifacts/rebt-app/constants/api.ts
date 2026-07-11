/**
 * API origin for the app. Replit domains are always https; local dev servers
 * (localhost / 127.0.0.1) have no TLS, so pick the scheme by host.
 */
const domain = process.env.EXPO_PUBLIC_DOMAIN;

const isLocal =
  typeof domain === 'string' &&
  (domain.startsWith('localhost') || domain.startsWith('127.0.0.1'));

export const API_ORIGIN = `${isLocal ? 'http' : 'https'}://${domain}`;
