import { authConfig, authCookie, requireAdmin, SESSION_COOKIE } from '@/lib/server/admin-auth';
import { AuthError, requireSameOrigin } from '@/lib/server/google-identity';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  const { clientId } = authConfig();
  try {
    return Response.json({ email: await requireAdmin(request), clientId }, { headers });
  } catch (error) {
    return Response.json({ email: null, clientId, message: error instanceof Error ? error.message : '' }, { headers });
  }
}

export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request);
    return Response.json({ ok: true }, { headers: {
      'Cache-Control': 'no-store', 'Set-Cookie': authCookie(SESSION_COOKIE, '', 0),
    } });
  } catch (error) {
    return Response.json({ message: 'សំណើនេះមិនត្រូវបានអនុញ្ញាត' }, { status: error instanceof AuthError ? error.status : 400 });
  }
}
