'use client';

import { useEffect, useMemo, useState } from 'react';
import { ROOMS, TIME_ZONE } from '@/lib/meeting-config';
import { getRoomAvailability } from '@/lib/room-availability';
import type { Booking } from '@/lib/server/types';

function cambodiaDateTime(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  return { date: `${value('year')}-${value('month')}-${value('day')}`, time: `${value('hour')}:${value('minute')}` };
}

export function TodayRoomAvailability({ bookings, loading, onSelectRoom }: { bookings: Booking[]; loading: boolean; onSelectRoom: (room: string) => void }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const clock = cambodiaDateTime(now);
  const rooms = useMemo(() => getRoomAvailability(ROOMS, bookings, clock.date, clock.time), [bookings, clock.date, clock.time]);
  const availableNow = rooms.filter((room) => room.availableNow).length;
  const freeAllDay = rooms.filter((room) => room.freeAllDay).length;

  return <section aria-labelledby="today-room-title" className="mb-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
    <div className="flex flex-col gap-2 border-b bg-emerald-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 id="today-room-title" className="font-bold text-slate-900">🏢 បន្ទប់ទំនេរថ្ងៃនេះ</h2><p className="mt-1 text-xs text-slate-600">ម៉ោងកម្ពុជា {clock.time} · ចុចមើលកាលវិភាគរបស់បន្ទប់</p></div>
      <div className="flex flex-wrap gap-2 text-sm"><strong className="rounded-full bg-emerald-700 px-3 py-1.5 text-white">{loading ? '…' : availableNow}/{ROOMS.length} ទំនេរឥឡូវ</strong><span className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-emerald-800">{loading ? '…' : freeAllDay} ទំនេរពេញថ្ងៃ</span></div>
    </div>
    {loading ? <div className="p-8 text-center text-sm text-slate-500">កំពុងពិនិត្យបន្ទប់…</div> : <div className="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
      {rooms.map((item) => {
        const current = item.currentBooking;
        const next = item.nextBooking;
        const status = current ? `🔴 កំពុងប្រើដល់ ${current.endTime}` : item.freeAllDay ? '🟢 ទំនេរពេញមួយថ្ងៃ' : next ? '🟢 ទំនេរឥឡូវ' : '🟢 ទំនេរសម្រាប់ថ្ងៃនេះ';
        return <article key={item.room} className="flex min-h-44 flex-col bg-white p-4">
          <div className="flex items-start justify-between gap-2"><h3 className="font-semibold leading-6 text-slate-900">{item.room}</h3><span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${current ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{current ? 'កំពុងប្រើ' : 'ទំនេរ'}</span></div>
          <p className={`mt-3 text-sm font-semibold ${current ? 'text-red-700' : 'text-emerald-700'}`}>{status}</p>
          {current && <p className="mt-1 line-clamp-1 text-xs text-slate-500" title={current.title}>{current.title}</p>}
          {!current && next && <p className="mt-1 text-xs text-slate-600">កក់បន្ទាប់៖ <strong>{next.startTime}–{next.endTime}</strong></p>}
          {current && next && <p className="mt-1 text-xs text-slate-600">បន្ទាប់៖ <strong>{next.startTime}–{next.endTime}</strong></p>}
          <div className="mt-auto pt-4">{item.bookings.length ? <button type="button" onClick={() => onSelectRoom(item.room)} className="text-xs font-semibold text-emerald-700 underline-offset-4 hover:underline">មើល {item.bookings.length} ការកក់ថ្ងៃនេះ →</button> : <span className="text-xs text-slate-400">មិនមានការកក់ថ្ងៃនេះ</span>}</div>
        </article>;
      })}
    </div>}
  </section>;
}
