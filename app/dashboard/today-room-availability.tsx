'use client';

import { useEffect, useMemo, useState } from 'react';
import { ROOMS, TIME_ZONE } from '@/lib/meeting-config';
import { getRoomAvailability } from '@/lib/room-availability';
import type { Booking } from '@/lib/server/types';
import { Modal } from './modal';

function cambodiaDateTime(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || '';
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    time: `${value('hour')}:${value('minute')}`,
  };
}

export function TodayRoomAvailability({
  bookings,
  loading,
  onSelectRoom,
}: {
  bookings: Booking[];
  loading: boolean;
  onSelectRoom: (room: string) => void;
}) {
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const clock = cambodiaDateTime(now);
  const rooms = useMemo(
    () => getRoomAvailability(ROOMS, bookings, clock.date, clock.time),
    [bookings, clock.date, clock.time],
  );
  const availableRooms = rooms.filter((room) => room.availableNow);
  const busyRooms = rooms.filter((room) => !room.availableNow);
  const freeAllDay = rooms.filter((room) => room.freeAllDay).length;

  const chooseRoom = (room: string, hasBookings: boolean) => {
    if (!hasBookings) return;
    setOpen(false);
    onSelectRoom(room);
  };

  const roomRow = (item: (typeof rooms)[number]) => {
    const current = item.currentBooking;
    const next = item.nextBooking;
    const detail = current
      ? `ទំនេរវិញនៅ ${current.endTime}`
      : item.freeAllDay
        ? 'ទំនេរពេញមួយថ្ងៃ'
        : next
          ? `កក់បន្ទាប់ ${next.startTime}–${next.endTime}`
          : 'ទំនេរសម្រាប់ថ្ងៃនេះ';
    const hasBookings = item.bookings.length > 0;

    return (
      <button
        key={item.room}
        type="button"
        disabled={!hasBookings}
        onClick={() => chooseRoom(item.room, hasBookings)}
        className="flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition enabled:hover:border-emerald-400 enabled:hover:bg-emerald-50/40 disabled:cursor-default"
      >
        <span className="min-w-0">
          <strong className="block truncate text-sm text-slate-900">{item.room}</strong>
          <span className={`mt-1 block text-xs ${current ? 'text-red-700' : 'text-emerald-700'}`}>
            {detail}
          </span>
        </span>
        {hasBookings && <span className="shrink-0 text-xs font-semibold text-emerald-700">មើល →</span>}
      </button>
    );
  };

  return (
    <div className="shrink-0">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={loading}
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60"
      >
        <span>🏢 {loading ? 'កំពុងពិនិត្យ…' : `${availableRooms.length}/${ROOMS.length} ទំនេរ`}</span>
      </button>

      {open && (
        <Modal title="🏢 បន្ទប់ទំនេរថ្ងៃនេះ" onClose={() => setOpen(false)}>
          <div id="today-room-availability-dialog" className="p-5">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-4">
              <p className="text-sm text-emerald-900">ម៉ោងកម្ពុជា <strong>{clock.time}</strong></p>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-emerald-700 px-3 py-1.5 text-white">{availableRooms.length}/{ROOMS.length} ទំនេរឥឡូវ</span>
                <span className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-emerald-800">{freeAllDay} ទំនេរពេញថ្ងៃ</span>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <section aria-label="បន្ទប់ទំនេរ">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-emerald-800">🟢 អាចកក់បាន</h3>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{availableRooms.length}</span>
                </div>
                <div className="space-y-2">{availableRooms.map(roomRow)}</div>
              </section>

              <section aria-label="បន្ទប់កំពុងប្រើ" className="border-t pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-red-800">🔴 កំពុងប្រើ</h3>
                  <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">{busyRooms.length}</span>
                </div>
                <div className="space-y-2">{busyRooms.map(roomRow)}</div>
              </section>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
