import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedDashboardViews, resolveDashboardView } from '../lib/dashboard-access.ts';

test('Guest can only open Booking views, including when using a direct hash link', () => {
  assert.deepEqual(allowedDashboardViews('viewer', true), ['bookings']);
  for (const hash of ['#reports', '#calendar-sync', '#users', '#inventory']) {
    assert.equal(resolveDashboardView(hash, 'viewer', true), 'bookings');
  }
  assert.equal(resolveDashboardView('#bookings', 'viewer', true), 'bookings');
});

test('signed-in roles retain their assigned Dashboard views', () => {
  assert.deepEqual(allowedDashboardViews('viewer'), ['bookings', 'reports', 'inventory']);
  assert.deepEqual(allowedDashboardViews('editor'), ['bookings', 'reports', 'inventory']);
  assert.deepEqual(allowedDashboardViews('owner'), ['bookings', 'reports', 'calendar-sync', 'users', 'inventory']);
});
