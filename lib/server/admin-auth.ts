import { optionalEnv } from './env';

type AccessPayload = { aud?: string | string[]; email?: string; exp?: number; iss?: string };
let jwksCache: { expiresAt: number; keys: JsonWebKey[] } | null = null;

function decodePart(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  return JSON.parse(atob(padded)) as Record<string, unknown>;
}

async function accessKeys(teamDomain: string) {
  if (jwksCache && jwksCache.expiresAt > Date.now()) return jwksCache.keys;
  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error('មិនអាចផ្ទៀងផ្ទាត់ Cloudflare Access បាន');
  const result = await response.json() as { keys?: JsonWebKey[] };
  jwksCache = { keys: result.keys || [], expiresAt: Date.now() + 60 * 60 * 1000 };
  return jwksCache.keys;
}

export async function requireAdmin(request: Request) {
  const url = new URL(request.url);
  if ((url.hostname === 'localhost' || url.hostname === '127.0.0.1') && optionalEnv('NODE_ENV') !== 'production') return 'local-preview';
  const token = request.headers.get('Cf-Access-Jwt-Assertion') || '';
  const teamDomain = optionalEnv('CF_ACCESS_TEAM_DOMAIN');
  const audience = optionalEnv('CF_ACCESS_AUD');
  if (!token || !teamDomain || !audience) throw new Error('សូម Login តាម Cloudflare Access');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Cloudflare Access token មិនត្រឹមត្រូវ');
  const header = decodePart(parts[0]) as { kid?: string; alg?: string };
  const payload = decodePart(parts[1]) as AccessPayload;
  const jwk = (await accessKeys(teamDomain)).find((key) => (key as JsonWebKey & { kid?: string }).kid === header.kid);
  if (!jwk || header.alg !== 'RS256') throw new Error('Cloudflare Access key មិនត្រឹមត្រូវ');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const signature = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - parts[2].length % 4) % 4)), (char) => char.charCodeAt(0));
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud || ''];
  if (!valid || !audiences.includes(audience) || !payload.exp || payload.exp * 1000 < Date.now()) throw new Error('Cloudflare Access token ផុតកំណត់');
  const email = (payload.email || '').toLowerCase();
  const allowed = (optionalEnv('ADMIN_EMAILS') || 'komchay8@gmail.com').split(',').map((item) => item.trim().toLowerCase());
  if (!email || !allowed.includes(email)) throw new Error('គណនីនេះមិនមានសិទ្ធិគ្រប់គ្រង');
  return email;
}
