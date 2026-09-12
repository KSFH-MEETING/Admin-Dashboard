import { authConfig, authCookie, requireDashboardUser, SESSION_COOKIE } from '@/lib/server/admin-auth';
import { AuthError, requireSameOrigin } from '@/lib/server/google-identity';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  const { clientId } = authConfig();
  try {
    const user = await requireDashboardUser(request);
    return Response.json({ email: user.email, user, clientId }, { headers });
  } catch (error) {
    if (!(error instanceof AuthError)) return Response.json({ message: 'មិនអាចពិនិត្យសិទ្ធិបាន។ សូមព្យាយាមម្ដងទៀត។' }, { status: 503, headers });
    return Response.json({ email: null, clientId, reason: error.status === 403 ? 'forbidden' : 'unauthenticated', message: error.message }, { headers });
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
