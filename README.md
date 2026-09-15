# KSFH Meeting

Web application សម្រាប់ស្នើសុំ និងគ្រប់គ្រងបន្ទប់ប្រជុំ។ Source code រក្សាទុកក្នុង GitHub និងដំណើរការលើ Cloudflare Workers។

## ផ្នែកប្រព័ន្ធ

- `/request` — Form សាធារណៈ និង Telegram Mini App
- `/dashboard` — ផ្ទាំងគ្រប់គ្រង ស្វែងរក កែប្រែ និងលុបចោល
- `/setup` — សេចក្តីណែនាំភ្ជាប់សេវា
- Google Sheets — Database ក្នុង Tab `Bookings`
- Google Calendar — Calendar Event សម្រាប់ការកក់ដែលបានបញ្ជាក់
- Telegram Bot API — សារជូនដំណឹងទៅ Group
- Sign in with Google — Login និងអនុញ្ញាតតែ Admin តាម ADMIN_EMAILS

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
- `GOOGLE_CLIENT_ID` — Public OAuth client ID (configured in `wrangler.jsonc`)

តម្លៃ Google Sheet ID, Sheet name, Calendar ID និង Admin email មានក្នុង `wrangler.jsonc` រួចហើយ។ Share Google Sheet និង Google Calendar ទៅអ៊ីមែល Service Account ជា Editor មុន Deploy។

## Deploy

```powershell
npx wrangler login
npm run build
npx wrangler deploy --config dist/server/wrangler.json
```

Google Auth Platform → Clients → Web application: set Authorized JavaScript origins to `https://ksfh-meeting.ksfh-meeting.workers.dev` (no path). Use the Google Identity Services popup callback; no redirect URI or client secret is needed. `/dashboard` shows Sign in with Google. Backend verifies Google signature, issuer, audience, expiry, verified email, and `ADMIN_EMAILS` on every admin request. Sessions use a Secure, HttpOnly, SameSite=Strict cookie and expire with the Google token (at most one hour); sign out clears the browser cookie. Login uses a browser nonce and all mutations require the same Origin. No Cloudflare Access subscription is needed. `/request` and `/api/bookings` remain public. Local development also requires authentication; add the exact local origin to the OAuth client when testing locally.

Auth regression tests: `npm run test:auth`.

## សុវត្ថិភាព

Bot Token ដែលធ្លាប់ផ្ញើក្នុង Chat ត្រូវចាត់ទុកថាបានបែកធ្លាយ។ ចូល `@BotFather` ហើយប្រើ `/revoke` មុនដាក់ Token ថ្មីក្នុង Cloudflare Secret។ មិនមាន Token ឬ Google Private Key នៅក្នុង Source Code នេះទេ។


## Dashboard users

Owners listed in ADMIN_EMAILS can open Dashboard → Users to add existing Google accounts, change names/roles, or disable/reactivate access. The owner cannot be removed through the app. Viewers can read bookings; editors can also change/cancel bookings. Public /request still accepts requests without Dashboard login. No invitation emails or Google accounts are created.

User permissions and their change history are stored as append-only rows in the DashboardUsers tab of the configured Google Sheet. Keep spreadsheet edit access limited to trusted administrators, since it controls both booking data and user permissions. Non-owner permissions are checked on every server request, including existing sessions; disabling a user revokes their next request. Login supports Gmail and Google Workspace identities.

## Meeting equipment inventory

Dashboard → Inventory manages a small stock of meeting equipment with short IDs such as `EQ-001`. Availability is calculated from total, reserved, in-use, and damaged quantities. Inventory changes are stored as append-only rows in the `Inventory` tab of the configured Google Sheet. Owner can add, edit, or disable items; Editor and Viewer have read-only access; Guest cannot open Inventory.

Calendar events show emoji labels and the KSFH-MEETING brand in their description. Google's native creator field is read-only and remains the actual service account. New/edited bookings receive this styling.
