'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function Modal({ title, onClose, busy = false, wide = false, children }: { title: string; onClose: () => void; busy?: boolean; wide?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  useEffect(() => {
    const element = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    heading.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => { element?.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={id} aria-busy={busy} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} className={cn('fixed inset-0 m-auto bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/40 backdrop:backdrop-blur-sm', wide ? 'h-[100dvh] max-h-none w-full max-w-none overflow-hidden rounded-none sm:h-auto sm:max-h-[94dvh] sm:w-[calc(100%-2rem)] sm:max-w-7xl sm:rounded-2xl' : 'max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl')}>
    <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-white p-5"><h2 ref={heading} tabIndex={-1} id={id} className="font-bold leading-7 outline-none">{title}</h2><Button variant="outline" disabled={busy} onClick={onClose}>បិទ</Button></div>
    {children}
  </dialog>;
}
