import { ArrowLeft, Bot, CalendarCheck, CheckCircle2, Cloud, KeyRound, Sheet } from 'lucide-react';
import Link from 'next/link';

export const metadata = { title: 'របៀបភ្ជាប់ប្រព័ន្ធ' };

const steps = [
  { icon: Cloud, title: '1. បង្កើត Google Service Account', detail: 'ចូល Google Cloud Console → បង្កើត Project → បើក Google Sheets API និង Google Calendar API → បង្កើត Service Account និងទាញយក JSON Key។' },
  { icon: Sheet, title: '2. ចែកសិទ្ធិ Google Sheet', detail: 'Copy អ៊ីមែល service account ពី JSON ហើយ Share Google Sheet ជា Editor។ ប្រព័ន្ធនឹងបង្កើត Tab ថ្មីឈ្មោះ Bookings ដោយស្វ័យប្រវត្តិ។' },
  { icon: CalendarCheck, title: '3. ចែកសិទ្ធិ Google Calendar', detail: 'ក្នុង Calendar Settings → Share with specific people → បន្ថែមអ៊ីមែល service account និងផ្តល់សិទ្ធិ Make changes to events។' },
  { icon: Bot, title: '4. រៀបចំ Telegram Bot', detail: 'ចូល @BotFather ហើយបង្កើត Token ថ្មី ព្រោះ Token ចាស់ត្រូវបានបង្ហាញក្នុង Chat។ បន្ថែម @k_event_bot ទៅ Group ជា Admin និងរក Chat ID។' },
  { icon: KeyRound, title: '5. ដាក់ Secrets ក្នុង Cloudflare', detail: 'ដាក់ GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, CF_ACCESS_TEAM_DOMAIN និង CF_ACCESS_AUD ក្នុង Workers → Settings → Variables and Secrets។ ជ្រើស Encrypt សម្រាប់ Private Key និង Bot Token។' },
  { icon: CheckCircle2, title: '6. ការពារ Dashboard និងបើកប្រើ', detail: 'បង្កើត Cloudflare Access Application សម្រាប់ /dashboard និង /api/admin/* ហើយអនុញ្ញាតតែ komchay8@gmail.com។ Form /request ត្រូវទុកជា Public។' },
];

export default function SetupPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white"><div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-5 sm:px-6"><Link href="/dashboard" className="grid size-9 place-items-center rounded-lg border hover:bg-slate-50"><ArrowLeft className="size-4" /></Link><div><p className="text-xs text-emerald-700">KSFH Meeting</p><h1 className="text-lg font-bold">របៀបភ្ជាប់ប្រព័ន្ធ</h1></div></div></header>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950"><h2 className="font-bold">សុវត្ថិភាព Telegram</h2><p className="mt-1 text-sm leading-6">Token ដែលបានផ្ញើក្នុង Chat ត្រូវចាត់ទុកថាបានបែកធ្លាយ។ សូមចូល @BotFather → /revoke ដើម្បីលុប Token ចាស់ ហើយបង្កើត Token ថ្មី។ កុំ Copy Token ថ្មីចូល Chat ឬ GitHub។</p></div>
        <div className="grid gap-4">
          {steps.map((step) => <section key={step.title} className="rounded-2xl border bg-white p-5 shadow-sm sm:flex sm:gap-4"><div className="mb-3 grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 sm:mb-0"><step.icon className="size-5" /></div><div><h2 className="font-bold">{step.title}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{step.detail}</p></div></section>)}
        </div>
        <div className="mt-6 rounded-2xl border bg-white p-5"><h2 className="font-bold">Secrets ដែលមិនត្រូវដាក់ក្នុង GitHub</h2><div className="mt-3 grid gap-2 font-mono text-xs text-slate-600"><code>GOOGLE_PRIVATE_KEY</code><code>TELEGRAM_BOT_TOKEN</code><code>CF_ACCESS_AUD</code></div></div>
      </div>
    </main>
  );
}
