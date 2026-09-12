import type { Booking } from './types';

// Public Guest mode exposes the booking information shown in the Dashboard,
// while omitting internal integration identifiers and diagnostics.
export function publicBooking(booking: Booking): Booking {
  return {
    ...booking,
    requestId: '',
    createdAt: '',
    updatedAt: '',
    source: '',
    googleEventId: '',
    telegramMessageId: '',
    telegramUserId: '',
    error: '',
  };
}
