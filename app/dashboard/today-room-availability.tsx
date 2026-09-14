'use client';

import { ChevronDown, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ROOMS, TIME_ZONE } from '@/lib/meeting-config';
import { getRoomAvailability } from '@/lib/room-availability';
import type { Booking } from '@/lib/server/types';

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
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

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
    <div ref={container} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="today-room-popover"
        disabled={loading}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60"
      >
        <span>🏢 {loading ? 'កំពុងពិនិត្យ…' : `${availableRooms.length}/${ROOMS.length} ទំនេរ`}</span>
        <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <section
          id="today-room-popover"
          aria-labelledby="today-room-popover-title"
          className="absolute right-0 top-12 z-40 w-[min(44rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        >
          <header className="flex items-start justify-between gap-3 border-b bg-emerald-50/70 p-4">
            <div>
              <h2 id="today-room-popover-title" className="font-bold text-slate-900">
                🏢 បន្ទប់ទំនេរថ្ងៃនេះ
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                ម៉ោងកម្ពុជា {clock.time} · {freeAllDay} បន្ទប់ទំនេរពេញថ្ងៃ
              </p>
            </div>
            <button
              type="button"
              aria-label="បិទព័ត៌មានបន្ទប់"
              onClick={() => setOpen(false)}
              className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-white"
            >
              <X className="size-4" />
            </button>
          </header>

          <div className="grid max-h-[65vh] overflow-y-auto md:grid-cols-2">
            <section aria-label="បន្ទប់ទំនេរ" className="p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="font-semibold text-emerald-800">🟢 អាចកក់បាន</h3>
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                  {availableRooms.length}
                </span>
              </div>
              <div className="space-y-2">{availableRooms.map(roomRow)}</div>
            </section>

            <section aria-label="បន្ទប់កំពុងប្រើ" className="border-t p-4 md:border-l md:border-t-0">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="font-semibold text-red-800">🔴 កំពុងប្រើ</h3>
                <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                  {busyRooms.length}
                </span>
              </div>
              <div className="space-y-2">{busyRooms.map(roomRow)}</div>
            </section>
          </div>
        </section>
      )}
    </div>
  );
}
