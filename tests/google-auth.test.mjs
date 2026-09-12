import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT, createLocalJWKSet, exportJWK } from 'jose';
import { verifyGoogleAdmin, requireSameOrigin, readCookie } from '../lib/server/google-identity.ts';

const pair = await generateKeyPair('RS256');
const keys = createLocalJWKSet({ keys: [{ ...await exportJWK(pair.publicKey), kid: 'test-key', alg: 'RS256' }] });
const clientId = 'test.apps.googleusercontent.com';
const email = 'komchay8@gmail.com';
const allowed = [email];
const now = Math.floor(Date.now() / 1000);
async function token(claims = {}, signingKey = pair.privateKey) {
  return new SignJWT({ iss: 'https://accounts.google.com', aud: clientId, sub: '1234', iat: now, exp: now + 3600, email, email_verified: true, nonce: 'browser-nonce', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).sign(signingKey);
}
test('verified admin can log in with matching nonce and use the session', async () => {
  const value = await token();
  assert.equal((await verifyGoogleAdmin(value, clientId, allowed, 'browser-nonce', keys)).email, email);
  assert.equal((await verifyGoogleAdmin(value, clientId, allowed, undefined, keys)).email, email);
});
for (const [name, claims] of Object.entries({
  expired: { exp: now - 1 }, wrongAudience: { aud: 'other-client' }, wrongIssuer: { iss: 'https://attacker.example' },
  unverifiedEmail: { email_verified: false }, unauthorizedEmail: { email: 'other@gmail.com' },
  wrongPresenter: { azp: 'other-client' }, futureIssued: { iat: now + 600 }, noExpiry: { exp: undefined },
  missingSubject: { sub: undefined }, wrongNonce: { nonce: 'attacker-nonce' },
})) {
  test(`rejects ${name}`, async () => {
    await assert.rejects(verifyGoogleAdmin(await token(claims), clientId, allowed, 'browser-nonce', keys));
  });
}
test('rejects forged signatures, malformed tokens and absent credentials', async () => {
  const other = await generateKeyPair('RS256');
  await assert.rejects(verifyGoogleAdmin(await token({}, other.privateKey), clientId, allowed, undefined, keys));
  for (const bad of ['', 'bad.token', 'x'.repeat(4000)]) await assert.rejects(verifyGoogleAdmin(bad, clientId, allowed, undefined, keys));
});
test('fails closed with missing client or no configured admins', async () => {
  const value = await token();
  await assert.rejects(verifyGoogleAdmin(value, '', allowed, undefined, keys));
  await assert.rejects(verifyGoogleAdmin(value, clientId, [], undefined, keys));
});
test('mutations reject cross-origin and missing-origin requests', () => {
  const url = 'https://ksfh-meeting.ksfh-meeting.workers.dev/api/admin/bookings';
  assert.doesNotThrow(() => requireSameOrigin(new Request(url, { method: 'POST', headers: { Origin: new URL(url).origin } })));
  for (const origin of ['', 'https://attacker.example']) assert.throws(() => requireSameOrigin(new Request(url, { method: 'POST', headers: { Origin: origin } })));
});
test('cookie lookup matches the exact name', () => {
  const request = new Request('https://example.com', { headers: { Cookie: 'other__Host-ksfh-session=bad; __Host-ksfh-session=good' } });
  assert.equal(readCookie(request, '__Host-ksfh-session'), 'good');
  assert.equal(readCookie(request, '__Host-ksfh-login'), '');
});
