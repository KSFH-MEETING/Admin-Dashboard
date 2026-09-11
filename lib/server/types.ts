export const BOOKING_STATUSES = ['PENDING', 'CALENDAR_CREATED', 'CONFIRMED', 'ERROR', 'CANCELED'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type BookingInput = {
  requestId: string;
  title: string;
  coordinator: string;
  phone: string;
  department: string;
  room: string;
  date: string;
  startTime: string;
  endTime: string;
  attendees: number;
  technicalStaff: string[];
  equipment: string[];
  notes: string;
  timeZone: string;
  source: string;
  telegramInitData: string;
};

export type Booking = Omit<BookingInput, 'telegramInitData'> & {
  bookingId: string;
  createdAt: string;
  updatedAt: string;
  status: BookingStatus;
  googleEventId: string;
  telegramMessageId: string;
  telegramUserId: string;
  error: string;
};

export const SHEET_HEADERS = [
  'Booking ID', 'Request ID', 'Created At', 'Updated At', 'Status', 'Title',
  'Coordinator', 'Phone', 'Department', 'Room', 'Date', 'Start Time', 'End Time',
  'Attendees', 'Technical Staff', 'Equipment', 'Notes', 'Time Zone', 'Source',
  'Google Event ID', 'Telegram Message ID', 'Telegram User ID', 'Error',
] as const;

export function bookingToRow(booking: Booking): (string | number)[] {
  return [
    booking.bookingId, booking.requestId, booking.createdAt, booking.updatedAt, booking.status,
    booking.title, booking.coordinator, booking.phone, booking.department, booking.room,
    booking.date, booking.startTime, booking.endTime, booking.attendees,
    booking.technicalStaff.join(' | '), booking.equipment.join(' | '), booking.notes,
    booking.timeZone, booking.source, booking.googleEventId, booking.telegramMessageId,
    booking.telegramUserId, booking.error,
  ];
}

export function rowToBooking(row: unknown[]): Booking {
  const value = (index: number) => {
    const cell = row[index];
    return typeof cell === 'string' || typeof cell === 'number' || typeof cell === 'boolean' ? String(cell) : '';
  };
  return {
    bookingId: value(0), requestId: value(1), createdAt: value(2), updatedAt: value(3),
    status: (value(4) || 'PENDING') as BookingStatus, title: value(5), coordinator: value(6),
    phone: value(7), department: value(8), room: value(9), date: value(10),
    startTime: value(11), endTime: value(12), attendees: Number(row[13] || 0),
    technicalStaff: value(14) ? value(14).split(' | ') : [],
    equipment: value(15) ? value(15).split(' | ') : [], notes: value(16),
    timeZone: value(17) || 'Asia/Phnom_Penh', source: value(18), googleEventId: value(19),
    telegramMessageId: value(20), telegramUserId: value(21), error: value(22),
  };
}
