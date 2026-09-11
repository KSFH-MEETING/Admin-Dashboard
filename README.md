# KSFH Meeting

Web application សម្រាប់ស្នើសុំ និងគ្រប់គ្រងបន្ទប់ប្រជុំ។ Source code រក្សាទុកក្នុង GitHub និងដំណើរការលើ Cloudflare Workers។

## ផ្នែកប្រព័ន្ធ

- `/request` — Form សាធារណៈ និង Telegram Mini App
- `/dashboard` — ផ្ទាំងគ្រប់គ្រង ស្វែងរក កែប្រែ និងលុបចោល
- `/setup` — សេចក្តីណែនាំភ្ជាប់សេវា
- Google Sheets — Database ក្នុង Tab `Bookings`
- Google Calendar — Calendar Event សម្រាប់ការកក់ដែលបានបញ្ជាក់
- Telegram Bot API — សារជូនដំណឹងទៅ Group
- Cloudflare Access — Login និងអនុញ្ញាតតែ Admin

## ដំណើរការ Booking

1. អ្នកប្រើបំពេញ Form ហើយចុច Submit។
2. Backend ពិនិត្យទិន្នន័យ និង Telegram Mini App signature ប្រសិនបើបើកពី Telegram។
3. Backend ពិនិត្យការជាន់ម៉ោងក្នុងបន្ទប់ដូចគ្នា។
4. រក្សាទុកកំណត់ត្រា `PENDING` ក្នុង Google Sheets។
5. បង្កើត Google Calendar Event ដោយ Event ID ថេរ ដើម្បីការពារការចុច Submit ស្ទួន។
6. ផ្ញើសារទៅ Telegram Group និងរក្សាទុក Message ID។
7. ប្តូរស្ថានភាពជា `CONFIRMED`។

ការកែប្រែនៅ Dashboard នឹងកែ Google Sheet, Calendar និង Telegram។ ការលុបចោលនឹងលុប Calendar Event និងប្តូរកំណត់ត្រា Sheet ជា `CANCELED` ដើម្បីរក្សាប្រវត្តិ។

## Local development

ត្រូវការ Node.js 22.13 ឬថ្មីជាងនេះ។

```powershell
npm install
Copy-Item .dev.vars.example .dev.vars
npm run dev
```

កុំ Commit `.dev.vars`។ File នេះត្រូវបានដាក់ក្នុង `.gitignore`។

## Cloudflare Secrets

បញ្ចូលតម្លៃខាងក្រោមក្នុង Cloudflare Workers → Settings → Variables and Secrets៖

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY` — Secret
- `TELEGRAM_BOT_TOKEN` — Secret និងត្រូវប្រើ Token ថ្មីដែលបាន Rotate
- `TELEGRAM_CHAT_ID`
- `TELEGRAM_TOPIC_ID` — ទុកទទេ បើ Group មិនប្រើ Topic
- `CF_ACCESS_TEAM_DOMAIN`
- `CF_ACCESS_AUD` — Secret

តម្លៃ Google Sheet ID, Sheet name, Calendar ID និង Admin email មានក្នុង `wrangler.jsonc` រួចហើយ។ Share Google Sheet និង Google Calendar ទៅអ៊ីមែល Service Account ជា Editor មុន Deploy។

## Deploy

```powershell
npx wrangler login
npx @vinext/cloudflare deploy
```

បន្ទាប់ពី Deploy ត្រូវបង្កើត Cloudflare Access Self-hosted Application សម្រាប់ `/dashboard*` និង `/api/admin/*` ហើយអនុញ្ញាត `komchay8@gmail.com`។ ទុក `/request` និង `/api/bookings` ជា Public។ បិទ public `workers.dev` route ប្រសិនបើប្រើ Custom Domain ដើម្បីកុំឱ្យរំលង Access policy។

## សុវត្ថិភាព

Bot Token ដែលធ្លាប់ផ្ញើក្នុង Chat ត្រូវចាត់ទុកថាបានបែកធ្លាយ។ ចូល `@BotFather` ហើយប្រើ `/revoke` មុនដាក់ Token ថ្មីក្នុង Cloudflare Secret។ មិនមាន Token ឬ Google Private Key នៅក្នុង Source Code នេះទេ។
