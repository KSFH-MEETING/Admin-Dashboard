import { appendBooking, cancelCalendarEvent, deterministicEventId, ensureCalendarEvent, findBooking, listBookings, updateBooking, updateCalendarEvent } from './google';
import { sendBookingMessage, updateBookingMessage, verifyTelegramInitData } from './telegram';
import type { Booking } from './types';
import { overlaps, validateBookingInput } from './validation';

export class ConflictError extends Error {}
export class NotFoundError extends Error {}

function bookingId(date: string, requestId: string) {
  return `KSFH-${date.replace(/-/g, '')}-${requestId.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase()}`;
}

async function assertAvailable(candidate: Booking, ignoreId = '') {
  const conflict = (await listBookings()).find((item) =>
    item.bookingId !== ignoreId && item.status !== 'CANCELED' && overlaps(candidate, item),
  );
  if (conflict) throw new ConflictError(`បន្ទប់នេះមានការកក់ពីម៉ោង ${conflict.startTime} ដល់ ${conflict.endTime} រួចហើយ`);
}

export async function createBooking(raw: unknown) {
  const input = validateBookingInput(raw);
  const telegramUserId = await verifyTelegramInitData(input.telegramInitData);
  const existing = await findBooking(input.requestId, 'requestId');
  if (existing.booking?.status === 'CONFIRMED') return existing.booking;

  const now = new Date().toISOString();
  const booking: Booking = {
    ...input, bookingId: existing.booking?.bookingId || bookingId(input.date, input.requestId),
    createdAt: existing.booking?.createdAt || now, updatedAt: now,
    status: 'PENDING', googleEventId: existing.booking?.googleEventId || await deterministicEventId(input.requestId),
    telegramMessageId: existing.booking?.telegramMessageId || '',
    telegramUserId: existing.booking?.telegramUserId || telegramUserId, error: '',
  };
  delete (booking as Booking & { telegramInitData?: string }).telegramInitData;
  await assertAvailable(booking, booking.bookingId);

  let rowNumber = existing.rowNumber;
  if (rowNumber > 0) await updateBooking(rowNumber, booking);
  else {
    await appendBooking(booking);
    rowNumber = (await findBooking(booking.bookingId)).rowNumber;
  }

  try {
    booking.googleEventId = await ensureCalendarEvent(booking);
    booking.status = 'CALENDAR_CREATED';
    booking.updatedAt = new Date().toISOString();
    await updateBooking(rowNumber, booking);
    if (!booking.telegramMessageId) booking.telegramMessageId = await sendBookingMessage(booking);
    booking.status = 'CONFIRMED';
    booking.updatedAt = new Date().toISOString();
    await updateBooking(rowNumber, booking);
    return booking;
  } catch (error) {
    booking.status = 'ERROR';
    booking.error = error instanceof Error ? error.message.slice(0, 500) : 'Unknown integration error';
    booking.updatedAt = new Date().toISOString();
    if (rowNumber > 0) await updateBooking(rowNumber, booking).catch(() => undefined);
    throw error;
  }
}

export async function updateBookingById(id: string, raw: unknown) {
  const found = await findBooking(id);
  if (!found.booking) throw new NotFoundError('រកមិនឃើញការកក់នេះ');
  if (found.booking.status === 'CANCELED') throw new Error('ការកក់នេះបានលុបចោលរួចហើយ');
  const input = validateBookingInput({ ...(raw as object), requestId: found.booking.requestId });
  const booking: Booking = {
    ...found.booking, ...input, bookingId: found.booking.bookingId, requestId: found.booking.requestId,
    createdAt: found.booking.createdAt, updatedAt: new Date().toISOString(), status: 'PENDING', error: '',
    telegramUserId: found.booking.telegramUserId,
  };
  delete (booking as Booking & { telegramInitData?: string }).telegramInitData;
  await assertAvailable(booking, id);
  await updateBooking(found.rowNumber, booking);
  try {
    await updateCalendarEvent(booking);
    booking.telegramMessageId = await updateBookingMessage(booking, 'updated');
    booking.status = 'CONFIRMED';
    booking.updatedAt = new Date().toISOString();
    await updateBooking(found.rowNumber, booking);
    return booking;
  } catch (error) {
    booking.status = 'ERROR';
    booking.error = error instanceof Error ? error.message.slice(0, 500) : 'Unknown integration error';
    booking.updatedAt = new Date().toISOString();
    await updateBooking(found.rowNumber, booking).catch(() => undefined);
    throw error;
  }
}

export async function cancelBookingById(id: string) {
  const found = await findBooking(id);
  if (!found.booking) throw new NotFoundError('រកមិនឃើញការកក់នេះ');
  if (found.booking.status === 'CANCELED') return found.booking;
  const booking = { ...found.booking, status: 'CANCELED' as const, updatedAt: new Date().toISOString(), error: '' };
  try {
    await cancelCalendarEvent(booking.googleEventId);
    booking.telegramMessageId = await updateBookingMessage(booking, 'canceled');
    await updateBooking(found.rowNumber, booking);
    return booking;
  } catch (error) {
    booking.error = error instanceof Error ? error.message.slice(0, 500) : 'Unknown integration error';
    await updateBooking(found.rowNumber, booking).catch(() => undefined);
    throw error;
  }
}
