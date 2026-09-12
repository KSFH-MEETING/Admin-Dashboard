import { authConfig, authCookie, NONCE_COOKIE, SESSION_COOKIE } from '@/lib/server/admin-auth';
import { AuthError, readCookie, requireSameOrigin, verifyGoogleIdentity } from '@/lib/server/google-identity';

import { resolveDashboardUser } from '@/lib/server/dashboard-users';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { clientId } = authConfig();
  if (!clientId) return Response.json({ message: 'Google Login មិនទាន់បានកំណត់' }, { status: 503 });
  const nonce = crypto.randomUUID();
  return Response.json({ clientId, nonce }, { headers: {
    'Cache-Control': 'no-store', 'Set-Cookie': authCookie(NONCE_COOKIE, nonce, 600),
  } });
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new AuthError('Invalid request', 400);
    // Bound the credential body before parsing or making any verification request.
    const reader = request.body?.getReader();
    if (!reader) throw new AuthError('Invalid request', 400);
    let body = '';
    let bytes = 0;
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 5000) { await reader.cancel(); throw new AuthError('Invalid request', 413); }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    const data = JSON.parse(body) as { credential?: unknown; nonce?: unknown };
    const nonce = readCookie(request, NONCE_COOKIE);
    if (!nonce || data.nonce !== nonce || typeof data.credential !== 'string') throw new AuthError('សូមចាប់ផ្ដើម Login ម្ដងទៀត');
    const { clientId } = authConfig();
    const identity = await verifyGoogleIdentity(data.credential, clientId, nonce);
    await resolveDashboardUser(identity.email);
    const headers = new Headers({ 'Cache-Control': 'no-store' });
    headers.append('Set-Cookie', authCookie(SESSION_COOKIE, data.credential, Math.max(0, Math.min(3600, identity.expiresAt - Math.floor(Date.now() / 1000)))));
    headers.append('Set-Cookie', authCookie(NONCE_COOKIE, '', 0));
    return Response.json({ email: identity.email }, { headers });
  } catch (error) {
    return Response.json({ message: error instanceof AuthError ? error.message : 'មិនអាច Login បាន។ សូមព្យាយាមម្ដងទៀត' }, {
      status: error instanceof AuthError ? error.status : 400, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
