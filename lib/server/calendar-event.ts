import type { Booking } from './types';

// Calendar's native creator is read-only. Show the application brand in the
// event's own description without claiming to replace Google's creator field.
export function calendarEventBody(booking: Booking) {
  const details = [
    '🏥 បង្កើតតាម KSFH-MEETING',
    `🆔 លេខសម្គាល់: ${booking.bookingId}`,
    `📍 បន្ទប់: ${booking.room}`,
    `📅 កាលបរិច្ឆេទ: ${booking.date}`,
    `🕒 ម៉ោង: ${booking.startTime}–${booking.endTime} (កម្ពុជា)`,
    `👤 អ្នកសម្របសម្រួល: ${booking.coordinator}`,
    `🏢 ផ្នែក: ${booking.department}`,
    booking.phone ? `☎️ ទូរស័ព្ទ: ${booking.phone}` : '',
    booking.attendees ? `👥 អ្នកចូលរួម: ${booking.attendees} នាក់` : '',
    booking.technicalStaff.length ? `🧑‍💻 បុគ្គលិក: ${booking.technicalStaff.join(', ')}` : '',
    booking.equipment.length ? `🧰 សម្ភារៈ: ${booking.equipment.join(', ')}` : '',
    booking.notes ? `📝 កំណត់ចំណាំ: ${booking.notes}` : '',
  ].filter(Boolean).join('\n');
  // Google renders descriptions as HTML; preserve user text as text.
  const description = details.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return {
    id: booking.googleEventId,
    summary: booking.title.startsWith('📅 ') ? booking.title : `📅 ${booking.title}`,
    location: booking.room, description,
    start: { dateTime: `${booking.date}T${booking.startTime}:00+07:00`, timeZone: booking.timeZone },
    end: { dateTime: `${booking.date}T${booking.endTime}:00+07:00`, timeZone: booking.timeZone },
    extendedProperties: { private: { bookingId: booking.bookingId, requestId: booking.requestId } },
  };
}
