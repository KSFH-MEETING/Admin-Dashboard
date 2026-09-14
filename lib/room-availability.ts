import type { Booking } from './server/types';

type AvailabilityBooking = Pick<Booking, 'bookingId' | 'date' | 'room' | 'startTime' | 'endTime' | 'status' | 'title'>;

export type RoomAvailability = {
  room: string;
  bookings: AvailabilityBooking[];
  currentBooking?: AvailabilityBooking;
  nextBooking?: AvailabilityBooking;
  availableNow: boolean;
  freeAllDay: boolean;
};

export function getRoomAvailability(rooms: readonly string[], bookings: AvailabilityBooking[], date: string, time: string): RoomAvailability[] {
  return rooms.map((room) => {
    const schedule = bookings
      .filter((booking) => booking.date === date && booking.room === room && booking.status !== 'CANCELED')
      .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));
    const currentBooking = schedule.find((booking) => booking.startTime <= time && time < booking.endTime);
    const nextBooking = schedule.find((booking) => booking.startTime > time);
    return { room, bookings: schedule, currentBooking, nextBooking, availableNow: !currentBooking, freeAllDay: schedule.length === 0 };
  });
}
