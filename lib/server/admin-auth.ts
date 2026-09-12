import { optionalEnv } from './env';
import { readCookie, requireSameOrigin, verifyGoogleAdmin } from './google-identity';

export const SESSION_COOKIE = '__Host-ksfh-session';
export const NONCE_COOKIE = '__Host-ksfh-login';

export function authConfig() {
  return {
    clientId: optionalEnv('GOOGLE_CLIENT_ID'),
    allowedEmails: optionalEnv('ADMIN_EMAILS').split(',').filter(Boolean),
  };
}

export function authCookie(name: string, value: string, maxAge: number) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export async function requireAdmin(request: Request) {
  if (!['GET', 'HEAD'].includes(request.method)) requireSameOrigin(request);
  const { clientId, allowedEmails } = authConfig();
  const identity = await verifyGoogleAdmin(readCookie(request, SESSION_COOKIE), clientId, allowedEmails);
  return identity.email;
}
