import { optionalEnv } from './env';
import { readCookie, requireSameOrigin, verifyGoogleIdentity, AuthError } from './google-identity';
import { resolveDashboardUser } from './dashboard-users';
import { userCan } from './user-policy';

export const SESSION_COOKIE = '__Host-ksfh-session';
export const NONCE_COOKIE = '__Host-ksfh-login';

export function authConfig() {
  return { clientId: optionalEnv('GOOGLE_CLIENT_ID') };
}

export function authCookie(name: string, value: string, maxAge: number) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export async function requireDashboardUser(request: Request, permission: 'read' | 'bookings' | 'users' = 'read') {
  if (!['GET', 'HEAD'].includes(request.method)) requireSameOrigin(request);
  const { clientId } = authConfig();
  const identity = await verifyGoogleIdentity(readCookie(request, SESSION_COOKIE), clientId);
  const user = await resolveDashboardUser(identity.email);
  if (!userCan(user, permission)) throw new AuthError('គណនីនេះមិនមានសិទ្ធិធ្វើសកម្មភាពនេះ', 403);
  return user;
}

export async function requireAdmin(request: Request) {
  const user = await requireDashboardUser(request, ['GET', 'HEAD'].includes(request.method) ? 'read' : 'bookings');
  return user.email;
}
