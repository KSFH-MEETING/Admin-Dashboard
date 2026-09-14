'use client';

import { ExternalLink } from 'lucide-react';
import { Modal } from './modal';

const CALENDAR_URL = 'https://calendar.google.com/calendar/embed?src=9687a0a6bcc63c3544547b42b7a51212b8092b61aa94fffba4c5b3f6b8a8bd31%40group.calendar.google.com&ctz=Asia%2FPhnom_Penh&mode=MONTH&showTitle=0&showPrint=0&showCalendars=0&showTz=1&wkst=1';

export function RoomCalendarModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="📅 ប្រតិទិនកក់បន្ទប់" onClose={onClose} wide>
      <div className="flex h-[calc(100dvh-73px)] min-h-0 flex-col sm:h-[calc(94dvh-73px)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 px-4 py-3 sm:px-5">
          <div>
            <p className="text-sm font-semibold text-slate-800">កម្មវិធីកក់បន្ទប់ទាំងអស់</p>
            <p className="mt-1 text-xs text-slate-500">ម៉ោងកម្ពុជា · មើលតែប៉ុណ្ណោះ</p>
          </div>
          <a href={CALENDAR_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:border-emerald-600 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
            បើកផ្ទាំងថ្មី <ExternalLink className="size-4" />
          </a>
        </div>
        <iframe
          title="ប្រតិទិនកក់បន្ទប់ KSFH"
          src={CALENDAR_URL}
          loading="lazy"
          className="min-h-0 flex-1 border-0 bg-white"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </Modal>
  );
}
