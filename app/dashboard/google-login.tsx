/* eslint-disable nextjs/no-html-link-for-pages -- Use native navigation: Vinext client navigation fails for the public request route. */
'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

type GoogleIdentity = {
  initialize: (options: { client_id: string; nonce: string; auto_select: boolean; callback: (response: { credential: string }) => void }) => void;
  renderButton: (parent: HTMLElement, options: { theme: string; size: string; text: string; width: number }) => void;
  disableAutoSelect: () => void;
};

declare global { interface Window { google?: { accounts: { id: GoogleIdentity } } } }

let googleLoader: Promise<GoogleIdentity> | undefined;
function loadGoogle() {
  if (window.google?.accounts.id) return Promise.resolve(window.google.accounts.id);
  if (!googleLoader) googleLoader = new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    const timer = window.setTimeout(() => { script.remove(); reject(new Error('Google Login ចំណាយពេលយូរ។ សូមពិនិត្យ Internet ហើយព្យាយាមម្ដងទៀត')); }, 15000);
    script.onload = () => {
      window.clearTimeout(timer);
      if (window.google?.accounts.id) resolve(window.google.accounts.id);
      else { script.remove(); reject(new Error('មិនអាចបើក Google Login បាន')); }
    };
    script.onerror = () => { window.clearTimeout(timer); script.remove(); reject(new Error('មិនអាចភ្ជាប់ Google បាន។ សូមពិនិត្យ Internet')); };
    document.head.appendChild(script);
  }).catch((error) => { googleLoader = undefined; throw error; });
  return googleLoader;
}

export function GoogleLogin({ onSignedIn, onGuest, notice = '' }: { onSignedIn: (email: string) => void; onGuest: () => void; notice?: string }) {
  const button = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    async function start() {
      try {
        const response = await fetch('/api/auth/google', { cache: 'no-store' });
        const data = await response.json() as { clientId: string; nonce: string; message?: string };
        if (!response.ok) throw new Error(data.message || 'មិនអាចចាប់ផ្ដើម Login បាន');
        const google = await loadGoogle();
        if (!active || !button.current) return;
        google.initialize({ client_id: data.clientId, nonce: data.nonce, auto_select: false, callback: async ({ credential }) => {
          if (!active) return;
          setBusy(true); setMessage('');
          try {
            const result = await fetch('/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential, nonce: data.nonce }) });
            const login = await result.json() as { email?: string; message?: string };
            if (!result.ok || !login.email) throw new Error(login.message || 'មិនអាច Login បាន');
            if (active) onSignedIn(login.email);
          } catch (error) { if (active) setMessage(error instanceof Error ? error.message : 'មិនអាច Login បាន'); }
          finally { if (active) setBusy(false); }
        } });
        button.current.replaceChildren();
        google.renderButton(button.current, { theme: 'outline', size: 'large', text: 'signin_with', width: Math.max(200, Math.min(320, button.current.clientWidth)) });
        setReady(true);
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : 'មិនអាច Login បាន'); }
    }
    void start();
    return () => { active = false; };
  }, [attempt, onSignedIn]);

  return <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
    <section className="w-full max-w-md rounded-2xl border bg-white p-5 sm:p-7 text-center shadow-sm">
      <p className="text-sm font-semibold text-emerald-700">KSFH Meeting</p>
      <h1 className="mt-3 text-2xl font-bold">ចូលផ្ទាំងគ្រប់គ្រង</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">សូមប្រើគណនី Google ដែលម្ចាស់ប្រព័ន្ធបានផ្តល់សិទ្ធិ។ អ្នកនឹងឃើញមុខងារតាមសិទ្ធិរបស់អ្នក។</p>
      {notice && <output className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{notice}</output>}
      <div ref={button} className={`mt-6 flex justify-center ${busy ? 'pointer-events-none opacity-50' : ''}`} />
      <div className="my-5 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" /><span>ឬ</span><span className="h-px flex-1 bg-slate-200" /></div>
      <Button type="button" variant="outline" className="w-full" onClick={onGuest}>🌐 ចូលជា Guest ដោយមិន Login</Button>
      <p className="mt-2 text-xs leading-5 text-slate-500">Guest អាចមើលព័ត៌មានការកក់ និងរបាយការណ៍ តែមិនអាចកែ ឬលុបបាន។</p>
      {!ready && !message && <p className="mt-4 text-sm text-slate-500">កំពុងបើក Google Login…</p>}
      {busy && <output className="mt-4 block text-sm text-slate-500">កំពុងផ្ទៀងផ្ទាត់គណនី…</output>}
      {message && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{message}<div className="mt-3"><Button variant="outline" disabled={busy} onClick={() => { setMessage(''); setReady(false); setAttempt((value) => value + 1); }}>ព្យាយាមម្ដងទៀត</Button></div></div>}
      <div className="mt-6 rounded-xl bg-slate-50 p-4 text-left text-sm leading-6"><p className="font-semibold">មិនទាន់មានសិទ្ធិចូល?</p><p className="mt-1 text-slate-600">ទាក់ទងម្ចាស់ប្រព័ន្ធ ដើម្បីបន្ថែម Google Email របស់អ្នក។ មិនចាំបាច់បង្កើត Password ថ្មីទេ។</p><p className="mt-2 text-slate-600">សម្រាប់ស្នើសុំបន្ទប់ អ្នកអាចប្រើ Form ខាងក្រោម ដោយមិនចាំបាច់ Login។</p></div>
      <a href="/request" className="mt-7 inline-block text-sm text-emerald-700 underline">បើក Form ស្នើសុំបន្ទប់</a>
    </section>
  </main>;
}
