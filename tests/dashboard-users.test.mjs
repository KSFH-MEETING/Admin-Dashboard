import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { userCan, parseUserInput, usersFromRows } from '../lib/server/user-policy.ts';
import { calendarEventBody } from '../lib/server/calendar-event.ts';

test('permission matrix restricts booking changes and user administration', () => {
  for (const role of ['owner', 'editor', 'viewer']) {
    assert.equal(userCan({ role, active: true }, 'read'), true);
    assert.equal(userCan({ role, active: true }, 'bookings'), role !== 'viewer');
    assert.equal(userCan({ role, active: true }, 'users'), role === 'owner');
    for (const permission of ['read', 'bookings', 'users']) assert.equal(userCan({ role, active: false }, permission), false);
  }
});

test('user input cannot request owner privileges or use malformed fields', () => {
  const valid = { email: ' Staff@Gmail.com ', name: ' Staff ', role: 'viewer', active: true };
  assert.equal(parseUserInput(valid).email, 'staff@gmail.com');
  for (const change of [{ role: 'owner' }, { active: 'true' }, { email: 'not an email' }, { name: '' }]) assert.throws(() => parseUserInput({ ...valid, ...change }));
});

test('latest append controls access and malformed permissions fail closed', () => {
  const rows = [['staff@gmail.com', 'Staff', 'editor', true], ['staff@gmail.com', 'Staff', 'viewer', false]];
  assert.equal(usersFromRows(rows)[0].active, false);
  assert.equal(usersFromRows([...rows, ['staff@gmail.com', 'Staff', 'owner', true]])[0].active, false);
});

test('actual user store supports create, role update, disable, reactivate and owner protection', async () => {
  const url = (text) => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
  const compile = (name) => ts.transpileModule(fs.readFileSync(new URL(`../lib/server/${name}.ts`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mockedGoogle = url(`
    export const rows = [];
    export const calls = [];
    let initialized = false;
    export async function googleFetch(url, init) {
      calls.push({ url, method: init?.method || 'GET' });
      if (url.includes(':batchUpdate')) { initialized = true; return Response.json({}); }
      if (url.includes('?fields=')) return Response.json({ sheets: initialized ? [{ properties: { title: 'DashboardUsers' } }] : [] });
      if (url.includes(':append')) { rows.push(...JSON.parse(init.body).values); return Response.json({}); }
      return Response.json({ values: rows });
    }
  `);
  const env = url(`export const optionalEnv = (key) => key === 'ADMIN_EMAILS' ? 'owner@gmail.com' : 'test-sheet'; export const requiredEnv = optionalEnv;`);
  const identity = url(`export class AuthError extends Error { constructor(message, status) { super(message); this.status = status; } }`);
  let source = compile('dashboard-users');
  for (const [name, replacement] of [['env', env], ['google', mockedGoogle], ['google-identity', identity], ['user-policy', url(compile('user-policy'))]]) source = source.replace(`'./${name}'`, JSON.stringify(replacement));
  const store = await import(url(source));
  const mock = await import(mockedGoogle);
  const owner = 'owner@gmail.com';
  const input = { email: 'staff@gmail.com', name: 'Staff', role: 'viewer', active: true };
  assert.equal((await store.resolveDashboardUser(owner)).role, 'owner');
  assert.equal(mock.calls.length, 0, 'owner must remain available without Sheets access');
  await assert.rejects(store.saveDashboardUser(input, 'attacker@gmail.com', true));
  assert.equal(mock.calls.length, 0, 'unauthorized actor cannot reach storage');
  await assert.rejects(store.saveDashboardUser({ ...input, email: owner }, owner, true));
  await store.saveDashboardUser(input, owner, true);
  assert.equal((await store.resolveDashboardUser(input.email)).role, 'viewer');
  await assert.rejects(store.saveDashboardUser(input, owner, true));
  await store.saveDashboardUser({ ...input, role: 'editor' }, owner, false);
  assert.equal((await store.resolveDashboardUser(input.email)).role, 'editor');
  await store.saveDashboardUser({ ...input, active: false }, owner, false);
  await assert.rejects(store.resolveDashboardUser(input.email), 'existing sessions must observe disable');
  await store.saveDashboardUser(input, owner, false);
  assert.equal((await store.resolveDashboardUser(input.email)).active, true);
  await assert.rejects(store.resolveDashboardUser('unknown@gmail.com'));
  assert.equal(mock.rows.length, 4, 'permission changes preserve audit records');
  assert.equal((await store.listDashboardUsers()).length, 2);
});

test('Calendar styling preserves scheduling, escapes user text and avoids immutable creator', () => {
  const booking = { bookingId: 'test-id', requestId: 'test-request', googleEventId: 'event-id', title: 'Meeting', room: 'Room', date: '2026-10-01', startTime: '09:00', endTime: '09:10', timeZone: 'Asia/Phnom_Penh', coordinator: '<script>bad</script>', department: 'Test', phone: '', attendees: 2, technicalStaff: [], equipment: [], notes: '<b>text</b> & more' };
  const event = calendarEventBody(booking);
  assert.equal(event.summary, '📅 Meeting');
  assert.match(event.description, /KSFH-MEETING/);
  assert.match(event.description, /👤/);
  assert.ok(!event.description.includes('<script>'));
  assert.ok(event.description.includes('&lt;b&gt;'));
  assert.equal(event.start.dateTime, '2026-10-01T09:00:00+07:00');
  assert.equal(event.end.dateTime, '2026-10-01T09:10:00+07:00');
  assert.equal(event.creator, undefined);
  assert.equal(calendarEventBody({ ...booking, title: event.summary }).summary, event.summary);
});
