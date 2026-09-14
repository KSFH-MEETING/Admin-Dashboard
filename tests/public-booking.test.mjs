import test from 'node:test';
import assert from 'node:assert/strict';
import { publicBooking } from '../lib/server/public-booking.ts';

const booking = {
  bookingId: 'KSFH-1', requestId: 'request-secret', createdAt: 'created', updatedAt: 'updated', status: 'CONFIRMED',
  title: 'Meeting', coordinator: 'Person', phone: '012345678', department: 'Office', room: 'Room', date: '2026-09-12',
  startTime: '08:00', endTime: '09:00', attendees: 12, technicalStaff: ['Staff'], equipment: ['Projector'], notes: 'Water',
  timeZone: 'Asia/Phnom_Penh', source: 'telegram', googleEventId: 'google-id', telegramMessageId: 'message-id', telegramUserId: 'user-id', error: 'diagnostic',
  telegramChatId: '-1001', telegramTopicId: '1601', telegramStatus: 'SYNCED', telegramUpdatedAt: 'telegram-updated',
};

test('Guest receives all Dashboard booking details but no integration identifiers', () => {
  const result = publicBooking(booking);
  for (const field of ['bookingId','status','title','coordinator','phone','department','room','date','startTime','endTime','attendees','technicalStaff','equipment','notes','timeZone']) assert.deepEqual(result[field], booking[field]);
  for (const field of ['requestId','createdAt','updatedAt','source','googleEventId','telegramMessageId','telegramUserId','telegramChatId','telegramTopicId','telegramStatus','telegramUpdatedAt','error']) assert.equal(result[field], '');
});
