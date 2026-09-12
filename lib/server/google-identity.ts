import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export class AuthError extends Error {
  status: number;
  constructor(message = 'សូមចូលតាម Sign in with Google', status = 401) {
    super(message);
    this.status = status;
  }
}

export function requireSameOrigin(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    throw new AuthError('សំណើនេះមិនត្រូវបានអនុញ្ញាត', 403);
  }
}

export function readCookie(request: Request, name: string) {
  return (request.headers.get('cookie') || '').split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) || '';
}

// Google's signature is checked on every admin request; the cookie cannot extend
// the Google ID token's lifetime. The nonce binds initial login to this browser.
export async function verifyGoogleAdmin(
  token: string, clientId: string, allowedEmails: string[], nonce?: string,
  keys: JWTVerifyGetKey = googleKeys,
) {
  if (!clientId) throw new AuthError('Google Login មិនទាន់បានកំណត់', 503);
  if (!token || token.length > 3800) throw new AuthError();
  try {
    const { payload } = await jwtVerify(token, keys, {
      algorithms: ['RS256'], audience: clientId,
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      requiredClaims: ['sub', 'iat', 'exp', 'email', 'email_verified'],
      maxTokenAge: '1h',
    });
    if (payload.azp !== undefined && payload.azp !== clientId) throw new AuthError();
    if (nonce !== undefined && (!nonce || payload.nonce !== nonce)) throw new AuthError('សូមចាប់ផ្ដើម Login ម្ដងទៀត');
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
    if (!payload.sub || payload.email_verified !== true ||
      (!email.endsWith('@gmail.com') && typeof payload.hd !== 'string') ||
      !allowedEmails.map((value) => value.trim().toLowerCase()).includes(email)) {
      throw new AuthError('គណនីនេះមិនមានសិទ្ធិគ្រប់គ្រង', 403);
    }
    return { email, expiresAt: payload.exp as number };
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError('ការចូលប្រើផុតកំណត់ ឬមិនត្រឹមត្រូវ។ សូម Sign in with Google ម្ដងទៀត');
  }
}
