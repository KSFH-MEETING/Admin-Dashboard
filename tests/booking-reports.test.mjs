import test from 'node:test';
import assert from 'node:assert/strict';
import { filterReport, summarizeReport, reportCsv } from '../lib/booking-reports.ts';
const make = (bookingId, date, room, status, attendees) => ({ bookingId, date, room, status, attendees, title: 'ប្រជុំ', startTime: '09:00', endTime: '10:00', department: 'Office', coordinator: 'Name' });
const bookings = [make('a','2026-09-12','A','CONFIRMED',15), make('b','2026-09-18','B','CANCELED',50), make('c','2026-09-18','A','ERROR',20), make('d','2026-09-18','A','CONFIRMED',12)];
test('inclusive booking date filters combine with room and status', () => {
  assert.deepEqual(filterReport(bookings, { from:'2026-09-12', to:'2026-09-18', room:'A', status:'CONFIRMED' }).map(b=>b.bookingId), ['a','d']);
  assert.equal(filterReport(bookings, {from:'2026-09-18',to:'2026-09-12',room:'',status:''}).length,0);
  assert.equal(filterReport(bookings, {from:'',to:'',room:'',status:''}).length,4);
  assert.equal(filterReport(bookings, {from:'2027-01-01',to:'',room:'',status:''}).length,0);
});
test('attendance counts confirmed bookings only and empty results stay zero', () => {
  assert.deepEqual(summarizeReport(bookings),{total:4,confirmed:2,canceled:1,attendees:27});
  assert.deepEqual(summarizeReport([]),{total:0,confirmed:0,canceled:0,attendees:0});
});
test('CSV preserves Khmer, quoting and prevents formula injection', () => {
  const csv = reportCsv([{...bookings[0],title:' =HYPERLINK("x")',coordinator:'Hello, "team"\nLine'}]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"\' =HYPERLINK(""x"")"'));
  assert.ok(csv.includes('"Hello, ""team""\nLine"'));
  for (const title of ['+1','-1','@SUM(A1)','\t=1','\r=1']) assert.ok(reportCsv([{...bookings[0],title}]).includes(`"'${title}"`));
});
