import test from 'node:test';
import assert from 'node:assert/strict';
import { getRoomAvailability } from '../lib/room-availability.ts';

const booking = (room, startTime, endTime, status = 'CONFIRMED') => ({
  bookingId: `${room}-${startTime}`, date: '2026-09-14', room, startTime, endTime, status, title: `Meeting ${startTime}`,
});

test('summarizes rooms that are in use, available next, finished, or free all day', () => {
  const result = getRoomAvailability(['Room A', 'Room B', 'Room C', 'Room D'], [
    booking('Room A', '08:00', '10:00'), booking('Room A', '13:00', '14:00'),
    booking('Room B', '11:00', '12:00'), booking('Room C', '07:00', '08:00'),
    booking('Room D', '08:00', '17:00', 'CANCELED'), booking('Room A', '08:30', '09:30', 'CANCELED'),
  ], '2026-09-14', '09:00');

  assert.equal(result[0].availableNow, false);
  assert.equal(result[0].currentBooking?.endTime, '10:00');
  assert.equal(result[0].nextBooking?.startTime, '13:00');
  assert.equal(result[1].availableNow, true);
  assert.equal(result[1].nextBooking?.startTime, '11:00');
  assert.equal(result[2].availableNow, true);
  assert.equal(result[2].freeAllDay, false);
  assert.equal(result[3].freeAllDay, true);
});

test('uses only the requested date and sorts the daily schedule by start time', () => {
  const rows = [booking('Room A', '14:00', '15:00'), booking('Room A', '09:00', '10:00'), { ...booking('Room A', '08:00', '09:00'), date: '2026-09-15' }];
  const [room] = getRoomAvailability(['Room A'], rows, '2026-09-14', '07:00');
  assert.deepEqual(room.bookings.map((item) => item.startTime), ['09:00', '14:00']);
  assert.equal(room.nextBooking?.startTime, '09:00');
});
